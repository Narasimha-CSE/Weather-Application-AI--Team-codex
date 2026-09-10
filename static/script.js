document.addEventListener("DOMContentLoaded", () => {
    let currentWeather = null;
    let recognition = null;
    let isListening = false;
    let speechEnabled = true;
    let insightsRequestId = 0;
    let locationSearchTimer = null;
    let locationSearchController = null;
    let selectedLocation = null;

    /* =========================================================
       DOM ELEMENTS
    ========================================================= */

    const cityInput = document.getElementById("cityInput");
    const searchBtn = document.getElementById("searchBtn");
    const locationResults = document.getElementById("locationResults");
    const weatherScene = document.getElementById("weatherScene");
    const sceneStatus = document.getElementById("sceneStatus");

    const rainLayer = document.getElementById("rainLayer");
    const snowLayer = document.getElementById("snowLayer");
    const fogLayer = document.getElementById("fogLayer");
    const heatLayer = document.getElementById("heatLayer");

    const cityName = document.getElementById("cityName");
    const weatherIcon = document.getElementById("weatherIcon");
    const temperature = document.getElementById("temperature");
    const feelsLike = document.getElementById("feelsLike");
    const humidity = document.getElementById("humidity");
    const wind = document.getElementById("wind");
    const pressure = document.getElementById("pressure");
    const visibility = document.getElementById("visibility");
    const clouds = document.getElementById("clouds");
    const description = document.getElementById("description");

    const errorBox = document.getElementById("error");

    const chatContainer = document.getElementById("chatContainer");
    const questionInput = document.getElementById("questionInput");
    const sendBtn = document.getElementById("sendBtn");
    const micBtn = document.getElementById("micBtn");

    const languageSelect = document.getElementById("languageSelect");
    const voiceStatus = document.getElementById("voiceStatus");
    const typingIndicator = document.getElementById("typingIndicator");

    const insightStatus = document.getElementById("insightStatus");
    const insightAlert = document.getElementById("insightAlert");
    const insightClothing = document.getElementById("insightClothing");
    const insightHealth = document.getElementById("insightHealth");
    const insightTravel = document.getElementById("insightTravel");

    /* =========================================================
       TRANSLATIONS
    ========================================================= */

    const translations = {
        en: {
            brandSubtitle: "AI Weather Intelligence",
            liveWeather: "Live Weather",
            heroTag: "AI-POWERED WEATHER",
            heroTitle: "Understand the Weather Around You.",
            heroDescription: "Get real-time weather information, AI-powered insights, and personalized weather guidance.",
            search: "Search",
            loading: "Loading...",
            enterCity: "Please enter a city name.",
            searchFirst: "Please search for a city first.",
            enterQuestion: "Please enter or speak a question.",
            searchCity: "Search a city",
            searchWeatherDescription: "Search for a city to view weather.",
            currentWeather: "CURRENT WEATHER",
            feelsLike: "FEELS LIKE",
            humidity: "HUMIDITY",
            wind: "WIND",
            pressure: "PRESSURE",
            visibility: "VISIBILITY",
            cloudiness: "CLOUDINESS",
            weatherOverview: "Weather Overview",
            overviewDefault: "Search for a city to get live weather information.",
            overviewText: "Currently {temp}°C with {description}. Feels like {feels}°C with {humidity}% humidity.",
            aiWeather: "WeatherGPT AI",
            poweredBy: "Powered by Groq",
            online: "Online",
            welcome: "Hello! I'm WeatherGPT. Ask me anything about the weather.",
            thinking: "WeatherGPT is thinking...",
            voiceReady: "Voice ready",
            voiceInput: "Voice input",
            sendMessage: "Send message",
            askQuestion: "Ask WeatherGPT...",
            analysis: "AI WEATHER ANALYSIS",
            smartInsights: "Smart Insights",
            status: "Status",
            alert: "Alert",
            clothing: "Clothing",
            health: "Health",
            travel: "Travel",
            footer: "WeatherGPT • AI-Powered Weather Intelligence",
            weatherAssistant: "WeatherGPT is a weather assistant. Please ask a weather-related question.",
            aiError: "Sorry, I couldn't generate a response right now.",
            weatherUnavailable: "Unable to fetch weather information.",
            serverInvalid: "Server returned an invalid response.",
            liveAnimation: "Live Weather Animation",
            thunderstorm: "⛈️ Thunderstorm conditions",
            rain: "🌧️ Rain detected",
            snow: "❄️ Snow conditions",
            mist: "🌫️ Misty atmosphere",
            hot: "🔥 High temperature",
            cold: "❄️ Cool atmosphere",
            clouds: "☁️ Cloudy conditions",
            clear: "☀️ Clear weather",
            listening: "🎤 Listening... Speak now",
            recognized: "Voice recognized",
            languageChanged: "Language changed to English",
            voiceUnsupported: "Voice recognition not supported",
            microphoneDenied: "🎤 Microphone permission denied. Please allow mic in browser settings.",
            noSpeech: "No speech detected",
            microphoneUnavailable: "Microphone unavailable",
            voiceNetwork: "Voice network error",
            voiceStopped: "Voice recognition stopped",
            analyzing: "Analyzing weather...",
            noInformation: "No additional information.",
            analysisUnavailable: "Weather analysis unavailable.",
            userLabel: "You"
        },
        te: {
            brandSubtitle: "AI వాతావరణ సమాచారం",
            liveWeather: "ప్రత్యక్ష వాతావరణం",
            heroTag: "AI ఆధారిత వాతావరణం",
            heroTitle: "మీ చుట్టూ ఉన్న వాతావరణాన్ని అర్థం చేసుకోండి.",
            heroDescription: "తాజా వాతావరణ సమాచారం, AI ఆధారిత విశ్లేషణలు మరియు వ్యక్తిగత వాతావరణ సూచనలను పొందండి.",
            search: "శోధించండి",
            loading: "లోడ్ అవుతోంది...",
            enterCity: "దయచేసి నగరం పేరును నమోదు చేయండి.",
            searchFirst: "ముందుగా ఒక నగరాన్ని శోధించండి.",
            enterQuestion: "దయచేసి ప్రశ్నను టైప్ చేయండి లేదా మాట్లాడండి.",
            searchCity: "నగరాన్ని శోధించండి",
            searchWeatherDescription: "వాతావరణాన్ని చూడటానికి నగరాన్ని శోధించండి.",
            currentWeather: "ప్రస్తుత వాతావరణం",
            feelsLike: "అనుభూతి ఉష్ణోగ్రత",
            humidity: "తేమ",
            wind: "గాలి",
            pressure: "వాయు పీడనం",
            visibility: "దృశ్యమానత",
            cloudiness: "మేఘావృతం",
            weatherOverview: "వాతావరణ అవలోకనం",
            overviewDefault: "ప్రత్యక్ష వాతావరణ సమాచారాన్ని పొందడానికి నగరాన్ని శోధించండి.",
            overviewText: "ప్రస్తుతం {temp}°C ఉష్ణోగ్రతతో {description} ఉంది. అనుభూతి ఉష్ణోగ్రత {feels}°C, తేమ {humidity}%.",
            aiWeather: "WeatherGPT AI",
            poweredBy: "Groq ద్వారా ఆధారితం",
            online: "ఆన్‌లైన్",
            welcome: "నమస్కారం! నేను WeatherGPT. వాతావరణం గురించి ఏదైనా అడగండి.",
            thinking: "WeatherGPT ఆలోచిస్తోంది...",
            voiceReady: "వాయిస్ సిద్ధంగా ఉంది",
            voiceInput: "వాయిస్ ఇన్‌పుట్",
            sendMessage: "సందేశాన్ని పంపండి",
            askQuestion: "WeatherGPTని వాతావరణం గురించి అడగండి...",
            analysis: "AI వాతావరణ విశ్లేషణ",
            smartInsights: "స్మార్ట్ విశ్లేషణలు",
            status: "స్థితి",
            alert: "హెచ్చరిక",
            clothing: "దుస్తులు",
            health: "ఆరోగ్యం",
            travel: "ప్రయాణం",
            footer: "WeatherGPT • AI ఆధారిత వాతావరణ సమాచారం",
            weatherAssistant: "WeatherGPT ఒక వాతావరణ సహాయకుడు. దయచేసి వాతావరణానికి సంబంధించిన ప్రశ్న అడగండి.",
            aiError: "క్షమించండి, ప్రస్తుతం సమాధానం ఇవ్వలేకపోయాను.",
            weatherUnavailable: "వాతావరణ సమాచారాన్ని పొందలేకపోయాము.",
            serverInvalid: "సర్వర్ నుండి చెల్లని సమాచారం వచ్చింది.",
            liveAnimation: "ప్రత్యక్ష వాతావరణ యానిమేషన్",
            thunderstorm: "⛈️ ఉరుములతో కూడిన వర్షం",
            rain: "🌧️ వర్షం గుర్తించబడింది",
            snow: "❄️ మంచు పరిస్థితులు",
            mist: "🌫️ పొగమంచు వాతావరణం",
            hot: "🔥 అధిక ఉష్ణోగ్రత",
            cold: "❄️ చల్లని వాతావరణం",
            clouds: "☁️ మేఘావృతమైన వాతావరణం",
            clear: "☀️ ఆకాశం నిర్మలంగా ఉంది",
            listening: "🎤 వింటున్నాను... మాట్లాడండి",
            recognized: "వాయిస్ గుర్తించబడింది",
            languageChanged: "భాష తెలుగులోకి మార్చబడింది",
            voiceUnsupported: "వాయిస్ గుర్తింపు ఈ బ్రౌజర్‌లో అందుబాటులో లేదు",
            microphoneDenied: "🎤 మైక్రోఫోన్ అనుమతి నిరాకరించబడింది",
            noSpeech: "వాయిస్ గుర్తించబడలేదు",
            microphoneUnavailable: "మైక్రోఫోన్ అందుబాటులో లేదు",
            voiceNetwork: "వాయిస్ నెట్‌వర్క్ లోపం",
            voiceStopped: "వాయిస్ గుర్తింపు ఆపబడింది",
            analyzing: "వాతావరణాన్ని విశ్లేషిస్తోంది...",
            noInformation: "అదనపు సమాచారం అందుబాటులో లేదు.",
            analysisUnavailable: "వాతావరణ విశ్లేషణ అందుబాటులో లేదు.",
            userLabel: "మీరు"
        },
        hi: {
            brandSubtitle: "AI मौसम जानकारी",
            liveWeather: "लाइव मौसम",
            heroTag: "AI-संचालित मौसम",
            heroTitle: "अपने आसपास के मौसम को समझें।",
            heroDescription: "रीयल-टाइम मौसम जानकारी, AI आधारित विश्लेषण और व्यक्तिगत मौसम सुझाव प्राप्त करें।",
            search: "खोजें",
            loading: "लोड हो रहा है...",
            enterCity: "कृपया शहर का नाम दर्ज करें।",
            searchFirst: "कृपया पहले किसी शहर को खोजें।",
            enterQuestion: "कृपया प्रश्न लिखें या बोलें।",
            searchCity: "शहर खोजें",
            searchWeatherDescription: "मौसम देखने के लिए किसी शहर को खोजें।",
            currentWeather: "वर्तमान मौसम",
            feelsLike: "महसूस होने वाला तापमान",
            humidity: "नमी",
            wind: "हवा",
            pressure: "वायुदाब",
            visibility: "दृश्यता",
            cloudiness: "बादल",
            weatherOverview: "मौसम अवलोकन",
            overviewDefault: "लाइव मौसम की जानकारी प्राप्त करने के लिए किसी शहर को खोजें।",
            overviewText: "अभी तापमान {temp}°C है और {description} है। महसूस होने वाला तापमान {feels}°C है और नमी {humidity}% है।",
            aiWeather: "WeatherGPT AI",
            poweredBy: "Groq द्वारा संचालित",
            online: "ऑनलाइन",
            welcome: "नमस्ते! मैं WeatherGPT हूँ। मौसम के बारे में कुछ भी पूछें।",
            thinking: "WeatherGPT सोच रहा है...",
            voiceReady: "वॉयस तैयार है",
            voiceInput: "वॉयस इनपुट",
            sendMessage: "संदेश भेजें",
            askQuestion: "WeatherGPT से मौसम के बारे में पूछें...",
            analysis: "AI मौसम विश्लेषण",
            smartInsights: "स्मार्ट विश्लेषण",
            status: "स्थिति",
            alert: "चेतावनी",
            clothing: "कपड़े",
            health: "स्वास्थ्य",
            travel: "यात्रा",
            footer: "WeatherGPT • AI-संचालित मौसम जानकारी",
            weatherAssistant: "WeatherGPT एक मौसम सहायक है। कृपया मौसम से संबंधित प्रश्न पूछें।",
            aiError: "क्षमा करें, मैं अभी उत्तर नहीं दे सका।",
            weatherUnavailable: "मौसम की जानकारी प्राप्त नहीं की जा सकी।",
            serverInvalid: "सर्वर से अमान्य प्रतिक्रिया प्राप्त हुई।",
            liveAnimation: "लाइव मौसम एनीमेशन",
            thunderstorm: "⛈️ गरज के साथ बारिश",
            rain: "🌧️ बारिश का पता चला",
            snow: "❄️ बर्फबारी की स्थिति",
            mist: "🌫️ धुंध वाला मौसम",
            hot: "🔥 उच्च तापमान",
            cold: "❄️ ठंडा मौसम",
            clouds: "☁️ बादल छाए हुए हैं",
            clear: "☀️ साफ मौसम",
            listening: "🎤 सुन रहा हूँ... बोलिए",
            recognized: "आवाज़ पहचानी गई",
            languageChanged: "भाषा हिंदी में बदल दी गई है",
            voiceUnsupported: "इस ब्राउज़र में वॉयस पहचान उपलब्ध नहीं है",
            microphoneDenied: "🎤 माइक्रोफ़ोन की अनुमति नहीं है",
            noSpeech: "कोई आवाज़ नहीं मिली",
            microphoneUnavailable: "माइक्रोफ़ोन उपलब्ध नहीं है",
            voiceNetwork: "वॉयस नेटवर्क त्रुटि",
            voiceStopped: "वॉयस पहचान बंद कर दी गई",
            analyzing: "मौसम का विश्लेषण किया जा रहा है...",
            noInformation: "अतिरिक्त जानकारी उपलब्ध नहीं है।",
            analysisUnavailable: "मौसम विश्लेषण उपलब्ध नहीं है।",
            userLabel: "आप"
        }
    };

    /* =========================================================
       WEATHER DESCRIPTION TRANSLATION
    ========================================================= */

    const weatherTranslations = {
        en: {
            "clear sky": "Clear sky", "few clouds": "Few clouds", "scattered clouds": "Scattered clouds",
            "broken clouds": "Broken clouds", "overcast clouds": "Overcast clouds", "light rain": "Light rain",
            "moderate rain": "Moderate rain", "heavy intensity rain": "Heavy rain", "very heavy rain": "Very heavy rain",
            "extreme rain": "Extreme rain", "shower rain": "Shower rain", "thunderstorm": "Thunderstorm",
            "snow": "Snow", "light snow": "Light snow", "heavy snow": "Heavy snow", "mist": "Mist",
            "fog": "Fog", "haze": "Haze", "smoke": "Smoke", "dust": "Dust", "sand": "Sand", "tornado": "Tornado"
        },
        te: {
            "clear sky": "నిర్మలమైన ఆకాశం", "few clouds": "కొన్ని మేఘాలు", "scattered clouds": "చెదురుమదురు మేఘాలు",
            "broken clouds": "విరిగిన మేఘాలు", "overcast clouds": "పూర్తిగా మేఘావృతమైన ఆకాశం", "light rain": "తేలికపాటి వర్షం",
            "moderate rain": "మోస్తరు వర్షం", "heavy intensity rain": "భారీ వర్షం", "very heavy rain": "చాలా భారీ వర్షం",
            "extreme rain": "తీవ్రమైన వర్షం", "shower rain": "జల్లుల వర్షం", "thunderstorm": "ఉరుములతో కూడిన వర్షం",
            "snow": "మంచు", "light snow": "తేలికపాటి మంచు", "heavy snow": "భారీ మంచు", "mist": "పొగమంచు",
            "fog": "దట్టమైన పొగమంచు", "haze": "మసక వాతావరణం", "smoke": "పొగ", "dust": "దుమ్ము", "sand": "ఇసుక", "tornado": "సుడిగాలి"
        },
        hi: {
            "clear sky": "साफ आसमान", "few clouds": "कुछ बादल", "scattered clouds": "छिटपुट बादल",
            "broken clouds": "टूटे हुए बादल", "overcast clouds": "पूरी तरह बादल छाए हुए", "light rain": "हल्की बारिश",
            "moderate rain": "मध्यम बारिश", "heavy intensity rain": "भारी बारिश", "very heavy rain": "बहुत भारी बारिश",
            "extreme rain": "अत्यधिक बारिश", "shower rain": "बौछारें", "thunderstorm": "गरज के साथ बारिश",
            "snow": "बर्फबारी", "light snow": "हल्की बर्फबारी", "heavy snow": "भारी बर्फबारी", "mist": "धुंध",
            "fog": "घना कोहरा", "haze": "धुंध", "smoke": "धुआं", "dust": "धूल", "sand": "रेत", "tornado": "बवंडर"
        }
    };

    /* =========================================================
       QUICK QUESTIONS
    ========================================================= */

    const quickQuestions = {
        en: [
            "Will it rain today?",
            "Is it good for outdoor activities?",
            "What should I wear?",
            "How is the weather?"
        ],
        te: [
            "ఈరోజు వర్షం పడుతుందా?",
            "బయట కార్యకలాపాలకు వాతావరణం అనుకూలంగా ఉందా?",
            "నేను ఏమి ధరించాలి?",
            "వాతావరణం ఎలా ఉంది?"
        ],
        hi: [
            "क्या आज बारिश होगी?",
            "क्या बाहर की गतिविधियों के लिए मौसम अच्छा है?",
            "मुझे क्या पहनना चाहिए?",
            "मौसम कैसा है?"
        ]
    };

    /* =========================================================
       INITIALIZATION
    ========================================================= */

    initialize();

    function initialize() {
        initializeVoiceRecognition();

        createFog();
        createHeatWaves();

        initializeLanguage();
        applyLanguageToUI();

        if (cityInput) {
            cityInput.focus();
            cityInput.addEventListener("input", handleLocationTyping);
            cityInput.addEventListener("keydown", event => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    if (locationResults) locationResults.innerHTML = "";
                    searchWeather();
                }
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener("click", searchWeather);
        }

        if (sendBtn) {
            sendBtn.addEventListener("click", sendQuestion);
        }

        if (questionInput) {
            questionInput.addEventListener("keydown", event => {
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendQuestion();
                }
            });
            questionInput.addEventListener("input", autoResizeTextarea);
        }

        if (micBtn) {
            micBtn.addEventListener("click", toggleMicrophone);
        }

        if (languageSelect) {
            languageSelect.addEventListener("change", handleLanguageChange);
        }

        document.addEventListener("click", event => {
            const button = event.target.closest(".quick-questions button");
            if (!button) return;

            const question = button.dataset.question || button.textContent.trim();
            if (!question) return;

            if (questionInput) {
                questionInput.value = question;
                autoResizeTextarea();
            }

            askWeatherAI(question);
        });
    }

    /* =========================================================
       LANGUAGE INITIALIZATION
    ========================================================= */

    function initializeLanguage() {
        if (!languageSelect) return;
        const selected = String(languageSelect.value || "auto").toLowerCase();

        if (selected === "auto") {
            const browserLanguage = String(navigator.language || "en").toLowerCase();
            if (browserLanguage.startsWith("te")) {
                languageSelect.dataset.detectedLanguage = "te";
            } else if (browserLanguage.startsWith("hi")) {
                languageSelect.dataset.detectedLanguage = "hi";
            } else {
                languageSelect.dataset.detectedLanguage = "en";
            }
        }
    }

    function getSelectedLanguage() {
        if (!languageSelect) return "en";
        const value = String(languageSelect.value || "en").trim().toLowerCase();

        if (value === "auto") {
            return languageSelect.dataset.detectedLanguage || detectBrowserLanguage();
        }
        if (value === "te" || value === "te-in" || value === "telugu") return "te";
        if (value === "hi" || value === "hi-in" || value === "hindi") return "hi";
        return "en";
    }

    function detectBrowserLanguage() {
        const browserLanguage = String(navigator.language || "en").toLowerCase();
        if (browserLanguage.startsWith("te")) return "te";
        if (browserLanguage.startsWith("hi")) return "hi";
        return "en";
    }

    function t(key) {
        const language = getSelectedLanguage();
        return translations[language]?.[key] || translations.en[key] || key;
    }

    async function handleLanguageChange() {
        initializeLanguage();

        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }

        if (recognition) {
            recognition.lang = getRecognitionLanguage();
        }

        applyLanguageToUI();

        if (voiceStatus && !isListening) {
            voiceStatus.textContent = getLanguageChangedMessage();
        }

        if (currentWeather && currentWeather.city) {
            updateWeather(currentWeather);
            updateWeatherAnimation(currentWeather);

            const requestId = ++insightsRequestId;
            showInsightLoading();
            await getSmartInsights(currentWeather.city, requestId);
        }
    }

    function applyLanguageToUI() {
        const language = getSelectedLanguage();
        document.documentElement.lang = language;

        setText("brandSubtitle", t("brandSubtitle"));
        setText("liveWeatherText", t("liveWeather"));
        setText("heroTag", t("heroTag"));
        setText("heroTitle", t("heroTitle"));
        setText("heroDescription", t("heroDescription"));

        setPlaceholder(cityInput, t("searchCity"));
        if (searchBtn) searchBtn.textContent = t("search");

        setText("currentWeatherLabel", t("currentWeather"));
        setText("overviewTitle", t("weatherOverview"));

        setText("feelsLikeLabel", t("feelsLike"));
        setText("humidityLabel", t("humidity"));
        setText("windLabel", t("wind"));
        setText("pressureLabel", t("pressure"));
        setText("visibilityLabel", t("visibility"));
        setText("cloudinessLabel", t("cloudiness"));

        setText("aiWeather", t("aiWeather"));
        setText("poweredBy", t("poweredBy"));
        setText("onlineText", t("online"));
        setText("thinkingText", t("thinking"));
        setText("welcomeMessage", t("welcome"));

        setPlaceholder(questionInput, t("askQuestion"));

        if (micBtn) micBtn.title = t("voiceInput");
        if (sendBtn) sendBtn.title = t("sendMessage");

        setText("analysisLabel", t("analysis"));
        setText("smartInsightsTitle", t("smartInsights"));
        setText("statusTitle", t("status"));
        setText("alertTitle", t("alert"));
        setText("clothingTitle", t("clothing"));
        setText("healthTitle", t("health"));
        setText("travelTitle", t("travel"));

        setText("footerText", t("footer"));

        if (voiceStatus && !isListening) {
            voiceStatus.textContent = t("voiceReady");
        }

        translateQuickQuestions(language);

        if (currentWeather) {
            updateWeather(currentWeather);
            updateWeatherAnimation(currentWeather);
        } else {
            setText("cityName", t("searchCity"));
            setText("overviewText", t("overviewDefault"));
        }
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function setPlaceholder(element, value) {
        if (element) element.placeholder = value;
    }

    function translateQuickQuestions(language) {
        const buttons = document.querySelectorAll(".quick-questions button");
        const list = quickQuestions[language] || quickQuestions.en;

        buttons.forEach((button, index) => {
            if (!list[index]) return;
            const span = button.querySelector("span");
            if (span) {
                span.textContent = list[index];
            } else {
                button.textContent = list[index];
            }
            button.dataset.question = list[index];
        });
    }

    /* =========================================================
       LOCATION SEARCH
    ========================================================= */

    function handleLocationTyping() {
        const query = cityInput ? cityInput.value.trim() : "";
        clearTimeout(locationSearchTimer);

        if (locationSearchController) {
            locationSearchController.abort();
            locationSearchController = null;
        }

        selectedLocation = null;

        if (query.length < 2) {
            if (locationResults) locationResults.innerHTML = "";
            return;
        }

        locationSearchTimer = setTimeout(() => {
            searchDetailedLocation(query);
        }, 350);
    }

    async function searchDetailedLocation(query) {
        if (!locationResults) return;

        locationResults.innerHTML = `
            <div class="location-result location-search-status">
                🔎 Searching locations...
            </div>
        `;

        locationSearchController = new AbortController();

        try {
            const response = await fetch(
                `/location-search?query=${encodeURIComponent(query)}`,
                { signal: locationSearchController.signal }
            );

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Location not found.");

            displayLocationResults(data.results || []);
        } catch (error) {
            if (error.name === "AbortError") return;
            locationResults.innerHTML = `
                <div class="location-result location-search-status">
                    ❌ ${escapeLocationText(error.message)}
                </div>
            `;
        }
    }

    function displayLocationResults(results) {
        if (!locationResults) return;
        locationResults.innerHTML = "";

        if (!results || results.length === 0) {
            locationResults.innerHTML = `
                <div class="location-result location-search-status">
                    No matching locations found.
                </div>
            `;
            return;
        }

        results.forEach(location => {
            const card = document.createElement("div");
            card.className = "location-result";
            card.setAttribute("role", "button");
            card.tabIndex = 0;

            const villageName = location.village || location.name || "";
            const region = [location.mandal, location.district, location.state, location.country]
                .filter(Boolean)
                .join(", ");

            const lat = Number(location.lat);
            const lon = Number(location.lon);

            card.innerHTML = `
                <div class="location-result-main">
                    <div class="location-result-icon">📍</div>
                    <div>
                        <div class="location-result-name">${escapeLocationText(villageName)}</div>
                        <div class="location-result-region">${escapeLocationText(region || "Location")}</div>
                        <div class="location-result-coordinates">
                            ${Number.isFinite(lat) ? lat.toFixed(5) : "--"},
                            ${Number.isFinite(lon) ? lon.toFixed(5) : "--"}
                        </div>
                    </div>
                </div>
            `;

            const choose = () => selectLocation(location);
            card.addEventListener("click", choose);
            card.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    choose();
                }
            });

            locationResults.appendChild(card);
        });
    }

    async function selectLocation(location) {
        selectedLocation = location;
        const lat = Number(location.lat);
        const lon = Number(location.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            showError("Invalid location coordinates.");
            return;
        }

        const displayName = [
            location.village || location.name,
            location.mandal,
            location.district,
            location.state,
            location.country
        ].filter(Boolean).join(", ");

        if (locationResults) locationResults.innerHTML = "";
        if (cityInput) cityInput.value = displayName;

        await loadWeatherForCoordinates(lat, lon, displayName);
    }

    async function loadWeatherForCoordinates(lat, lon, locationName) {
        hideError();

        if (searchBtn) {
            searchBtn.disabled = true;
            searchBtn.textContent = t("loading");
        }

        try {
            const response = await fetch(
                `/weather-coordinates?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&location=${encodeURIComponent(locationName)}`
            );

            const data = await parseResponse(response);
            if (!response.ok) throw new Error(data.error || t("weatherUnavailable"));

            currentWeather = data;
            updateWeather(data);
            updateWeatherAnimation(data);

            showInsightLoading();
            const requestId = ++insightsRequestId;
            await getSmartInsights(data.city, requestId);
        } catch (error) {
            console.error("Coordinate Weather Error:", error);
            showError(error.message || t("weatherUnavailable"));
        } finally {
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.textContent = t("search");
            }
        }
    }

    function escapeLocationText(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* =========================================================
       WEATHER SEARCH
    ========================================================= */

    function searchWeather() {
        const city = cityInput ? cityInput.value.trim() : "";
        if (!city) {
            showError(t("enterCity"));
            return;
        }

        if (selectedLocation) {
            const selectedName = [
                selectedLocation.name,
                selectedLocation.state,
                selectedLocation.country
            ].filter(Boolean).join(", ");

            if (city === selectedName) {
                loadWeatherForCoordinates(
                    Number(selectedLocation.lat),
                    Number(selectedLocation.lon),
                    selectedName
                );
                return;
            }
        }

        getWeather(city);
    }

    async function getWeather(city) {
        hideError();

        if (searchBtn) {
            searchBtn.disabled = true;
            searchBtn.textContent = t("loading");
        }

        try {
            const response = await fetch(`/weather?city=${encodeURIComponent(city)}`);
            const data = await parseResponse(response);

            if (!response.ok) {
                throw new Error(data.error || t("weatherUnavailable"));
            }

            currentWeather = data;
            updateWeather(data);
            updateWeatherAnimation(data);

            showInsightLoading();
            const requestId = ++insightsRequestId;
            await getSmartInsights(data.city, requestId);

        } catch (error) {
            console.error("Weather Error:", error);
            showError(error.message || t("weatherUnavailable"));
        } finally {
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.textContent = t("search");
            }
        }
    }

    async function parseResponse(response) {
        const text = await response.text();
        if (!text) return {};
        try {
            return JSON.parse(text);
        } catch (error) {
            throw new Error(t("serverInvalid"));
        }
    }

    /* =========================================================
       WEATHER DISPLAY & ANIMATION
    ========================================================= */

    function updateWeather(data) {
        if (!data) return;

        if (cityName) cityName.textContent = `${data.city || "--"}, ${data.country || ""}`;
        if (temperature) {
            const value = Number(data.temperature);
            temperature.textContent = Number.isFinite(value) ? Math.round(value) : "--";
        }
        if (feelsLike) {
            const value = Number(data.feels_like);
            feelsLike.textContent = Number.isFinite(value) ? `${Math.round(value)}°C` : "--°C";
        }
        if (humidity) humidity.textContent = `${data.humidity ?? "--"}%`;
        if (wind) {
            const value = Number(data.wind_speed);
            wind.textContent = Number.isFinite(value) ? `${value.toFixed(1)} m/s` : "-- m/s";
        }
        if (pressure) pressure.textContent = `${data.pressure ?? "--"} hPa`;
        if (visibility) {
            const value = Number(data.visibility);
            visibility.textContent = Number.isFinite(value) ? `${value.toFixed(1)} km` : "-- km";
        }
        if (clouds) clouds.textContent = `${data.clouds ?? "--"}%`;
        if (description) description.textContent = getTranslatedWeatherDescription(data.description);

        updateWeatherOverview(data);
        updateWeatherIcon(data);
    }

    function updateWeatherOverview(data) {
        const overview = document.getElementById("overviewText");
        if (!overview) return;

        const temp = Number(data.temperature);
        const feels = Number(data.feels_like);
        const humidityValue = data.humidity ?? "--";
        const translatedDescription = getTranslatedWeatherDescription(data.description);

        if (Number.isFinite(temp) && Number.isFinite(feels)) {
            overview.textContent = t("overviewText")
                .replace("{temp}", Math.round(temp))
                .replace("{description}", translatedDescription)
                .replace("{feels}", Math.round(feels))
                .replace("{humidity}", humidityValue);
        } else {
            overview.textContent = t("overviewDefault");
        }
    }

    function getTranslatedWeatherDescription(weatherDescription) {
        if (!weatherDescription) return "";
        const language = getSelectedLanguage();
        const normalized = String(weatherDescription).trim().toLowerCase();
        const dictionary = weatherTranslations[language];

        if (dictionary && dictionary[normalized]) return dictionary[normalized];
        if (dictionary) {
            const key = Object.keys(dictionary).find(item => normalized.includes(item));
            if (key) return dictionary[key];
        }
        return capitalize(weatherDescription);
    }

    function updateWeatherIcon(data) {
        if (!weatherIcon) return;
        const condition = String(data.condition || "").toLowerCase();
        const desc = String(data.description || "").toLowerCase();

        if (condition.includes("thunder") || condition.includes("storm")) weatherIcon.textContent = "⛈️";
        else if (condition.includes("rain") || condition.includes("drizzle")) weatherIcon.textContent = "🌧️";
        else if (condition.includes("snow")) weatherIcon.textContent = "❄️";
        else if (condition.includes("mist") || condition.includes("fog") || desc.includes("mist") || desc.includes("fog") || desc.includes("haze")) weatherIcon.textContent = "🌫️";
        else if (condition.includes("cloud")) weatherIcon.textContent = "☁️";
        else weatherIcon.textContent = "☀️";
    }

    function updateWeatherAnimation(data) {
        if (!weatherScene) return;
        const condition = String(data.condition || "").toLowerCase();
        const weatherDescription = String(data.description || "").toLowerCase();
        const temp = Number(data.temperature);

        let state = "scene-default";
        let message = t("liveAnimation");

        if (condition.includes("thunder") || condition.includes("storm")) {
            state = "scene-storm";
            message = t("thunderstorm");
        } else if (condition.includes("rain") || condition.includes("drizzle")) {
            state = "scene-rain";
            message = t("rain");
        } else if (condition.includes("snow")) {
            state = "scene-snow";
            message = t("snow");
        } else if (condition.includes("mist") || condition.includes("fog") || condition.includes("haze") || weatherDescription.includes("mist") || weatherDescription.includes("fog") || weatherDescription.includes("haze")) {
            state = "scene-mist";
            message = t("mist");
        } else if (temp > 35) {
            state = "scene-hot";
            message = t("hot");
        } else if (temp < 15) {
            state = "scene-cold";
            message = t("cold");
        } else if (condition.includes("cloud")) {
            state = "scene-clouds";
            message = t("clouds");
        } else {
            state = "scene-clear";
            message = t("clear");
        }

        weatherScene.className = "weather-scene";
        weatherScene.classList.add(state);

        if (sceneStatus) sceneStatus.textContent = message;

        if (state === "scene-rain" || state === "scene-storm") createRain();
        else clearLayer(rainLayer);

        if (state === "scene-snow") createSnow();
        else clearLayer(snowLayer);

        if (state === "scene-mist") createFog();
        else clearLayer(fogLayer);

        if (state === "scene-hot") createHeatWaves();
        else clearLayer(heatLayer);
    }

    function createRain() {
        if (!rainLayer) return;
        rainLayer.innerHTML = "";
        for (let i = 0; i < 120; i++) {
            const drop = document.createElement("span");
            drop.className = "rain-drop";
            drop.style.setProperty("--rain-left", `${Math.random() * 100}%`);
            drop.style.setProperty("--rain-speed", `${0.45 + Math.random() * 0.6}s`);
            drop.style.setProperty("--rain-delay", `${Math.random() * 2}s`);
            rainLayer.appendChild(drop);
        }
    }

    function createSnow() {
        if (!snowLayer) return;
        snowLayer.innerHTML = "";
        for (let i = 0; i < 70; i++) {
            const snow = document.createElement("span");
            snow.className = "snowflake";
            snow.style.setProperty("--snow-left", `${Math.random() * 100}%`);
            snow.style.setProperty("--snow-size", `${3 + Math.random() * 6}px`);
            snow.style.setProperty("--snow-speed", `${4 + Math.random() * 6}s`);
            snow.style.setProperty("--snow-delay", `${Math.random() * 5}s`);
            snowLayer.appendChild(snow);
        }
    }

    function createFog() {
        if (!fogLayer) return;
        fogLayer.innerHTML = "";
        for (let i = 0; i < 6; i++) {
            const fog = document.createElement("span");
            fog.className = "fog-orb";
            fog.style.setProperty("--fog-left", `${Math.random() * 90}%`);
            fog.style.setProperty("--fog-top", `${20 + Math.random() * 60}%`);
            fog.style.setProperty("--fog-speed", `${7 + Math.random() * 8}s`);
            fogLayer.appendChild(fog);
        }
    }

    function createHeatWaves() {
        if (!heatLayer) return;
        heatLayer.innerHTML = "";
        for (let i = 0; i < 7; i++) {
            const wave = document.createElement("span");
            wave.className = "heat-wave";
            wave.style.setProperty("--heat-left", `${5 + Math.random() * 90}%`);
            wave.style.setProperty("--heat-speed", `${2 + Math.random() * 2}s`);
            wave.style.setProperty("--heat-delay", `${Math.random() * 2}s`);
            heatLayer.appendChild(wave);
        }
    }

    function clearLayer(layer) {
        if (layer) layer.innerHTML = "";
    }

    /* =========================================================
       AI CHAT
    ========================================================= */

    async function askWeatherAI(question) {
        if (!question || !question.trim()) {
            showError(t("enterQuestion"));
            return;
        }

        if (!currentWeather) {
            showError(t("searchFirst"));
            return;
        }

        const requestLanguage = getSelectedLanguage();
        addUserMessage(question);
        showTyping();

        try {
            const exactCoordinates =
                Number.isFinite(Number(currentWeather.latitude)) &&
                Number.isFinite(Number(currentWeather.longitude));

            const aiPayload = exactCoordinates
                ? {
                    lat: Number(currentWeather.latitude),
                    lon: Number(currentWeather.longitude),
                    location: currentWeather.city,
                    question: question.trim(),
                    language: requestLanguage
                }
                : {
                    city: currentWeather.city,
                    question: question.trim(),
                    language: requestLanguage
                };

            const response = await fetch(
                exactCoordinates ? "/ask-coordinates" : "/ask",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(aiPayload)
                }
            );

            const data = await parseResponse(response);
            if (!response.ok) throw new Error(data.error || t("aiError"));

            hideTyping();
            const answer = data.answer || t("aiError");
            addAIMessage(answer);

            if (speechEnabled && data.answer) {
                speakText(data.answer, requestLanguage);
            }
        } catch (error) {
            console.error("AI Error:", error);
            hideTyping();
            addAIMessage(t("aiError"));
            showError(error.message || t("aiError"));
        }
    }

    function sendQuestion() {
        const question = questionInput ? questionInput.value.trim() : "";
        if (!question) return;

        if (questionInput) {
            questionInput.value = "";
            autoResizeTextarea();
        }

        askWeatherAI(question);
    }

    /* =========================================================
       CHAT UI
    ========================================================= */

    function addUserMessage(message) {
        if (!chatContainer) return;
        const wrapper = document.createElement("div");
        wrapper.className = "user-message";
        wrapper.innerHTML = `
            <div class="message-content user-content">
                <div class="message-name">${getUserLabel()}</div>
                <p></p>
                <div class="message-time">${getCurrentTime()}</div>
            </div>
            <div class="message-avatar user-avatar">👤</div>
        `;

        const paragraph = wrapper.querySelector("p");
        if (paragraph) paragraph.textContent = message;

        chatContainer.appendChild(wrapper);
        scrollChatToBottom();
    }

    function addAIMessage(message) {
        if (!chatContainer) return;
        const wrapper = document.createElement("div");
        wrapper.className = "ai-message";
        wrapper.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="message-name">WeatherGPT</div>
                <p></p>
                <div class="message-time">${getCurrentTime()}</div>
            </div>
        `;

        const paragraph = wrapper.querySelector("p");
        if (paragraph) paragraph.textContent = message;

        chatContainer.appendChild(wrapper);
        scrollChatToBottom();
    }

    function getUserLabel() { return t("userLabel"); }

    function scrollChatToBottom() {
        if (!chatContainer) return;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function showTyping() {
        if (!typingIndicator) return;
        const thinking = document.getElementById("thinkingText");
        if (thinking) thinking.textContent = t("thinking");

        typingIndicator.classList.remove("hidden");
        scrollChatToBottom();
    }

    function hideTyping() {
        if (!typingIndicator) return;
        typingIndicator.classList.add("hidden");
    }

    function getCurrentTime() {
        return new Date().toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" });
    }

    function getLocale() {
        const language = getSelectedLanguage();
        if (language === "te") return "te-IN";
        if (language === "hi") return "hi-IN";
        return "en-IN";
    }

    /* =========================================================
       UNIFIED ROBUST VOICE RECOGNITION (FIXED)
    ========================================================= */

    function initializeVoiceRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            if (voiceStatus) voiceStatus.textContent = t("voiceUnsupported");
            if (micBtn) {
                micBtn.disabled = true;
                micBtn.style.opacity = "0.5";
            }
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.lang = getRecognitionLanguage();

        recognition.onstart = () => {
            isListening = true;
            if (micBtn) micBtn.classList.add("recording");
            if (voiceStatus) {
                voiceStatus.textContent = getVoiceListeningMessage();
                voiceStatus.classList.add("active");
            }
        };

        recognition.onresult = event => {
            try {
                const transcript = event.results[0][0].transcript;
                if (questionInput) {
                    questionInput.value = transcript;
                    autoResizeTextarea();
                }

                if (voiceStatus) {
                    voiceStatus.textContent = `${getVoiceRecognizedMessage()}: "${transcript}"`;
                    voiceStatus.classList.remove("active");
                }

                if (transcript && transcript.trim()) {
                    askWeatherAI(transcript.trim());
                }
            } catch (error) {
                console.error("Voice Result Error:", error);
            }
        };

        recognition.onerror = event => {
            console.error("Voice Error:", event.error);
            isListening = false;
            if (micBtn) micBtn.classList.remove("recording");
            if (voiceStatus) {
                voiceStatus.classList.remove("active");
                voiceStatus.textContent = getVoiceErrorMessage(event.error);
            }
        };

        recognition.onend = () => {
            isListening = false;
            if (micBtn) micBtn.classList.remove("recording");
            if (voiceStatus) {
                voiceStatus.classList.remove("active");
                setTimeout(() => {
                    if (!isListening && voiceStatus) {
                        voiceStatus.textContent = t("voiceReady");
                    }
                }, 2500);
            }
        };
    }

    async function toggleMicrophone() {
        if (!recognition) {
            showError(t("voiceUnsupported"));
            return;
        }

        if (isListening) {
            recognition.stop();
            return;
        }

        // Explicitly request microphone stream permission from browser
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                await navigator.mediaDevices.getUserMedia({ audio: true });
            }
        } catch (err) {
            console.error("Microphone permission denied:", err);
            if (voiceStatus) voiceStatus.textContent = t("microphoneDenied");
            alert("Microphone access is blocked! Please allow microphone permission in your browser URL bar.");
            return;
        }

        recognition.lang = getRecognitionLanguage();

        try {
            recognition.start();
        } catch (error) {
            console.warn("Microphone start collision, restarting session...", error);
            try {
                recognition.stop();
                setTimeout(() => recognition.start(), 200);
            } catch (e) {
                console.error("Critical Voice Error:", e);
            }
        }
    }

    function getRecognitionLanguage() {
        const language = getSelectedLanguage();
        if (language === "te") return "te-IN";
        if (language === "hi") return "hi-IN";
        return "en-US";
    }

    function getVoiceListeningMessage() { return t("listening"); }
    function getVoiceRecognizedMessage() { return t("recognized"); }
    function getLanguageChangedMessage() { return t("languageChanged"); }

    function getVoiceErrorMessage(error) {
        const language = getSelectedLanguage();
        const messages = {
            en: {
                "not-allowed": "🎤 Microphone permission denied. Check browser settings.",
                "no-speech": "No speech detected. Please try speaking again.",
                "audio-capture": "Microphone hardware unavailable.",
                "network": "Speech network error. Ensure internet connection.",
                "aborted": "Voice recognition stopped"
            },
            te: {
                "not-allowed": "🎤 మైక్రోఫోన్ అనుమతి నిరాకరించబడింది",
                "no-speech": "వాయిస్ గుర్తించబడలేదు",
                "audio-capture": "మైక్రోఫోన్ అందుబాటులో లేదు",
                "network": "వాయిస్ నెట్‌వర్క్ లోపం",
                "aborted": "వాయిస్ గుర్తింపు ఆపబడింది"
            },
            hi: {
                "not-allowed": "🎤 माइक्रोफ़ोन की अनुमति नहीं है",
                "no-speech": "कोई आवाज़ नहीं मिली",
                "audio-capture": "माइक्रोफ़ोन उपलब्ध नहीं है",
                "network": "वॉयस नेटवर्क त्रुटि",
                "aborted": "वॉयस पहचान बंद कर दी गई"
            }
        };

        return (
            messages[language]?.[error] ||
            messages[language]?.aborted ||
            messages.en.aborted
        );
    }

    /* =========================================================
       TEXT TO SPEECH (VOICE OUTPUT)
    ========================================================= */

    function speakText(text, language = getSelectedLanguage()) {
        if (!speechEnabled || !("speechSynthesis" in window) || !text) return;

        window.speechSynthesis.cancel();

        // Strip markdown stars, headers, backticks so they are not read out loud
        const cleanText = text.replace(/[*#_`-]/g, "").trim();
        const speech = new SpeechSynthesisUtterance(cleanText);
        speech.rate = 0.95;
        speech.pitch = 1;
        speech.volume = 1;

        if (language === "te") speech.lang = "te-IN";
        else if (language === "hi") speech.lang = "hi-IN";
        else speech.lang = "en-US";

        window.speechSynthesis.speak(speech);
    }

    /* =========================================================
       TEXTAREA AUTO-RESIZE
    ========================================================= */

    function autoResizeTextarea() {
        if (!questionInput) return;
        questionInput.style.height = "auto";
        questionInput.style.height = `${Math.min(questionInput.scrollHeight, 120)}px`;
    }

    /* =========================================================
       SMART INSIGHTS
    ========================================================= */

    async function getSmartInsights(city, requestId = ++insightsRequestId) {
        if (!city) return;
        const selectedLanguage = getSelectedLanguage();

        try {
            const exactCoordinates =
                currentWeather &&
                Number.isFinite(Number(currentWeather.latitude)) &&
                Number.isFinite(Number(currentWeather.longitude));

            const insightPayload = exactCoordinates
                ? {
                    lat: Number(currentWeather.latitude),
                    lon: Number(currentWeather.longitude),
                    location: currentWeather.city,
                    language: selectedLanguage
                }
                : {
                    city: city,
                    language: selectedLanguage
                };

            const response = await fetch(
                exactCoordinates ? "/insights-coordinates" : "/insights",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(insightPayload)
                }
            );

            const data = await parseResponse(response);
            if (!response.ok) throw new Error(data.error || t("analysisUnavailable"));

            if (requestId !== insightsRequestId) return;
            if (!data || typeof data.insights !== "string") {
                throw new Error("Invalid Smart Insights response.");
            }

            parseInsights(data.insights);
        } catch (error) {
            if (requestId !== insightsRequestId) return;
            console.error("Insights Error:", error);
            displayInsightError();
        }
    }

    function showInsightLoading() {
        const message = t("analyzing");
        displayInsight(insightStatus, [message]);
        displayInsight(insightAlert, [message]);
        displayInsight(insightClothing, [message]);
        displayInsight(insightHealth, [message]);
        displayInsight(insightTravel, [message]);
    }

    function parseInsights(text) {
        if (!text) {
            displayInsightError();
            return;
        }

        displayInsight(insightStatus, extractBulletPoints(text, "STATUS"));
        displayInsight(insightAlert, extractBulletPoints(text, "ALERT"));
        displayInsight(insightClothing, extractBulletPoints(text, "CLOTHING"));
        displayInsight(insightHealth, extractBulletPoints(text, "HEALTH"));
        displayInsight(insightTravel, extractBulletPoints(text, "TRAVEL"));
    }

    function extractBulletPoints(text, sectionName) {
        const sections = ["STATUS", "ALERT", "CLOTHING", "HEALTH", "TRAVEL"];
        const currentIndex = sections.indexOf(sectionName);
        if (currentIndex === -1) return [];

        const nextSection = sections[currentIndex + 1];
        const startPattern = new RegExp(`(?:\\*{1,3}|#{1,6})?\\s*${sectionName}\\s*:?\\s*(?:\\*{1,3})?`, "i");
        const startMatch = text.match(startPattern);

        if (!startMatch || startMatch.index === undefined) return [];

        let sectionText = text.substring(startMatch.index + startMatch[0].length);

        if (nextSection) {
            const nextPattern = new RegExp(`(?:\\*{1,3}|#{1,6})?\\s*${nextSection}\\s*:?\\s*(?:\\*{1,3})?`, "i");
            const nextMatch = sectionText.match(nextPattern);
            if (nextMatch && nextMatch.index !== undefined) {
                sectionText = sectionText.substring(0, nextMatch.index);
            }
        }

        return sectionText
            .split(/\r?\n/)
            .map(line =>
                line
                    .replace(/^\s*[-•*]\s*/, "")
                    .replace(/^\s*\d+[.)]\s*/, "")
                    .replace(/^\s*#+\s*/, "")
                    .replace(/\*\*/g, "")
                    .trim()
            )
            .filter(line => line.length > 0)
            .slice(0, 3);
    }

    function displayInsight(element, points) {
        if (!element) return;
        element.innerHTML = "";

        if (!points || points.length === 0) {
            const li = document.createElement("li");
            li.textContent = t("noInformation");
            element.appendChild(li);
            return;
        }

        points.forEach(point => {
            const li = document.createElement("li");
            li.textContent = point;
            element.appendChild(li);
        });
    }

    function displayInsightError() {
        const message = t("analysisUnavailable");
        displayInsight(insightStatus, [message]);
        displayInsight(insightAlert, [message]);
        displayInsight(insightClothing, [message]);
        displayInsight(insightHealth, [message]);
        displayInsight(insightTravel, [message]);
    }

    /* =========================================================
       ERROR BOX
    ========================================================= */

    function showError(message) {
        if (!errorBox) {
            console.error(message);
            return;
        }
        errorBox.textContent = message;
        errorBox.classList.add("show");
    }

    function hideError() {
        if (!errorBox) return;
        errorBox.textContent = "";
        errorBox.classList.remove("show");
    }

    function capitalize(text) {
        if (!text) return "";
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    /* =========================================================
       WEATHER HISTORY / FORECAST / GRAPH
    ========================================================= */

    let climateChart = null;
    let climateDataCache = { historical: [], forecast: [] };

    function initializeClimateFeatures() {
        const overview = document.querySelector(".overview");
        if (!overview || document.getElementById("climateTools")) return;

        const tools = document.createElement("div");
        tools.id = "climateTools";
        tools.className = "climate-tools";
        tools.innerHTML = `
            <div class="climate-tools-title">Weather Analytics</div>
            <div class="climate-buttons">
                <button type="button" id="previousWeatherBtn" class="climate-btn">← Previous Days</button>
                <button type="button" id="futureWeatherBtn" class="climate-btn">Next Days →</button>
                <button type="button" id="climateGraphBtn" class="climate-btn climate-btn-primary">📈 Climate Graph</button>
            </div>`;
        overview.insertAdjacentElement("afterend", tools);

        const panel = document.createElement("section");
        panel.id = "climateDataPanel";
        panel.className = "climate-data-panel hidden";
        panel.innerHTML = `
            <div class="climate-panel-header">
                <div><span class="small-label" id="climatePanelLabel">WEATHER ANALYTICS</span><h3 id="climatePanelTitle">Weather Analytics</h3></div>
                <button type="button" id="closeClimatePanel" class="climate-close">×</button>
            </div>
            <div id="climateSummary" class="climate-summary"></div>
            <div id="climateTableWrap" class="climate-table-wrap"></div>
            <div id="climateChartWrap" class="climate-chart-wrap hidden"><canvas id="climateChart"></canvas></div>`;
        overview.parentElement.insertAdjacentElement("afterend", panel);

        document.getElementById("previousWeatherBtn")?.addEventListener("click", () => loadClimateData("historical"));
        document.getElementById("futureWeatherBtn")?.addEventListener("click", () => loadClimateData("forecast"));
        document.getElementById("climateGraphBtn")?.addEventListener("click", showClimateGraph);
        document.getElementById("closeClimatePanel")?.addEventListener("click", hideClimatePanel);
    }

    function climateText(key) {
        const lang = getSelectedLanguage();
        const text = {
            en: { previous:"← Previous Days", future:"Next Days →", graph:"📈 Climate Graph", title:"Weather Analytics", previousTitle:"Previous 7 Days", futureTitle:"Next 5 Days", graphTitle:"Temperature & Humidity Trend", loading:"Loading weather data...", noCity:"Please search for a city first.", noData:"No weather data available.", temp:"Temperature", min:"Min", max:"Max", humidity:"Humidity", wind:"Wind", rain:"Rain", condition:"Condition", date:"Date", graphError:"Unable to display the graph." },
            te: { previous:"← గత రోజులు", future:"తదుపరి రోజులు →", graph:"📈 వాతావరణ గ్రాఫ్", title:"వాతావరణ విశ్లేషణ", previousTitle:"గత 7 రోజులు", futureTitle:"తదుపరి 5 రోజులు", graphTitle:"ఉష్ణోగ్రత & తేమ ధోరణి", loading:"వాతావరణ సమాచారం లోడ్ అవుతోంది...", noCity:"ముందుగా ఒక నగరాన్ని శోధించండి.", noData:"వాతావరణ సమాచారం అందుబాటులో లేదు.", temp:"ఉష్ణోగ్రత", min:"కనిష్ట", max:"గరిష్ట", humidity:"తేమ", wind:"గాలి", rain:"వర్షం", condition:"పరిస్థితి", date:"తేదీ", graphError:"గ్రాఫ్‌ను చూపించలేకపోయాము." },
            hi: { previous:"← पिछले दिन", future:"अगले दिन →", graph:"📈 मौसम ग्राफ़", title:"मौसम विश्लेषण", previousTitle:"पिछले 7 दिन", futureTitle:"अगले 5 दिन", graphTitle:"तापमान और नमी का रुझान", loading:"मौसम की जानकारी लोड हो रही है...", noCity:"कृपया पहले किसी शहर को खोजें।", noData:"मौसम की जानकारी उपलब्ध नहीं है।", temp:"तापमान", min:"न्यूनतम", max:"अधिकतम", humidity:"नमी", wind:"हवा", rain:"बारिश", condition:"स्थिति", date:"तारीख", graphError:"ग्राफ़ प्रदर्शित नहीं किया जा सका।" }
        };
        return text[lang]?.[key] || text.en[key] || key;
    }

    function updateClimateButtonLabels() {
        const previous = document.getElementById("previousWeatherBtn");
        const future = document.getElementById("futureWeatherBtn");
        const graph = document.getElementById("climateGraphBtn");
        const title = document.getElementById("climatePanelTitle");
        if (previous) previous.textContent = climateText("previous");
        if (future) future.textContent = climateText("future");
        if (graph) graph.textContent = climateText("graph");
        if (title) title.textContent = climateText("title");
    }

    function showClimatePanel() { document.getElementById("climateDataPanel")?.classList.remove("hidden"); }
    function hideClimatePanel() { document.getElementById("climateDataPanel")?.classList.add("hidden"); }

    async function loadClimateData(type) {
        if (!currentWeather?.city) { showError(climateText("noCity")); return; }
        showClimatePanel();
        const table = document.getElementById("climateTableWrap");
        const chart = document.getElementById("climateChartWrap");
        if (table) { table.classList.remove("hidden"); table.innerHTML = `<div class="climate-loading">${climateText("loading")}</div>`; }
        chart?.classList.add("hidden");
        try {
            const endpoint = type === "historical" ? "/historical" : "/forecast";
            const response = await fetch(`${endpoint}?city=${encodeURIComponent(currentWeather.city)}`);
            const data = await parseResponse(response);
            if (!response.ok) throw new Error(data.error || climateText("noData"));
            climateDataCache[type] = Array.isArray(data.data) ? data.data : [];
            renderClimateTable(climateDataCache[type], type);
        } catch (error) {
            console.error("Climate Data Error:", error);
            if (table) table.innerHTML = `<div class="climate-error">${escapeHtml(error.message || climateText("noData"))}</div>`;
        }
    }

    function renderClimateTable(rows, type) {
        const wrap = document.getElementById("climateTableWrap");
        const summary = document.getElementById("climateSummary");
        if (!wrap) return;
        if (!rows.length) { wrap.innerHTML = `<div class="climate-error">${climateText("noData")}</div>`; return; }
        if (summary) summary.textContent = type === "historical" ? climateText("previousTitle") : climateText("futureTitle");
        wrap.innerHTML = `<div class="climate-table-scroll"><table class="climate-table"><thead><tr>
            <th>${climateText("date")}</th><th>${climateText("temp")}</th><th>${climateText("min")}</th><th>${climateText("max")}</th><th>${climateText("humidity")}</th><th>${climateText("wind")}</th><th>${climateText("rain")}</th><th>${climateText("condition")}</th>
            </tr></thead><tbody>${rows.map(row => `<tr>
            <td>${escapeHtml(row.date || "--")}</td><td>${formatNumber(row.temperature)}°C</td><td>${formatNumber(row.min_temperature)}°C</td><td>${formatNumber(row.max_temperature)}°C</td><td>${formatNumber(row.humidity)}%</td><td>${formatNumber(row.wind_speed)} m/s</td><td>${formatNumber(row.precipitation)} mm</td><td>${escapeHtml(getTranslatedWeatherDescription(row.description || row.condition || "--"))}</td>
            </tr>`).join("")}</tbody></table></div>`;
    }

    async function ensureClimateChartLibrary() {
        if (window.Chart) return;
        await new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-weather-chart="true"]');
            if (existing) { existing.addEventListener("load", resolve, {once:true}); existing.addEventListener("error", reject, {once:true}); return; }
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";
            script.dataset.weatherChart = "true";
            script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
        });
    }

    async function showClimateGraph() {
        if (!currentWeather?.city) { showError(climateText("noCity")); return; }
        showClimatePanel();
        document.getElementById("climateTableWrap")?.classList.add("hidden");
        document.getElementById("climateChartWrap")?.classList.remove("hidden");
        const summary = document.getElementById("climateSummary");
        if (summary) summary.textContent = climateText("graphTitle");
        try {
            if (!climateDataCache.forecast.length) {
                const response = await fetch(`/forecast?city=${encodeURIComponent(currentWeather.city)}`);
                const data = await parseResponse(response);
                if (!response.ok) throw new Error(data.error || climateText("noData"));
                climateDataCache.forecast = Array.isArray(data.data) ? data.data : [];
            }
            await ensureClimateChartLibrary();
            renderClimateChart(climateDataCache.forecast);
        } catch (error) {
            console.error("Climate Graph Error:", error);
            const wrap = document.getElementById("climateChartWrap");
            if (wrap) wrap.innerHTML = `<div class="climate-error">${escapeHtml(error.message || climateText("graphError"))}</div>`;
        }
    }

    function renderClimateChart(rows) {
        const canvas = document.getElementById("climateChart");
        if (!canvas || !rows.length || !window.Chart) return;
        if (climateChart) climateChart.destroy();
        climateChart = new Chart(canvas.getContext("2d"), {
            type: "line",
            data: { labels: rows.map(r => r.date), datasets: [
                { label: climateText("temp") + " °C", data: rows.map(r => Number(r.temperature)), tension:.35, borderWidth:2, pointRadius:4, yAxisID:"temperature" },
                { label: climateText("humidity") + " %", data: rows.map(r => Number(r.humidity)), tension:.35, borderWidth:2, pointRadius:4, yAxisID:"humidity" }
            ]},
            options: { responsive:true, maintainAspectRatio:false, interaction:{mode:"index",intersect:false}, plugins:{legend:{labels:{color:"#cbd5e1"}}}, scales:{
                x:{ticks:{color:"#8d9aab"},grid:{color:"rgba(255,255,255,.05)"}},
                temperature:{type:"linear",position:"left",ticks:{color:"#8d9aab"},grid:{color:"rgba(255,255,255,.05)"}},
                humidity:{type:"linear",position:"right",min:0,max:100,grid:{drawOnChartArea:false},ticks:{color:"#8d9aab"}}
            }}
        });
    }

    function formatNumber(value) { const n = Number(value); return Number.isFinite(n) ? n.toFixed(1) : "--"; }
    function escapeHtml(value) { return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }

    initializeClimateFeatures();
    updateClimateButtonLabels();
    languageSelect?.addEventListener("change", () => setTimeout(updateClimateButtonLabels, 0));
});
