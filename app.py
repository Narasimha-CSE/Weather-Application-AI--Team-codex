from flask import Flask, render_template, request, jsonify
import requests
import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from groq import Groq


# =========================================================
# CONFIGURATION
# =========================================================

load_dotenv()

app = Flask(__name__)

WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")


print("=" * 60)
print("WeatherGPT Starting...")
print("Weather API Key Loaded:", bool(WEATHER_API_KEY))
print("Groq API Key Loaded:", bool(GROQ_API_KEY))
print("=" * 60)


# =========================================================
# GROQ CLIENT
# =========================================================

groq_client = None

if GROQ_API_KEY:
    groq_client = Groq(
        api_key=GROQ_API_KEY
    )


# =========================================================
# HOME
# =========================================================

@app.route("/")
def home():
    return render_template("index.html")


# =========================================================
# WEATHER FUNCTION - CITY SEARCH
# =========================================================

def get_weather_data(city):

    if not WEATHER_API_KEY:
        return None, "Weather API key is missing."

    if not city:
        return None, "Please enter a city name."

    url = (
        "https://api.openweathermap.org/"
        "data/2.5/weather"
    )

    params = {
        "q": city,
        "appid": WEATHER_API_KEY,
        "units": "metric"
    }

    try:

        response = requests.get(
            url,
            params=params,
            timeout=10
        )

        data = response.json()

        if response.status_code != 200:

            return None, data.get(
                "message",
                "Unable to get weather information."
            )

        weather = {

            "city": data["name"],

            "country": data["sys"]["country"],

            "latitude": data["coord"]["lat"],

            "longitude": data["coord"]["lon"],

            "temperature": data["main"]["temp"],

            "feels_like": data["main"]["feels_like"],

            "humidity": data["main"]["humidity"],

            "pressure": data["main"]["pressure"],

            "wind_speed": data["wind"]["speed"],

            "description": data["weather"][0]["description"],

            "condition": data["weather"][0]["main"],

            "visibility": data.get(
                "visibility",
                0
            ) / 1000,

            "clouds": data["clouds"]["all"],

            "icon": data["weather"][0].get(
                "icon",
                ""
            )
        }

        return weather, None

    except requests.exceptions.Timeout:

        return None, (
            "Weather API request timed out."
        )

    except requests.exceptions.RequestException as e:

        print(
            "Weather Request Error:",
            e
        )

        return None, (
            "Unable to connect to weather service."
        )

    except Exception as e:

        print(
            "Weather Error:",
            e
        )

        return None, (
            "Unexpected weather service error."
        )


# =========================================================
# WEATHER API - CITY
# =========================================================

@app.route("/weather")
def weather():

    city = request.args.get(
        "city",
        ""
    ).strip()

    data, error = get_weather_data(
        city
    )

    if error:

        return jsonify({
            "error": error
        }), 400

    return jsonify(data)


# =========================================================
# LOCATION SEARCH
# NOMINATIM (OPENSTREETMAP) REVERSE GEOCODING
# Returns detailed hierarchy: village, mandal, state, country
# =========================================================

def _pick_village(address):
    """
    Pick the most specific human-settlement name available
    (village / hamlet / town / suburb / city).
    """

    for key in (
        "village",
        "hamlet",
        "town",
        "suburb",
        "city_district",
        "city"
    ):

        value = address.get(key)

        if value:
            return value

    return ""


def _pick_mandal(address):
    """
    Pick the mandal / taluk / tehsil (India's revenue sub-district
    level). OpenStreetMap's address breakdown maps this level to
    "county" in most Indian data, with mandal/taluk/tehsil/
    subdistrict as direct-tag fallbacks when present.
    """

    for key in (
        "county",
        "mandal",
        "taluk",
        "tehsil",
        "subdistrict"
    ):

        value = address.get(key)

        if value:
            return value

    return ""


def _pick_district(address):
    """
    Pick the district — one level above the mandal. This is
    required to tell apart two same-named mandals that sit in
    different districts of the same state (e.g. Prathipadu
    mandal exists in more than one Andhra Pradesh district, as
    well as in Telangana).
    """

    for key in (
        "state_district",
        "district"
    ):

        value = address.get(key)

        if value:
            return value

    return ""


