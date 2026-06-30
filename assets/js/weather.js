function markKlevgoStartupTiming(step, phase, detail) {
  if (typeof window.klevgoStartupTimingMark === "function") {
    window.klevgoStartupTimingMark(step, phase, detail);
  }
}

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

const WEATHER_FETCH_TIMEOUT_MS = 3500;
const LAST_REAL_WEATHER_STATE_STORAGE_KEY = "klevgo:lastRealWeatherState";

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
  biteDescription,
  isFallback = false,
  isUnavailable = false,
  source = "live",
  errorCode = null,
  lastRealUpdatedAt,
  fallbackUsedAt
}) {
  const safeWeatherMode = getSafeWeatherMode(weatherMode);
  const nextState = {
    mode,
    weatherMode: safeWeatherMode,
    iconSrc: HOME_WEATHER_MODE_ICONS[safeWeatherMode],
    tempText,
    conditionText: conditionText || HOME_WEATHER_MODE_LABELS[safeWeatherMode].card,
    windText,
    pressureText,
    biteIconSrc,
    biteTitle,
    biteDescription,
    isFallback,
    isUnavailable,
    source,
    errorCode,
    updatedAt: new Date().toISOString()
  };

  if (lastRealUpdatedAt) {
    nextState.lastRealUpdatedAt = lastRealUpdatedAt;
  }

  if (fallbackUsedAt) {
    nextState.fallbackUsedAt = fallbackUsedAt;
  }

  window.KlevGoWeatherState = nextState;
  window.dispatchEvent(new CustomEvent("klevgo:weather-updated", {
    detail: nextState
  }));
}


let lastRealWeatherState = null;

function getWeatherErrorCode(error) {
  if (error?.message) return error.message;
  if (error?.name) return error.name;
  return "weather_error";
}

function readLastRealWeatherState() {
  if (lastRealWeatherState) return lastRealWeatherState;

  try {
    const savedState = window.localStorage?.getItem(LAST_REAL_WEATHER_STATE_STORAGE_KEY);
    if (!savedState) return null;

    const parsedState = JSON.parse(savedState);
    if (!parsedState || typeof parsedState !== "object") return null;
    if (parsedState.isFallback || parsedState.isUnavailable || parsedState.source !== "live") return null;
    if (typeof parsedState.tempText !== "string" || typeof parsedState.updatedAt !== "string") return null;

    lastRealWeatherState = parsedState;
    return lastRealWeatherState;
  } catch (error) {
    console.warn("Failed to read last real weather state", error);
    return null;
  }
}

function saveLastRealWeatherState(state) {
  if (!state || state.isFallback || state.isUnavailable || state.source !== "live") return;

  const safeState = {
    mode: state.mode,
    weatherMode: state.weatherMode,
    iconSrc: state.iconSrc,
    tempText: state.tempText,
    conditionText: state.conditionText,
    windText: state.windText,
    pressureText: state.pressureText,
    biteIconSrc: state.biteIconSrc,
    biteTitle: state.biteTitle,
    biteDescription: state.biteDescription,
    isFallback: false,
    isUnavailable: false,
    source: "live",
    errorCode: null,
    updatedAt: state.updatedAt
  };

  lastRealWeatherState = safeState;

  try {
    window.localStorage?.setItem(LAST_REAL_WEATHER_STATE_STORAGE_KEY, JSON.stringify(safeState));
  } catch (error) {
    console.warn("Failed to save last real weather state", error);
  }
}

function publishLastRealWeatherFallback(errorCode) {
  const state = readLastRealWeatherState();
  if (!state) return false;

  publishKlevGoWeatherState({
    mode: state.mode,
    weatherMode: state.weatherMode,
    tempText: state.tempText,
    conditionText: state.conditionText,
    windText: state.windText,
    pressureText: state.pressureText,
    biteIconSrc: state.biteIconSrc,
    biteTitle: state.biteTitle,
    biteDescription: state.biteDescription,
    isFallback: true,
    isUnavailable: false,
    source: "last-real",
    errorCode,
    lastRealUpdatedAt: state.updatedAt,
    fallbackUsedAt: new Date().toISOString()
  });

  return true;
}

function publishUnavailableWeatherState(errorCode) {
  publishKlevGoWeatherState({
    weatherMode: "cloudy",
    tempText: "—°C",
    conditionText: "Обновляем…",
    windText: "— м/с",
    pressureText: "— мм рт. ст.",
    biteTitle: "Нет данных",
    biteDescription: "Погода обновится, когда появится связь.",
    isFallback: true,
    isUnavailable: true,
    source: "unavailable",
    errorCode
  });
}

function windDirection(deg) {
  if (deg === undefined || deg === null) return "";

  const dirs = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
  return dirs[Math.round(deg / 45) % 8];
}

function createWeatherTimeoutError() {
  return new Error("weather_timeout");
}

async function fetchWeatherWithTimeout(url, timeoutMs = WEATHER_FETCH_TIMEOUT_MS) {
  if (typeof AbortController === "function") {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      return await fetch(url, { signal: controller.signal });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw createWeatherTimeoutError();
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(createWeatherTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetch(url),
      timeoutPromise
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchWeather() {
  markKlevgoStartupTiming("fetchWeather", "start");

  const config = window.KLEVB_CONFIG || {};
  const weatherApiKey = config.WEATHER_API_KEY || window.WEATHER_API_KEY || "";

  try {
    if (!weatherApiKey) {
      throw new Error("weather_key_missing");
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=Minsk,BY&appid=${weatherApiKey}&units=metric&lang=ru`;
    const response = await fetchWeatherWithTimeout(url);

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
      biteDescription: biteResult.text,
      isFallback: false,
      isUnavailable: false,
      source: "live",
      errorCode: null
    });
    saveLastRealWeatherState(window.KlevGoWeatherState);
    markKlevgoStartupTiming("fetchWeather", "end");
  } catch (error) {
    markKlevgoStartupTiming("fetchWeather", "error", error);
    console.error(error);

    const errorCode = getWeatherErrorCode(error);
    if (!publishLastRealWeatherFallback(errorCode)) {
      publishUnavailableWeatherState(errorCode);
    }
  }
}
