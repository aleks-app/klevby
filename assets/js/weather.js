function getBiteForecastByPressure(pressureMm) {
  const pressure = Number(pressureMm);

  if (!Number.isFinite(pressure)) {
    return {
      text: "Прогноз средний, нужно пробовать.",
      shortText: "Средний",
      lineClass: "bite-medium-line"
    };
  }

  if (pressure >= 755 && pressure <= 765) {
    return {
      text: "Прогноз отличный! 🎣",
      shortText: "Отличный",
      lineClass: "bite-good-line"
    };
  }

  return {
    text: "Прогноз средний, нужно пробовать.",
    shortText: "Средний",
    lineClass: "bite-medium-line"
  };
}

function formatHomeWeatherPressureText(pressureMm) {
  const pressure = Number(pressureMm);

  if (!Number.isFinite(pressure)) {
    return "—";
  }

  return `${pressure} мм рт. ст.`;
}

function getWeatherMode(main, description) {
  const text = `${main || ""} ${description || ""}`.toLowerCase();

  if (text.includes("rain") || text.includes("drizzle") || text.includes("дожд")) {
    return "rainy";
  }

  if (
    text.includes("cloud") ||
    text.includes("облач") ||
    text.includes("пасмур") ||
    text.includes("туман") ||
    text.includes("mist") ||
    text.includes("fog")
  ) {
    return "cloudy";
  }

  return "sunny";
}

const HOME_WEATHER_MODE_LABELS = {
  sunny: { panel: "☀️ Солнце", card: "Солнечно" },
  cloudy: { panel: "☁️ Облачно", card: "Облачно" },
  rainy: { panel: "🌧️ Дождь", card: "Дождь" }
};

const HOME_WEATHER_MODE_ICONS = {
  sunny: "assets/icons/weather/sun.svg",
  cloudy: "assets/icons/weather/cloud-sun.svg",
  rainy: "assets/icons/weather/cloud-rain-wind.svg"
};

function getSafeWeatherMode(mode) {
  return HOME_WEATHER_MODE_LABELS[mode] ? mode : "cloudy";
}

function publishKlevGoWeatherState({
  mode = "weather",
  weatherMode = "cloudy",
  tempText,
  conditionText,
  windText,
  pressureText,
  biteIconSrc = "assets/icons/weather/fish-light.svg",
  biteTitle,
  biteDescription
}) {
  const safeWeatherMode = getSafeWeatherMode(weatherMode);
  const nextState = {
    mode,
    iconSrc: HOME_WEATHER_MODE_ICONS[safeWeatherMode],
    tempText,
    conditionText: conditionText || HOME_WEATHER_MODE_LABELS[safeWeatherMode].card,
    windText,
    pressureText,
    biteIconSrc,
    biteTitle,
    biteDescription,
    updatedAt: new Date().toISOString()
  };

  window.KlevGoWeatherState = nextState;
  window.dispatchEvent(new CustomEvent("klevgo:weather-updated", {
    detail: nextState
  }));
}

function windDirection(deg) {
  if (deg === undefined || deg === null) return "";

  const dirs = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
  return dirs[Math.round(deg / 45) % 8];
}

async function fetchWeather() {
  const config = window.KLEVB_CONFIG || {};
  const weatherApiKey = config.WEATHER_API_KEY || window.WEATHER_API_KEY || "";

  try {
    if (!weatherApiKey) {
      throw new Error("weather_key_missing");
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=Minsk,BY&appid=${weatherApiKey}&units=metric&lang=ru`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("weather_error");
    }

    const data = await response.json();

    const temp = Math.round(data.main.temp);
    const wind = data.wind?.speed ?? 0;
    const windDeg = data.wind?.deg;
    const pressureHpa = data.main.pressure;
    const pressureMm = Math.round(pressureHpa * 0.75006);
    const description = data.weather?.[0]?.description || "погода обновлена";
    const main = data.weather?.[0]?.main || "";

    const tempText = `${temp > 0 ? "+" : ""}${temp}°C`;
    const windText = `${Math.round(wind)} м/с ${windDirection(windDeg)}`;
    const biteResult = getBiteForecastByPressure(pressureMm);
    const weatherMode = getWeatherMode(main, description);

    publishKlevGoWeatherState({
      weatherMode,
      tempText,
      conditionText: HOME_WEATHER_MODE_LABELS[getSafeWeatherMode(weatherMode)].card,
      windText,
      pressureText: formatHomeWeatherPressureText(pressureMm),
      biteTitle: biteResult.shortText,
      biteDescription: biteResult.text
    });
  } catch (error) {
    console.error(error);

    const fallbackTempText = "+14°C";
    const fallbackWindText = "3 м/с СЗ";
    const fallbackPressureMm = 752;
    const fallbackBiteResult = getBiteForecastByPressure(fallbackPressureMm);

    publishKlevGoWeatherState({
      weatherMode: getWeatherMode("Clouds", "облачно"),
      tempText: fallbackTempText,
      conditionText: HOME_WEATHER_MODE_LABELS.cloudy.card,
      windText: fallbackWindText,
      pressureText: formatHomeWeatherPressureText(fallbackPressureMm),
      biteTitle: fallbackBiteResult.shortText,
      biteDescription: fallbackBiteResult.text
    });
  }
}