@app.route("/location-search")
def location_search():

    query = request.args.get(
        "query",
        ""
    ).strip()

    if not query:

        return jsonify({
            "error":
                "Please enter a location."
        }), 400

    url = (
        "https://nominatim.openstreetmap.org/search"
    )

    params = {

        "q": query,

        "format": "jsonv2",

        "addressdetails": 1,

        "limit": 10,

        # Bias/restrict results to India so village + mandal
        # predictions stay accurate for Indian administrative
        # naming (mandal/taluk terminology is India-specific).
        "countrycodes": "in"

    }

    headers = {

        "User-Agent":
            "WeatherGPT/1.0 (location-search)",

        "Accept-Language":
            "en"

    }

    try:

        response = requests.get(
            url,
            params=params,
            headers=headers,
            timeout=10
        )

        data = response.json()

        if response.status_code != 200:

            return jsonify({

                "error":
                    "Unable to search locations."

            }), response.status_code

        if not data:

            return jsonify({

                "error":
                    "No matching location found."

            }), 404

        locations = []

        for item in data:

            address = item.get(
                "address",
                {}
            ) or {}

            village = _pick_village(address)

            mandal = _pick_mandal(address)

            district = _pick_district(address)

            state = address.get(
                "state",
                ""
            )

            country = address.get(
                "country",
                ""
            )

            # Fallback so we always have a name to show, even
            # if OSM only returned a broad match.
            display_name = village or item.get(
                "name",
                ""
            ) or item.get(
                "display_name",
                ""
            ).split(",")[0].strip()

            # Avoid showing the same value twice (e.g. mandal == village)
            if mandal and mandal == display_name:
                mandal = ""

            # District often duplicates the mandal name (a mandal
            # is sometimes also its district's namesake town), so
            # only keep it when it adds new information.
            if district and district in (mandal, display_name):
                district = ""

            locations.append({

                "name":
                    display_name,

                "village":
                    village,

                "mandal":
                    mandal,

                "district":
                    district,

                "state":
                    state,

                "country":
                    country,

                "lat":
                    item.get(
                        "lat"
                    ),

                "lon":
                    item.get(
                        "lon"
                    )

            })

        return jsonify({

            "results":
                locations

        })

    except requests.exceptions.Timeout:

        return jsonify({

            "error":
                "Location search request timed out."

        }), 500

    except requests.exceptions.RequestException as e:

        print(
            "LOCATION SEARCH ERROR:",
            e
        )

        return jsonify({

            "error":
                "Unable to connect to location search service."

        }), 500

    except Exception as e:

        print(
            "LOCATION SEARCH ERROR:",
            e
        )

        return jsonify({

            "error":
                "Unexpected location search error."

        }), 500


# =========================================================
# WEATHER BY EXACT COORDINATES
# =========================================================

@app.route("/weather-coordinates")
def weather_coordinates():

    lat = request.args.get(
        "lat",
        ""
    ).strip()

    lon = request.args.get(
        "lon",
        ""
    ).strip()

    location_name = request.args.get(
        "location",
        "Selected Location"
    ).strip()

    if not lat or not lon:

        return jsonify({

            "error":
                "Latitude and longitude are required."

        }), 400

    if not WEATHER_API_KEY:

        return jsonify({

            "error":
                "Weather API key is missing."

        }), 500

    try:

        latitude = float(lat)

        longitude = float(lon)

        if not (
            -90 <= latitude <= 90
        ):

            return jsonify({

                "error":
                    "Invalid latitude."

            }), 400

        if not (
            -180 <= longitude <= 180
        ):

            return jsonify({

                "error":
                    "Invalid longitude."

            }), 400

        url = (
            "https://api.openweathermap.org/"
            "data/2.5/weather"
        )

        params = {

            "lat":
                latitude,

            "lon":
                longitude,

            "appid":
                WEATHER_API_KEY,

            "units":
                "metric"

        }

        response = requests.get(
            url,
            params=params,
            timeout=10
        )

        data = response.json()

        if response.status_code != 200:

            return jsonify({

                "error":
                    data.get(
                        "message",
                        "Unable to get weather information."
                    )

            }), response.status_code

        weather_data = data.get(
            "weather",
            [{}]
        )[0]

        main_data = data.get(
            "main",
            {}
        )

        wind_data = data.get(
            "wind",
            {}
        )

        clouds_data = data.get(
            "clouds",
            {}
        )

        coordinates = data.get(
            "coord",
            {}
        )

        system_data = data.get(
            "sys",
            {}
        )

        visibility_value = data.get(
            "visibility"
        )

        visibility_km = (

            visibility_value / 1000

            if visibility_value is not None

            else None

        )

        weather = {

            # Selected location name
            "city":
                location_name
                or data.get(
                    "name",
                    "Selected Location"
                ),

            # Actual OpenWeather city
            "weather_city":
                data.get(
                    "name",
                    ""
                ),

            "country":
                system_data.get(
                    "country",
                    ""
                ),

            "latitude":
                coordinates.get(
                    "lat",
                    latitude
                ),

            "longitude":
                coordinates.get(
                    "lon",
                    longitude
                ),

            "temperature":
                main_data.get(
                    "temp"
                ),

            "feels_like":
                main_data.get(
                    "feels_like"
                ),

            "humidity":
                main_data.get(
                    "humidity"
                ),

            "pressure":
                main_data.get(
                    "pressure"
                ),

            "wind_speed":
                wind_data.get(
                    "speed"
                ),

            "description":
                weather_data.get(
                    "description",
                    ""
                ),

            "condition":
                weather_data.get(
                    "main",
                    ""
                ),

            "visibility":
                visibility_km,

            "clouds":
                clouds_data.get(
                    "all"
                ),

            "icon":
                weather_data.get(
                    "icon",
                    ""
                )

        }

        return jsonify(weather)

    except ValueError:

        return jsonify({

            "error":
                "Latitude and longitude must be valid numbers."

        }), 400

    except requests.exceptions.Timeout:

        return jsonify({

            "error":
                "Weather API request timed out."

        }), 500

    except requests.exceptions.RequestException as e:

        print(
            "COORDINATE WEATHER ERROR:",
            e
        )

        return jsonify({

            "error":
                "Unable to connect to weather service."

        }), 500

    except Exception as e:

        print(
            "COORDINATE WEATHER ERROR:",
            e
        )

        return jsonify({

            "error":
                "Unexpected weather service error."

        }), 500


