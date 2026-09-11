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
    groq_client = Groq(api_key=GROQ_API_KEY)

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

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q": city, "appid": WEATHER_API_KEY, "units": "metric"}

    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()

        if response.status_code != 200:
            return None, data.get("message", "Unable to get weather information.")

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
            "visibility": data.get("visibility", 0) / 1000,
            "clouds": data["clouds"]["all"],
            "icon": data["weather"][0].get("icon", "")
        }
        return weather, None
    except Exception as e:
        return None, str(e)

@app.route("/weather")
def weather():
    city = request.args.get("city", "").strip()
    data, error = get_weather_data(city)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(data)

# =========================================================
# LOCATION SEARCH - OSM NOMINATIM
# =========================================================

def _pick_village(address):
    for key in ("village", "hamlet", "town", "suburb", "city_district", "city"):
        value = address.get(key)
        if value:
            return value
    return ""

def _pick_mandal(address):
    for key in ("county", "mandal", "taluk", "tehsil", "subdistrict"):
        value = address.get(key)
        if value:
            return value
    return ""

def _pick_district(address):
    for key in ("state_district", "district"):
        value = address.get(key)
        if value:
            return value
    return ""

@app.route("/location-search")
def location_search():
    query = request.args.get("query", "").strip()
    if not query:
        return jsonify({"error": "Please enter a location."}), 400

    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": query,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": 10,
        "countrycodes": "in"
    }
    headers = {
        "User-Agent": "WeatherGPT/1.0 (location-search)",
        "Accept-Language": "en"
    }

    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)
        data = response.json()

        if response.status_code != 200 or not data:
            return jsonify({"results": []})

        locations = []
        for item in data:
            address = item.get("address", {}) or {}
            village = _pick_village(address)
            mandal = _pick_mandal(address)
            district = _pick_district(address)

            display_name = village or item.get("name", "") or item.get("display_name", "").split(",")[0].strip()

            if mandal and mandal == display_name:
                mandal = ""
            if district and district in (mandal, display_name):
                district = ""

            locations.append({
                "name": display_name,
                "village": village,
                "mandal": mandal,
                "district": district,
                "state": address.get("state", ""),
                "country": address.get("country", ""),
                "lat": item.get("lat"),
                "lon": item.get("lon")
            })

        return jsonify({"results": locations})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =========================================================
# WEATHER BY EXACT COORDINATES
# =========================================================

def get_weather_data_by_coordinates(lat, lon, location_name="Selected Location"):
    if not WEATHER_API_KEY:
        return None, "Weather API key is missing."

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"lat": lat, "lon": lon, "appid": WEATHER_API_KEY, "units": "metric"}

    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        if response.status_code != 200:
            return None, data.get("message", "Unable to get weather information.")

        weather = {
            "city": location_name or data.get("name", "Selected Location"),
            "weather_city": data.get("name", ""),
            "country": data.get("sys", {}).get("country", ""),
            "latitude": lat,
            "longitude": lon,
            "temperature": data.get("main", {}).get("temp"),
            "feels_like": data.get("main", {}).get("feels_like"),
            "humidity": data.get("main", {}).get("humidity"),
            "pressure": data.get("main", {}).get("pressure"),
            "wind_speed": data.get("wind", {}).get("speed"),
            "description": data.get("weather", [{}])[0].get("description", ""),
            "condition": data.get("weather", [{}])[0].get("main", ""),
            "visibility": (data.get("visibility", 0) / 1000) if data.get("visibility") else None,
            "clouds": data.get("clouds", {}).get("all"),
            "icon": data.get("weather", [{}])[0].get("icon", "")
        }
        return weather, None
    except Exception as e:
        return None, str(e)

@app.route("/weather-coordinates")
def weather_coordinates():
    lat = request.args.get("lat", "").strip()
    lon = request.args.get("lon", "").strip()
    location_name = request.args.get("location", "Selected Location").strip()

    try:
        weather, error = get_weather_data_by_coordinates(float(lat), float(lon), location_name)
        if error:
            return jsonify({"error": error}), 400
        return jsonify(weather)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# =========================================================
# LANGUAGE NORMALIZER
# =========================================================

