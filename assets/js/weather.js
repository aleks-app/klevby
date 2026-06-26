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

function updateWeatherChip(chipId, value) {
  const chip = document.getElementById(chipId);
  if (!chip) return;

  const valueEl = chip.querySelector(".home-weather-chip-value");

  if (valueEl) {
    valueEl.textContent = value;
    return;
  }

  chip.textContent = value;
}

function updateMobileWeatherChips({ tempText, windText, biteText }) {
  if (tempText) {
    updateWeatherChip("homeWeatherTempChip", tempText);
  }

  if (windText) {
    updateWeatherChip("homeWeatherWindChip", windText);
  }

  if (biteText) {
    updateWeatherChip("homeWeatherBiteChip", biteText);
  }
}

function formatHomeWeatherPressureText(pressureMm) {
  const pressure = Number(pressureMm);

  if (!Number.isFinite(pressure)) {
    return "—";
  }

  return `${pressure} мм рт. ст.`;
}

function updateMobileWeatherStrip({ tempText, windText, biteText, pressureMm }) {
  updateMobileWeatherChips({ tempText, windText, biteText });

  const pressureEl = document.getElementById("homeWeatherPressure");

  if (pressureEl) {
    pressureEl.textContent = formatHomeWeatherPressureText(pressureMm);
  }
}


function notifyHomeWeatherUpdated() {
  window.dispatchEvent(new CustomEvent("klevgo-home-weather-updated"));
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

function applyWeatherMode(mode) {
  const safeMode = HOME_WEATHER_MODE_LABELS[mode] ? mode : "cloudy";
  const panel = document.getElementById("forecastPanel");
  const mobileCondition = document.getElementById("mobileWeatherCondition");
  const homeCard = document.querySelector("#homeSection .home-weather-card");
  const conditionEl = document.getElementById("homeWeatherCondition");
  const modeIcon = document.getElementById("homeWeatherModeIcon");
  const labels = HOME_WEATHER_MODE_LABELS[safeMode];

  if (panel) {
    panel.classList.remove("weather-sunny", "weather-cloudy", "weather-rainy");
    panel.classList.add(`weather-${safeMode}`);
  }

  if (mobileCondition) {
    mobileCondition.textContent = labels.panel;
  }

  if (homeCard) {
    homeCard.dataset.weatherMode = safeMode;
  }

  if (conditionEl) {
    conditionEl.textContent = labels.card;
  }

  if (modeIcon && HOME_WEATHER_MODE_ICONS[safeMode]) {
    modeIcon.src = HOME_WEATHER_MODE_ICONS[safeMode];
  }
}

function setWeatherAnimation(main, description) {
  applyWeatherMode(getWeatherMode(main, description));
}

function updateBiteForecast(pressureMm) {
  const el = document.getElementById("biteForecast");
  const result = getBiteForecastByPressure(pressureMm);

  if (el) {
    el.className = `bite-line ${result.lineClass}`;
    el.textContent = result.text;
  }

  updateWeatherChip("homeWeatherBiteChip", result.shortText);
}

function getMoonPhaseName() {
  const now = new Date();
  const knownNewMoon = new Date("2000-01-06T18:14:00Z");
  const lunarCycle = 29.53058867;
  const days = (now - knownNewMoon) / 86400000;
  const phase = ((days % lunarCycle) + lunarCycle) % lunarCycle;

  if (phase < 1.85) return "Новолуние";
  if (phase < 5.54) return "Растущий серп";
  if (phase < 9.23) return "Первая четверть";
  if (phase < 12.92) return "Растущая луна";
  if (phase < 16.61) return "Полнолуние";
  if (phase < 20.30) return "Убывающая луна";
  if (phase < 23.99) return "Последняя четверть";
  if (phase < 27.68) return "Убывающий серп";
  return "Новолуние";
}

function windDirection(deg) {
  if (deg === undefined || deg === null) return "";

  const dirs = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
  return dirs[Math.round(deg / 45) % 8];
}

async function fetchWeather() {
  const config = window.KLEVB_CONFIG || {};
  const weatherApiKey = config.WEATHER_API_KEY || window.WEATHER_API_KEY || "";

  const status = document.getElementById("weatherStatus");
  const tempEl = document.getElementById("weatherTemp");
  const windEl = document.getElementById("weatherWind");
  const pressureEl = document.getElementById("weatherPressure");
  const moonEl = document.getElementById("weatherMoon");

  if (!status || !tempEl || !windEl || !pressureEl || !moonEl) return;

  try {
    status.textContent = "Обновляем погоду для Минска...";
    moonEl.textContent = getMoonPhaseName();

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
    const pressureText = `${pressureMm} мм`;
    const biteResult = getBiteForecastByPressure(pressureMm);

    tempEl.textContent = tempText;
    windEl.textContent = windText;
    pressureEl.textContent = pressureText;
    moonEl.textContent = getMoonPhaseName();
    status.textContent = `Минск: ${description}. Данные обновляются автоматически.`;

    updateBiteForecast(pressureMm);
    updateMobileWeatherStrip({
      tempText,
      windText,
      biteText: biteResult.shortText,
      pressureMm
    });

    setWeatherAnimation(main, description);
    notifyHomeWeatherUpdated();
  } catch (error) {
    console.error(error);

    const fallbackTempText = "+14°C";
    const fallbackWindText = "3 м/с СЗ";
    const fallbackPressureMm = 752;
    const fallbackPressureText = `${fallbackPressureMm} мм`;
    const fallbackBiteResult = getBiteForecastByPressure(fallbackPressureMm);

    status.textContent = "Погоду не удалось загрузить. Показываем ориентировочные значения.";
    tempEl.textContent = fallbackTempText;
    windEl.textContent = fallbackWindText;
    pressureEl.textContent = fallbackPressureText;
    moonEl.textContent = getMoonPhaseName();

    updateBiteForecast(fallbackPressureMm);
    updateMobileWeatherStrip({
      tempText: fallbackTempText,
      windText: fallbackWindText,
      biteText: fallbackBiteResult.shortText,
      pressureMm: fallbackPressureMm
    });

    setWeatherAnimation("Clouds", "облачно");
    notifyHomeWeatherUpdated();
  }
}