# =========================================================
# LANGUAGE NORMALIZER
# =========================================================

def normalize_language(language):

    language = str(
        language or "auto"
    ).strip().lower()

    if language in [
        "te",
        "te-in",
        "telugu"
    ]:

        return "te"

    if language in [
        "hi",
        "hi-in",
        "hindi"
    ]:

        return "hi"

    if language in [
        "en",
        "en-us",
        "en-in",
        "english"
    ]:

        return "en"

    return "auto"


# =========================================================
# GROQ AI FUNCTION
# =========================================================

def generate_groq_response(prompt):

    if not groq_client:

        return None, (
            "Groq API key is missing."
        )

    try:

        response = (
            groq_client
            .chat
            .completions
            .create(

                model="openai/gpt-oss-20b",

                messages=[

                    {
                        "role":
                            "system",

                        "content": """
You are WeatherGPT, an intelligent weather assistant.

Use only the live weather information provided by
the application.

You can answer questions related to:

- Weather
- Climate
- Weather conditions
- Forecast-related information
- Outdoor activities
- Travel weather conditions
- Weather-related health
- Weather-related clothing
- Weather safety

If the user asks something unrelated to weather,
politely explain that you are a weather assistant
and can help only with weather-related questions.

Never invent weather values.

Never create fake official warnings.

Never claim an official warning unless it is explicitly
provided by the application.

Give practical and concise advice.

Always follow the requested language exactly.
"""
                    },

                    {
                        "role":
                            "user",

                        "content":
                            prompt
                    }

                ],

                temperature=0.3,

                max_tokens=700

            )
        )

        if not response.choices:

            return None, (
                "Groq returned an empty response."
            )

        answer = (
            response
            .choices[0]
            .message
            .content
        )

        if not answer:

            return None, (
                "Groq returned empty content."
            )

        return answer.strip(), None

    except Exception as e:

        print("=" * 60)
        print("GROQ ERROR:")
        print(repr(e))
        print("=" * 60)

        return None, str(e)


# =========================================================
# BUILD WEATHER AI PROMPT
# =========================================================

def build_weather_ai_prompt(
    weather,
    question,
    language
):

    if language == "te":

        language_instruction = """
Answer completely in Telugu script.
Do not mix English or Hindi.
"""

    elif language == "hi":

        language_instruction = """
Answer completely in Hindi using Devanagari.
Do not mix English or Telugu.
"""

    elif language == "en":

        language_instruction = """
Answer completely in English.
"""

    else:

        language_instruction = """
Detect the user's language and answer in
the same language.
"""

    latitude = weather.get(
        "latitude",
        "N/A"
    )

    longitude = weather.get(
        "longitude",
        "N/A"
    )

    return f"""

You are WeatherGPT.

{language_instruction}

CITY:
{weather.get("city", "Unknown")}, {weather.get("country", "")}

EXACT LOCATION:

Latitude:
{latitude}

Longitude:
{longitude}

LIVE WEATHER:

Temperature:
{weather.get("temperature")} °C

Feels Like:
{weather.get("feels_like")} °C

Humidity:
{weather.get("humidity")} %

Wind:
{weather.get("wind_speed")} m/s

Pressure:
{weather.get("pressure")} hPa

Condition:
{weather.get("condition")}

Description:
{weather.get("description")}

Visibility:
{weather.get("visibility")} km

Cloudiness:
{weather.get("clouds")} %

USER QUESTION:

{question}

RULES:

1. Use only the supplied live weather data.
2. Never invent weather values.
3. Never create fake official warnings.
4. Give practical advice.
5. Keep the answer easy to understand.
6. Answer completely in the requested language.
7. Do not mix languages.
8. Stay focused on weather-related topics.
"""


# =========================================================
# AI CHAT - NORMAL CITY
# =========================================================