def normalize_language(language):
    lang = str(language or "auto").strip().lower()
    if lang in ["te", "te-in", "telugu"]:
        return "te"
    if lang in ["hi", "hi-in", "hindi"]:
        return "hi"
    if lang in ["en", "en-us", "en-in", "english"]:
        return "en"
    return "en"

# =========================================================
# GROQ AI ENGINE
# =========================================================

def generate_groq_response(prompt):
    if not groq_client:
        return None, "Groq API key is missing."
    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {
                    "role": "system",
                    "content": "You are WeatherGPT, a knowledgeable weather assistant. Provide exact answers strictly adhering to the requested target language."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=700
        )
        if not response.choices:
            return None, "Groq returned empty response."
        return response.choices[0].message.content.strip(), None
    except Exception as e:
        return None, str(e)

# =========================================================
# AI CHAT - WEBSPEECH / PROMPT
# =========================================================

@app.route("/ask", methods=["POST"])
def ask():
    if not groq_client:
        return jsonify({"error": "Groq API key is missing."}), 500

    data = request.get_json(silent=True) or {}
    city = str(data.get("city", "")).strip()
    question = str(data.get("question", "")).strip()
    language = normalize_language(data.get("language", "en"))

    if not city:
        return jsonify({"error": "Please search for a city first."}), 400
    if not question:
        return jsonify({"error": "Please enter or speak a question."}), 400

    weather, error = get_weather_data(city)
    if error:
        return jsonify({"error": error}), 400

    lang_instr = "Answer completely in fluent English."
    if language == "te":
        lang_instr = "Answer completely in pure Telugu script (తెలుగు). Do not use English words."
    elif language == "hi":
        lang_instr = "Answer completely in pure Hindi using Devanagari script (हिन्दी). Do not use English words."

    prompt = f"""You are WeatherGPT. {lang_instr}
Live Weather in {weather['city']}: {weather['temperature']}°C, Feels like {weather['feels_like']}°C, Condition {weather['condition']} ({weather['description']}), Humidity {weather['humidity']}%, Wind {weather['wind_speed']} m/s.
User Question: {question}"""

    answer, groq_error = generate_groq_response(prompt)
    if groq_error:
        return jsonify({"error": "AI service unavailable", "details": groq_error}), 500

    return jsonify({"answer": answer, "weather": weather})

@app.route("/ask-coordinates", methods=["POST"])
def ask_coordinates():
    data = request.get_json(silent=True) or {}
    lat = float(data.get("lat", 0))
    lon = float(data.get("lon", 0))
    loc = str(data.get("location", "Selected Location"))
    question = str(data.get("question", "")).strip()
    language = normalize_language(data.get("language", "en"))

    weather, error = get_weather_data_by_coordinates(lat, lon, loc)
    if error:
        return jsonify({"error": error}), 400

    lang_instr = "Answer completely in fluent English."
    if language == "te":
        lang_instr = "Answer completely in pure Telugu script (తెలుగు). Do not use English words."
    elif language == "hi":
        lang_instr = "Answer completely in pure Hindi using Devanagari script (हिन्दी). Do not use English words."

    prompt = f"""You are WeatherGPT. {lang_instr}
Live Weather in {weather['city']}: {weather['temperature']}°C, Feels like {weather['feels_like']}°C, Condition {weather['condition']}, Humidity {weather['humidity']}%, Wind {weather['wind_speed']} m/s.
User Question: {question}"""

    answer, groq_error = generate_groq_response(prompt)
    if groq_error:
        return jsonify({"error": "AI service unavailable"}), 500

    return jsonify({"answer": answer, "weather": weather})

# =========================================================
# SMART INSIGHTS & PRECAUTIONS (MULTILINGUAL)
# =========================================================