@app.route(
    "/ask",
    methods=["POST"]
)
def ask():

    if not groq_client:

        return jsonify({

            "error":
                "Groq API key is missing."

        }), 500

    data = request.get_json(
        silent=True
    )

    if not data:

        return jsonify({

            "error":
                "Invalid request."

        }), 400

    city = str(
        data.get(
            "city",
            ""
        )
    ).strip()

    question = str(
        data.get(
            "question",
            ""
        )
    ).strip()

    language = normalize_language(
        data.get(
            "language",
            "auto"
        )
    )

    if not city:

        return jsonify({

            "error":
                "Please search for a city first."

        }), 400

    if not question:

        return jsonify({

            "error":
                "Please enter or speak a question."

        }), 400

    weather, error = get_weather_data(
        city
    )

    if error:

        return jsonify({

            "error":
                error

        }), 400

    prompt = build_weather_ai_prompt(
        weather,
        question,
        language
    )

    answer, groq_error = (
        generate_groq_response(
            prompt
        )
    )

    if groq_error:

        return jsonify({

            "error":
                "Unable to generate AI response.",

            "details":
                groq_error

        }), 500

    return jsonify({

        "answer":
            answer,

        "weather":
            weather

    })


# =========================================================
# AI CHAT - EXACT COORDINATES
# =========================================================

@app.route(
    "/ask-coordinates",
    methods=["POST"]
)
def ask_coordinates():

    if not groq_client:

        return jsonify({

            "error":
                "Groq API key is missing."

        }), 500

    data = request.get_json(
        silent=True
    )

    if not data:

        return jsonify({

            "error":
                "Invalid request."

        }), 400

    try:

        lat = float(
            data.get("lat")
        )

        lon = float(
            data.get("lon")
        )

    except (
        TypeError,
        ValueError
    ):

        return jsonify({

            "error":
                "Valid latitude and longitude are required."

        }), 400

    if not (
        -90 <= lat <= 90
        and
        -180 <= lon <= 180
    ):

        return jsonify({

            "error":
                "Invalid latitude or longitude."

        }), 400

    question = str(
        data.get(
            "question",
            ""
        )
    ).strip()

    language = normalize_language(
        data.get(
            "language",
            "auto"
        )
    )

    location_name = str(
        data.get(
            "location",
            "Selected Location"
        )
    ).strip()

    if not question:

        return jsonify({

            "error":
                "Please enter or speak a question."

        }), 400

    weather, error = (
        get_weather_data_by_coordinates(
            lat,
            lon,
            location_name
        )
    )

    if error:

        return jsonify({

            "error":
                error

        }), 400

    prompt = build_weather_ai_prompt(
        weather,
        question,
        language
    )

    answer, groq_error = (
        generate_groq_response(
            prompt
        )
    )

    if groq_error:

        return jsonify({

            "error":
                "Unable to generate AI response.",

            "details":
                groq_error

        }), 500

    return jsonify({

        "answer":
            answer,

        "weather":
            weather

    })


# =========================================================
# SMART INSIGHTS - NORMAL CITY
# =========================================================