def build_insights_prompt(weather, language):
    if language == "te":
        lang_directive = """
CRITICAL REQUIREMENT:
Write EVERY bullet point strictly in TELUGU script (తెలుగు).
Do NOT output any English sentences.
Provide practical weather precautions and safety guidance in Telugu.
The 5 section headers MUST be:
STATUS:
ALERT:
CLOTHING:
HEALTH:
TRAVEL:
"""
    elif language == "hi":
        lang_directive = """
CRITICAL REQUIREMENT:
Write EVERY bullet point strictly in HINDI using Devanagari script (हिन्दी).
Do NOT output any English sentences.
Provide practical weather precautions and safety guidance in Hindi.
The 5 section headers MUST be:
STATUS:
ALERT:
CLOTHING:
HEALTH:
TRAVEL:
"""
    else:
        lang_directive = """
Write every bullet point in clear, practical English.
The 5 section headers MUST be:
STATUS:
ALERT:
CLOTHING:
HEALTH:
TRAVEL:
"""

    return f"""
Analyze the live weather data below and generate short, practical recommendations and precautions.
{lang_directive}

CITY: {weather.get('city', 'Selected Location')}, {weather.get('country', '')}
TEMP: {weather.get('temperature')} °C (Feels like: {weather.get('feels_like')} °C)
CONDITION: {weather.get('condition')} ({weather.get('description')})
HUMIDITY: {weather.get('humidity')}% | WIND: {weather.get('wind_speed')} m/s

FORMAT:
STATUS:
- Short overview observation
- Sky/condition note

ALERT:
- Immediate safety precaution
- Weather warning or hazard note

CLOTHING:
- Appropriate clothing advice
- Footwear/accessory suggestion

HEALTH:
- Hydration advice
- Health protection precaution

TRAVEL:
- Outdoor commute or activity advice
- Travel safety suggestion

RULES:
- Provide 2 or 3 short bullet points per section starting with "-".
- Do not use markdown headings like "##".
- Adhere strictly to the target language script.
"""

@app.route("/insights", methods=["POST"])
def insights():
    data = request.get_json(silent=True) or {}
    city = str(data.get("city", "")).strip()
    language = normalize_language(data.get("language", "en"))

    if not city:
        return jsonify({"error": "Please search for a city first."}), 400

    weather, error = get_weather_data(city)
    if error:
        return jsonify({"error": error}), 400

    prompt = build_insights_prompt(weather, language)
    insights_text, groq_error = generate_groq_response(prompt)

    if groq_error:
        return jsonify({"error": "Unable to generate insights"}), 500

    return jsonify({"insights": insights_text, "language": language})

@app.route("/insights-coordinates", methods=["POST"])
def insights_coordinates():
    data = request.get_json(silent=True) or {}
    lat = float(data.get("lat", 0))
    lon = float(data.get("lon", 0))
    location_name = str(data.get("location", "Selected Location"))
    language = normalize_language(data.get("language", "en"))

    weather, error = get_weather_data_by_coordinates(lat, lon, location_name)
    if error:
        return jsonify({"error": error}), 400

    prompt = build_insights_prompt(weather, language)
    insights_text, groq_error = generate_groq_response(prompt)

    if groq_error:
        return jsonify({"error": "Unable to generate insights"}), 500

    return jsonify({"insights": insights_text, "language": language})

# =========================================================
# WEATHER ANALYTICS: PREVIOUS 7 DAYS (WITH OPEN-METEO FALLBACK)
# =========================================================

def get_city_coordinates(city):
    if not WEATHER_API_KEY:
        return None, "Weather API key is missing."
    url = "https://api.openweathermap.org/geo/1.0/direct"
    try:
        res = requests.get(url, params={"q": city, "limit": 1, "appid": WEATHER_API_KEY}, timeout=10)
        data = res.json()
        if not data:
            return None, "City not found."
        return {"lat": data[0]["lat"], "lon": data[0]["lon"], "name": data[0]["name"], "country": data[0].get("country", "")}, None
    except Exception as e:
        return None, str(e)