@app.route(
    "/insights",
    methods=["POST"]
)
def insights():

    print("\n")
    print("=" * 60)
    print("SMART INSIGHTS REQUEST")
    print("=" * 60)

    if not groq_client:

        print(
            "ERROR: Groq client not available."
        )

        return jsonify({

            "error":
                "Groq API key is missing."

        }), 500

    data = request.get_json(
        silent=True
    )

    print(
        "Request data:",
        data
    )

    if not data:

        return jsonify({

            "error":
                "Invalid request."

        }), 400

    city = str(
        data.get(
            "city",
            ""
        )
    ).strip()

    language_received = str(
        data.get(
            "language",
            "auto"
        )
    ).strip()

    language = normalize_language(
        language_received
    )

    print(
        "City:",
        city
    )

    print(
        "Language received:",
        language_received
    )

    print(
        "Language normalized:",
        language
    )

    if not city:

        return jsonify({

            "error":
                "Please search for a city first."

        }), 400

    weather, error = get_weather_data(
        city
    )

    if error:

        print(
            "Weather error:",
            error
        )

        return jsonify({

            "error":
                error

        }), 400

    print(
        "Weather successfully received."
    )

    if language == "te":

        language_instruction = """

IMPORTANT LANGUAGE REQUIREMENT:

Write ALL Smart Insights bullet points
completely in Telugu.

Use Telugu script.

Do NOT use English sentences.

Do NOT use Hindi sentences.

The section labels MUST remain exactly:

STATUS:
ALERT:
CLOTHING:
HEALTH:
TRAVEL:
"""

    elif language == "hi":

        language_instruction = """

IMPORTANT LANGUAGE REQUIREMENT:

Write ALL Smart Insights bullet points
completely in Hindi.

Use Devanagari script.

Do NOT use English sentences.

Do NOT use Telugu sentences.

The section labels MUST remain exactly:

STATUS:
ALERT:
CLOTHING:
HEALTH:
TRAVEL:
"""

    elif language == "en":

        language_instruction = """

IMPORTANT LANGUAGE REQUIREMENT:

Write ALL Smart Insights bullet points
completely in English.

The section labels MUST remain exactly:

STATUS:
ALERT:
CLOTHING:
HEALTH:
TRAVEL:
"""

    else:

        language_instruction = """

Write Smart Insights in English.

The section labels MUST remain exactly:

STATUS:
ALERT:
CLOTHING:
HEALTH:
TRAVEL:
"""

    prompt = f"""

You are WeatherGPT Smart Insights.

Analyze the LIVE weather data below.

{language_instruction}

CITY:
{weather["city"]}, {weather["country"]}

TEMPERATURE:
{weather["temperature"]} °C

FEELS LIKE:
{weather["feels_like"]} °C

HUMIDITY:
{weather["humidity"]} %

WIND:
{weather["wind_speed"]} m/s

PRESSURE:
{weather["pressure"]} hPa

CONDITION:
{weather["condition"]}

DESCRIPTION:
{weather["description"]}

VISIBILITY:
{weather["visibility"]} km

CLOUDINESS:
{weather["clouds"]} %

=========================================================
OUTPUT FORMAT
=========================================================

STATUS:

- Give one short weather summary.
- Give one important observation.
- Give one useful condition.

ALERT:

- Give one weather-related caution.
- Give one practical precaution.
- Give one additional caution only if justified.

CLOTHING:

- Give suitable clothing.
- Give one practical clothing suggestion.
- Give one optional suggestion.

HEALTH:

- Give hydration advice.
- Give one weather-related health precaution.
- Give one practical health suggestion.

TRAVEL:

- Give current travel suitability.
- Give outdoor activity advice.
- Give one practical travel suggestion.

=========================================================
STRICT RULES
=========================================================

1. Use ONLY the supplied live weather data.

2. Never invent weather values.

3. Never create fake official warnings.

4. Use exactly these section names:

STATUS:
ALERT:
CLOTHING:
HEALTH:
TRAVEL:

5. Put 2 or 3 bullet points under EACH section.

6. Every bullet must be SHORT.

7. Prefer fewer than 12 words per bullet.

8. Do not write paragraphs.

9. Do not add explanations.

10. Do not add sections before STATUS.

11. Do not add sections after TRAVEL.

12. Do not use Markdown headings such as ##.

13. Use "-" before every bullet.

14. Keep information practical.

15. Do not repeat the same information.

16. All bullet content MUST be written in the selected language.

17. Do NOT mix English, Hindi and Telugu.

18. If selected language is Telugu,
use Telugu script for every bullet.

19. If selected language is Hindi,
use Devanagari script for every bullet.

20. If selected language is English,
use English for every bullet.
"""

    print(
        "Sending Smart Insights request to Groq..."
    )

    insights_text, groq_error = (
        generate_groq_response(
            prompt
        )
    )

    if groq_error:

        print(
            "SMART INSIGHTS GROQ ERROR:",
            groq_error
        )

        return jsonify({

            "error":
                "Unable to generate insights.",

            "details":
                groq_error

        }), 500

    print(
        "Smart Insights generated successfully."
    )

    print(
        "Selected language:",
        language
    )

    print(
        "AI Response:"
    )

    print(
        insights_text
    )

    print(
        "=" * 60
    )

    return jsonify({

        "insights":
            insights_text,

        "language":
            language

    })


# =========================================================
# SMART INSIGHTS - EXACT COORDINATES
# =========================================================

@app.route(
    "/insights-coordinates",
    methods=["POST"]
)
def insights_coordinates():

    if not groq_client:

        return jsonify({

            "error":
                "Groq API key is missing."

        }), 500

    data = request.get_json(
        silent=True
    )

    if not data:

        return jsonify({

            "error":
                "Invalid request."

        }), 400

    try:

        lat = float(
            data.get("lat")
        )

        lon = float(
            data.get("lon")
        )

    except (
        TypeError,
        ValueError
    ):

        return jsonify({

            "error":
                "Valid latitude and longitude are required."

        }), 400

    if not (
        -90 <= lat <= 90
        and
        -180 <= lon <= 180
    ):

        return jsonify({

            "error":
                "Invalid latitude or longitude."

        }), 400

    language = normalize_language(
        data.get(
            "language",
            "auto"
        )
    )

    location_name = str(
        data.get(
            "location",
            "Selected Location"
        )
    ).strip()

    weather, error = (
        get_weather_data_by_coordinates(
            lat,
            lon,
            location_name
        )
    )

    if error:

        return jsonify({

            "error":
                error

        }), 400

    if language == "te":

        language_instruction = """

Write all bullet content completely
in Telugu script.

Do not mix English or Hindi.
"""

    elif language == "hi":

        language_instruction = """

Write all bullet content completely
in Hindi using Devanagari.

Do not mix English or Telugu.
"""

    elif language == "en":

        language_instruction = """

Write all bullet content completely
in English.
"""

    else:

        language_instruction = """

Detect the language of the user's
application and use English if unclear.
"""

    prompt = f"""

You are WeatherGPT Smart Insights.

{language_instruction}

CITY:
{weather["city"]}, {weather["country"]}

EXACT COORDINATES:

Latitude:
{weather["latitude"]}

Longitude:
{weather["longitude"]}

TEMPERATURE:
{weather["temperature"]} °C

FEELS LIKE:
{weather["feels_like"]} °C

HUMIDITY:
{weather["humidity"]} %

WIND:
{weather["wind_speed"]} m/s

PRESSURE:
{weather["pressure"]} hPa

CONDITION:
{weather["condition"]}

DESCRIPTION:
{weather["description"]}

VISIBILITY:
{weather["visibility"]} km

CLOUDINESS:
{weather["clouds"]} %

=========================================================
OUTPUT FORMAT
=========================================================

STATUS:

- Give one short weather summary.
- Give one important observation.
- Give one useful condition.

ALERT:

- Give one weather-related caution.
- Give one practical precaution.
- Give one additional caution only if justified.

CLOTHING:

- Give suitable clothing.
- Give one practical clothing suggestion.
- Give one optional suggestion.

HEALTH:

- Give hydration advice.
- Give one weather-related health precaution.
- Give one practical health suggestion.

TRAVEL:

- Give current travel suitability.
- Give outdoor activity advice.
- Give one practical travel suggestion.

=========================================================
STRICT RULES
=========================================================

1. Use ONLY the supplied live weather data.

2. Never invent weather values.

3. Never create fake official warnings.

4. Use exactly these section names:

STATUS:
ALERT:
CLOTHING:
HEALTH:
TRAVEL:

5. Put 2 or 3 bullet points under EACH section.

6. Every bullet must be SHORT.

7. Prefer fewer than 12 words per bullet.

8. Do not write paragraphs.

9. Do not add explanations.

10. Do not add sections before STATUS.

11. Do not add sections after TRAVEL.

12. Do not use Markdown headings such as ##.

13. Use "-" before every bullet.

14. Keep information practical.

15. Do not repeat the same information.

16. All bullet content MUST be written in the selected language.

17. Do NOT mix English, Hindi and Telugu.
"""

    insights_text, groq_error = (
        generate_groq_response(
            prompt
        )
    )

    if groq_error:

        return jsonify({

            "error":
                "Unable to generate insights.",

            "details":
                groq_error

        }), 500

    return jsonify({

        "insights":
            insights_text,

        "language":
            language

    })


# =========================================================
# GET WEATHER BY EXACT COORDINATES
# INTERNAL HELPER
# =========================================================

def get_weather_data_by_coordinates(
    lat,
    lon,
    location_name="Selected Location"
):

    if not WEATHER_API_KEY:

        return None, (
            "Weather API key is missing."
        )

    url = (
        "https://api.openweathermap.org/"
        "data/2.5/weather"
    )

    params = {

        "lat":
            lat,

        "lon":
            lon,

        "appid":
            WEATHER_API_KEY,

        "units":
            "metric"

    }

    try:

        response = requests.get(
            url,
            params=params,
            timeout=10
        )

        data = response.json()

        if response.status_code != 200:

            return None, data.get(
                "message",
                "Unable to get weather information."
            )

        visibility_value = data.get(
            "visibility"
        )

        weather = {

            "city":
                location_name
                or data.get(
                    "name",
                    "Selected Location"
                ),

            "weather_city":
                data.get(
                    "name",
                    ""
                ),

            "country":
                data.get(
                    "sys",
                    {}
                ).get(
                    "country",
                    ""
                ),

            "latitude":
                data.get(
                    "coord",
                    {}
                ).get(
                    "lat",
                    lat
                ),

            "longitude":
                data.get(
                    "coord",
                    {}
                ).get(
                    "lon",
                    lon
                ),

            "temperature":
                data.get(
                    "main",
                    {}
                ).get(
                    "temp"
                ),

            "feels_like":
                data.get(
                    "main",
                    {}
                ).get(
                    "feels_like"
                ),

            "humidity":
                data.get(
                    "main",
                    {}
                ).get(
                    "humidity"
                ),

            "pressure":
                data.get(
                    "main",
                    {}
                ).get(
                    "pressure"
                ),

            "wind_speed":
                data.get(
                    "wind",
                    {}
                ).get(
                    "speed"
                ),

            "description":
                data.get(
                    "weather",
                    [{}]
                )[0].get(
                    "description",
                    ""
                ),

            "condition":
                data.get(
                    "weather",
                    [{}]
                )[0].get(
                    "main",
                    ""
                ),

            "visibility":
                (
                    visibility_value / 1000
                    if visibility_value is not None
                    else None
                ),

            "clouds":
                data.get(
                    "clouds",
                    {}
                ).get(
                    "all"
                ),

            "icon":
                data.get(
                    "weather",
                    [{}]
                )[0].get(
                    "icon",
                    ""
                )
        }

        return weather, None

    except requests.exceptions.Timeout:

        return None, (
            "Weather API request timed out."
        )

    except requests.exceptions.RequestException as e:

        print(
            "Coordinate Weather Error:",
            e
        )

        return None, (
            "Unable to connect to weather service."
        )

    except Exception as e:

        print(
            "Coordinate Weather Error:",
            e
        )

        return None, (
            "Unexpected weather service error."
        )


# =========================================================
# WEATHER ANALYTICS - CITY COORDINATES
# =========================================================