@app.route("/historical")
def historical():
    city = request.args.get("city", "").strip()
    lat = request.args.get("lat")
    lon = request.args.get("lon")

    loc_name = city
    loc_country = ""

    if lat and lon:
        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except ValueError:
            return jsonify({"error": "Invalid coordinates"}), 400
    else:
        if not city:
            return jsonify({"error": "Please search for a city first."}), 400
        loc, err = get_city_coordinates(city)
        if err:
            return jsonify({"error": err}), 400
        lat_f = loc["lat"]
        lon_f = loc["lon"]
        loc_name = loc["name"]
        loc_country = loc["country"]

    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat_f,
            "longitude": lon_f,
            "daily": "temperature_2m_max,temperature_2m_min,temperature_2m_mean,relative_humidity_2m_mean,wind_speed_10m_max,precipitation_sum,weather_code",
            "past_days": 7,
            "forecast_days": 1,
            "timezone": "auto"
        }
        res = requests.get(url, params=params, timeout=12).json()
        daily = res.get("daily", {})
        times = daily.get("time", [])

        rows = []
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        wmo_codes = {
            0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
            55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
            71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 80: "Rain showers",
            95: "Thunderstorm"
        }

        for i, d in enumerate(times):
            if d < now_str:
                max_t = daily["temperature_2m_max"][i]
                min_t = daily["temperature_2m_min"][i]
                avg_t = daily["temperature_2m_mean"][i] if "temperature_2m_mean" in daily and daily["temperature_2m_mean"][i] is not None else round((max_t + min_t) / 2, 1)
                w_code = daily.get("weather_code", [0])[i]

                rows.append({
                    "date": d,
                    "temperature": avg_t,
                    "min_temperature": min_t,
                    "max_temperature": max_t,
                    "humidity": round(daily["relative_humidity_2m_mean"][i]),
                    "wind_speed": round(daily["wind_speed_10m_max"][i], 1),
                    "precipitation": round(daily["precipitation_sum"][i], 1),
                    "condition": "Clear" if w_code < 3 else "Rain" if w_code in [51,53,55,61,63,65,80] else "Cloudy",
                    "description": wmo_codes.get(w_code, "Normal weather conditions")
                })

        return jsonify({
            "city": loc_name,
            "country": loc_country,
            "data": rows[-7:]
        })
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve historical weather: {str(e)}"}), 500

# =========================================================
# WEATHER ANALYTICS: 5-DAY FORECAST
# =========================================================

@app.route("/forecast")
def forecast():
    city = request.args.get("city", "").strip()
    lat = request.args.get("lat")
    lon = request.args.get("lon")

    if lat and lon:
        try:
            lat_f = float(lat)
            lon_f = float(lon)
            loc_name = city or "Selected Location"
            loc_country = ""
        except ValueError:
            return jsonify({"error": "Invalid coordinates"}), 400
    else:
        if not city:
            return jsonify({"error": "Please search for a city first."}), 400
        loc, error = get_city_coordinates(city)
        if error:
            return jsonify({"error": error}), 400
        lat_f = loc["lat"]
        lon_f = loc["lon"]
        loc_name = loc["name"]
        loc_country = loc["country"]

    url = "https://api.openweathermap.org/data/2.5/forecast"
    params = {"lat": lat_f, "lon": lon_f, "appid": WEATHER_API_KEY, "units": "metric"}

    try:
        response = requests.get(url, params=params, timeout=12)
        data = response.json()

        if response.status_code != 200:
            return jsonify({"error": data.get("message", "Unable to get forecast.")}), response.status_code

        grouped = {}
        for item in data.get("list", []):
            date_key = datetime.fromtimestamp(item["dt"], timezone.utc).date().isoformat()
            grouped.setdefault(date_key, []).append(item)

        rows = []
        for date_key, items in list(grouped.items())[:5]:
            temps = [float(x["main"]["temp"]) for x in items]
            humidities = [float(x["main"]["humidity"]) for x in items]
            winds = [float(x.get("wind", {}).get("speed", 0)) for x in items]
            rains = [float(x.get("rain", {}).get("3h", 0)) for x in items]
            conditions = [x.get("weather", [{}])[0] for x in items]
            dominant = max(conditions, key=lambda w: w.get("id", 0)) if conditions else {}

            rows.append({
                "date": date_key,
                "temperature": round(sum(temps) / len(temps), 1),
                "min_temperature": round(min(temps), 1),
                "max_temperature": round(max(temps), 1),
                "humidity": round(sum(humidities) / len(humidities)),
                "wind_speed": round(sum(winds) / len(winds), 1),
                "precipitation": round(sum(rains), 1),
                "condition": dominant.get("main", ""),
                "description": dominant.get("description", "")
            })

        return jsonify({
            "city": loc_name,
            "country": loc_country,
            "data": rows
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