def get_city_coordinates(city):

    """
    Use OpenWeather Geocoding API to convert
    a city/location name into coordinates.
    """

    if not WEATHER_API_KEY:

        return None, (
            "Weather API key is missing."
        )

    if not city:

        return None, (
            "Please enter a city name."
        )

    url = (
        "https://api.openweathermap.org/"
        "geo/1.0/direct"
    )

    params = {

        "q":
            city,

        "limit":
            1,

        "appid":
            WEATHER_API_KEY

    }

    try:

        response = requests.get(
            url,
            params=params,
            timeout=10
        )

        data = response.json()

        if response.status_code != 200:

            return None, data.get(
                "message",
                "Unable to find city coordinates."
            )

        if not data:

            return None, (
                "City not found."
            )

        return {

            "lat":
                data[0]["lat"],

            "lon":
                data[0]["lon"],

            "name":
                data[0]["name"],

            "state":
                data[0].get(
                    "state",
                    ""
                ),

            "country":
                data[0].get(
                    "country",
                    ""
                )

        }, None

    except requests.exceptions.Timeout:

        return None, (
            "Geocoding request timed out."
        )

    except requests.exceptions.RequestException as e:

        print(
            "Geocoding Error:",
            e
        )

        return None, (
            "Unable to connect to the geocoding service."
        )

    except Exception as e:

        print(
            "Geocoding Error:",
            e
        )

        return None, (
            "Unexpected geocoding error."
        )


# =========================================================
# NORMALIZE DAILY WEATHER SUMMARY
# =========================================================

def normalize_day_summary(
    data,
    date_value
):

    """
    Normalize OpenWeather One Call 3.0
    daily aggregation data for frontend.
    """

    temperature = data.get(
        "temperature",
        {}
    )

    humidity = data.get(
        "humidity",
        {}
    )

    pressure = data.get(
        "pressure",
        {}
    )

    wind = (
        data.get(
            "wind",
            {}
        )
        .get(
            "max",
            {}
        )
    )

    cloud_cover = data.get(
        "cloud_cover",
        {}
    )

    precipitation = data.get(
        "precipitation",
        {}
    )

    return {

        "date":
            date_value,

        "temperature":
            round(
                temperature.get(
                    "afternoon",
                    temperature.get(
                        "day",
                        temperature.get(
                            "min",
                            0
                        )
                    )
                ),
                1
            )
            if temperature
            else None,

        "min_temperature":
            round(
                temperature.get(
                    "min",
                    0
                ),
                1
            )
            if temperature
            else None,

        "max_temperature":
            round(
                temperature.get(
                    "max",
                    0
                ),
                1
            )
            if temperature
            else None,

        "humidity":
            humidity.get(
                "afternoon"
            ),

        "pressure":
            pressure.get(
                "afternoon"
            ),

        "wind_speed":
            wind.get(
                "speed"
            ),

        "precipitation":
            precipitation.get(
                "total",
                0
            ),

        "clouds":
            cloud_cover.get(
                "afternoon"
            ),

        "description":
            data.get(
                "summary"
            )
            or data.get(
                "weather_overview"
            )
            or "Weather data"

    }


# =========================================================
# OPENWEATHER ONE CALL 3.0 DAILY SUMMARY
# =========================================================

def get_day_summary(
    lat,
    lon,
    date_value
):

    """
    OpenWeather One Call 3.0 daily
    aggregation endpoint.
    """

    if not WEATHER_API_KEY:

        return None, (
            "Weather API key is missing."
        )

    url = (
        "https://api.openweathermap.org/"
        "data/3.0/onecall/day_summary"
    )

    params = {

        "lat":
            lat,

        "lon":
            lon,

        "date":
            date_value,

        "units":
            "metric",

        "appid":
            WEATHER_API_KEY

    }

    try:

        response = requests.get(
            url,
            params=params,
            timeout=15
        )

        try:

            data = response.json()

        except ValueError:

            data = {}

        if response.status_code != 200:

            message = data.get(
                "message",
                "Historical/daily aggregation data is unavailable."
            )

            return None, message

        return data, None

    except requests.exceptions.Timeout:

        return None, (
            "Historical weather request timed out."
        )

    except requests.exceptions.RequestException as e:

        print(
            "Daily Summary Error:",
            e
        )

        return None, (
            "Unable to connect to historical weather service."
        )


# =========================================================
# PREVIOUS 7 DAYS
# =========================================================

@app.route("/historical")
def historical():

    """
    Return previous 7 calendar days
    for the searched city.

    Requires OpenWeather One Call 3.0 /
    Daily Aggregation access.
    """

    city = request.args.get(
        "city",
        ""
    ).strip()

    if not city:

        return jsonify({

            "error":
                "Please search for a city first."

        }), 400

    location, error = (
        get_city_coordinates(
            city
        )
    )

    if error:

        return jsonify({

            "error":
                error

        }), 400

    today = datetime.now(
        timezone.utc
    ).date()

    rows = []

    errors = []

    for offset in range(
        7,
        0,
        -1
    ):

        date_value = (
            today
            -
            timedelta(
                days=offset
            )
        ).isoformat()

        try:

            data, api_error = (
                get_day_summary(
                    location["lat"],
                    location["lon"],
                    date_value
                )
            )

            if api_error:

                errors.append(
                    api_error
                )

                continue

            rows.append(
                normalize_day_summary(
                    data,
                    date_value
                )
            )

        except requests.exceptions.RequestException as e:

            errors.append(
                str(e)
            )

    if not rows:

        return jsonify({

            "error":
                "Historical weather is unavailable for this API key. "
                "Enable OpenWeather One Call 3.0 / Daily Aggregation access.",

            "details":
                errors[:1]

        }), 403

    return jsonify({

        "city":
            location["name"],

        "state":
            location.get(
                "state",
                ""
            ),

        "country":
            location["country"],

        "latitude":
            location["lat"],

        "longitude":
            location["lon"],

        "data":
            rows

    })


# =========================================================
# 5-DAY FORECAST
# =========================================================

@app.route("/forecast")
def forecast():

    """
    Return daily 5-day forecast from
    OpenWeather 5-day / 3-hour API.
    """

    city = request.args.get(
        "city",
        ""
    ).strip()

    if not city:

        return jsonify({

            "error":
                "Please search for a city first."

        }), 400

    if not WEATHER_API_KEY:

        return jsonify({

            "error":
                "Weather API key is missing."

        }), 500

    location, error = (
        get_city_coordinates(
            city
        )
    )

    if error:

        return jsonify({

            "error":
                error

        }), 400

    url = (
        "https://api.openweathermap.org/"
        "data/2.5/forecast"
    )

    params = {

        "lat":
            location["lat"],

        "lon":
            location["lon"],

        "appid":
            WEATHER_API_KEY,

        "units":
            "metric"

    }

    try:

        response = requests.get(
            url,
            params=params,
            timeout=15
        )

        data = response.json()

        if response.status_code != 200:

            return jsonify({

                "error":
                    data.get(
                        "message",
                        "Unable to get forecast information."
                    )

            }), response.status_code

        grouped = {}

        for item in data.get(
            "list",
            []
        ):

            date_key = (
                datetime
                .fromtimestamp(
                    item["dt"],
                    timezone.utc
                )
                .date()
                .isoformat()
            )

            group = grouped.setdefault(
                date_key,
                []
            )

            group.append(
                item
            )

        rows = []

        for date_key, items in list(
            grouped.items()
        )[:5]:

            temps = [

                float(
                    x["main"]["temp"]
                )

                for x in items

            ]

            humidities = [

                float(
                    x["main"]["humidity"]
                )

                for x in items

            ]

            winds = [

                float(
                    x.get(
                        "wind",
                        {}
                    ).get(
                        "speed",
                        0
                    )
                )

                for x in items

            ]

            rains = [

                float(
                    x.get(
                        "rain",
                        {}
                    ).get(
                        "3h",
                        0
                    )
                )

                for x in items

            ]

            clouds = [

                float(
                    x.get(
                        "clouds",
                        {}
                    ).get(
                        "all",
                        0
                    )
                )

                for x in items

            ]

            conditions = [

                x.get(
                    "weather",
                    [{}]
                )[0]

                for x in items

            ]

            dominant = (
                max(
                    conditions,
                    key=lambda w:
                        w.get(
                            "id",
                            0
                        )
                )
                if conditions
                else {}
            )

            rows.append({

                "date":
                    date_key,

                "temperature":
                    round(
                        sum(temps)
                        /
                        len(temps),
                        1
                    ),

                "min_temperature":
                    round(
                        min(temps),
                        1
                    ),

                "max_temperature":
                    round(
                        max(temps),
                        1
                    ),

                "humidity":
                    round(
                        sum(humidities)
                        /
                        len(humidities)
                    ),

                "wind_speed":
                    round(
                        sum(winds)
                        /
                        len(winds),
                        1
                    ),

                "precipitation":
                    round(
                        sum(rains),
                        1
                    ),

                "clouds":
                    round(
                        sum(clouds)
                        /
                        len(clouds)
                    ),

                "condition":
                    dominant.get(
                        "main",
                        ""
                    ),

                "description":
                    dominant.get(
                        "description",
                        ""
                    )

            })

        return jsonify({

            "city":
                location["name"],

            "state":
                location.get(
                    "state",
                    ""
                ),

            "country":
                location["country"],

            "latitude":
                location["lat"],

            "longitude":
                location["lon"],

            "data":
                rows

        })

    except requests.exceptions.Timeout:

        return jsonify({

            "error":
                "Forecast request timed out."

        }), 500

    except requests.exceptions.RequestException as e:

        print(
            "Forecast Error:",
            e
        )

        return jsonify({

            "error":
                "Unable to connect to forecast service."

        }), 500

    except Exception as e:

        print(
            "Forecast Error:",
            e
        )

        return jsonify({

            "error":
                "Unexpected forecast service error."

        }), 500


# =========================================================
# RUN APPLICATION
# =========================================================

if __name__ == "__main__":

    app.run(
        debug=True
    )