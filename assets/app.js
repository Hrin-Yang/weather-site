const form = document.querySelector("#search-form");
const input = document.querySelector("#city-input");
const statusBar = document.querySelector("#status-bar");
const statusText = document.querySelector("#status-text");
const dashboard = document.querySelector("#dashboard");
const contentGrid = document.querySelector("#content-grid");
const recentPanel = document.querySelector("#recent-panel");
const recentList = document.querySelector("#recent-list");
const areaOptions = document.querySelector("#area-options");
const pickerTitle = document.querySelector("#picker-title");
const tabButtons = [...document.querySelectorAll("[data-level]")];

const HISTORY_KEY = "weather-site-search-history";

const cityAliases = {
  "浠水": { name: "浠水", admin1: "湖北省", admin2: "黄冈市", country: "中国", latitude: 30.4518, longitude: 115.2655 },
  "浠水县": { name: "浠水县", admin1: "湖北省", admin2: "黄冈市", country: "中国", latitude: 30.4518, longitude: 115.2655 },
  "黄冈": { name: "黄冈", admin1: "湖北省", admin2: "", country: "中国", latitude: 30.4535, longitude: 114.8724 },
  "武汉": { name: "武汉", admin1: "湖北省", admin2: "", country: "中国", latitude: 30.5928, longitude: 114.3055 },
  "上海": { name: "上海", admin1: "上海市", admin2: "", country: "中国", latitude: 31.2304, longitude: 121.4737 }
};

const weatherMap = {
  0: ["晴朗", "☀"],
  1: ["大部晴朗", "🌤"],
  2: ["局部多云", "⛅"],
  3: ["阴天", "☁"],
  45: ["有雾", "🌫"],
  48: ["雾凇", "🌫"],
  51: ["小毛毛雨", "🌦"],
  53: ["毛毛雨", "🌦"],
  55: ["较强毛毛雨", "🌧"],
  61: ["小雨", "🌧"],
  63: ["中雨", "🌧"],
  65: ["大雨", "🌧"],
  80: ["阵雨", "🌦"],
  81: ["较强阵雨", "🌧"],
  82: ["强阵雨", "⛈"],
  95: ["雷阵雨", "⛈"],
  96: ["雷阵雨伴冰雹", "⛈"],
  99: ["强雷阵雨伴冰雹", "⛈"]
};

const pickerState = {
  areaData: {},
  province: "",
  city: "",
  level: "province"
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadWeather(input.value.trim());
});

input.addEventListener("focus", () => {
  renderHistory();
  showLevel("province");
});

input.addEventListener("input", () => {
  renderFilteredAreas(input.value.trim());
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => showLevel(button.dataset.level));
});

init();

async function init() {
  try {
    const response = await fetch("./assets/area-data.json");
    pickerState.areaData = await response.json();
  } catch {
    pickerState.areaData = {};
  }

  renderHistory();
  renderAreaOptions();
  loadWeather("浠水");
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusBar.classList.toggle("error", isError);
}

async function loadWeather(city) {
  if (!city) {
    setStatus("先输入或选择一个地区。", true);
    return;
  }

  setStatus(`正在查找 ${city} 的天气...`);
  dashboard.hidden = true;
  contentGrid.hidden = true;

  try {
    const place = await resolvePlace(city);
    const weather = await fetchWeather(place);
    renderWeather(place, weather);
    saveHistory(city);
    renderHistory();
    setStatus(`已更新：${formatPlace(place)}`);
    dashboard.hidden = false;
    contentGrid.hidden = false;
  } catch (error) {
    setStatus(error.message || "天气数据读取失败，请换个城市试试。", true);
  }
}

async function resolvePlace(city) {
  if (cityAliases[city]) {
    return cityAliases[city];
  }

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "zh");
  url.searchParams.set("format", "json");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("城市查询失败，请稍后再试。");
  }

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`没有找到“${city}”，可以试试输入上级城市。`);
  }

  return data.results[0];
}

async function fetchWeather(place) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", place.latitude);
  url.searchParams.set("longitude", place.longitude);
  url.searchParams.set("timezone", "Asia/Shanghai");
  url.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code");
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,precipitation,weather_code");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max");
  url.searchParams.set("forecast_days", "7");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("天气服务暂时没有响应。");
  }

  return response.json();
}

function renderWeather(place, weather) {
  const today = {
    rainProbability: weather.daily.precipitation_probability_max[0] ?? 0,
    rainTotal: weather.daily.precipitation_sum[0] ?? 0,
    max: weather.daily.temperature_2m_max[0],
    min: weather.daily.temperature_2m_min[0],
    code: weather.daily.weather_code[0]
  };
  const currentCode = weather.current.weather_code;
  const currentWeather = getWeather(currentCode);
  const advice = buildAdvice(today, currentCode, weather.current.temperature_2m);

  document.querySelector("#location-label").textContent = formatPlace(place);
  document.querySelector("#weather-title").textContent = currentWeather.label;
  document.querySelector("#weather-icon").textContent = currentWeather.icon;
  document.querySelector("#current-temp").textContent = `${Math.round(weather.current.temperature_2m)}°`;
  document.querySelector("#weather-summary").textContent = `今天最高 ${Math.round(today.max)}°，最低 ${Math.round(today.min)}°，降雨概率 ${today.rainProbability}%。`;
  document.querySelector("#advice-title").textContent = advice.title;
  document.querySelector("#advice-body").textContent = advice.body;
  document.querySelector("#rain-probability").textContent = `${today.rainProbability}%`;
  document.querySelector("#rain-total").textContent = `${today.rainTotal.toFixed(1)} mm`;
  document.querySelector("#temp-range").textContent = `${Math.round(today.max)}° / ${Math.round(today.min)}°`;
  document.querySelector("#apparent-temp").textContent = `${Math.round(weather.current.apparent_temperature)}°`;

  renderHours(weather.hourly);
  renderForecast(weather.daily);
  renderTips(today, weather.current.temperature_2m);
}

function showLevel(level) {
  if (level === "city" && !pickerState.province) return;
  if (level === "district" && !pickerState.city) return;
  pickerState.level = level;
  renderAreaOptions();
}

function renderAreaOptions() {
  const { areaData, province, city, level } = pickerState;
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.level === level);
    if (button.dataset.level === "city") button.disabled = !province;
    if (button.dataset.level === "district") button.disabled = !city;
  });

  if (level === "province") {
    pickerTitle.textContent = "选择省份";
    renderChips(Object.keys(areaData), selectProvince);
    return;
  }

  if (level === "city") {
    pickerTitle.textContent = `选择城市 · ${province}`;
    renderChips(Object.keys(areaData[province] || {}), selectCity);
    return;
  }

  pickerTitle.textContent = `选择区县 · ${city}`;
  renderChips((areaData[province] && areaData[province][city]) || [], selectDistrict);
}

function renderFilteredAreas(keyword) {
  if (!keyword) {
    renderAreaOptions();
    return;
  }

  const results = [];
  Object.entries(pickerState.areaData).forEach(([province, cities]) => {
    if (province.includes(keyword)) results.push({ label: province, value: province, type: "province" });
    Object.entries(cities).forEach(([city, districts]) => {
      if (city.includes(keyword)) results.push({ label: `${province} · ${city}`, value: city, type: "city" });
      districts.forEach((district) => {
        if (district.includes(keyword)) results.push({ label: `${city} · ${district}`, value: district, type: "district" });
      });
    });
  });

  pickerTitle.textContent = results.length ? "搜索匹配地区" : "未找到匹配地区，可直接点查看";
  renderChips(results.slice(0, 36), (item) => {
    const value = item.value || item;
    input.value = value;
    loadWeather(value);
  });
}

function renderChips(items, handler) {
  areaOptions.innerHTML = "";
  items.forEach((item) => {
    const label = typeof item === "string" ? item : item.label;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = cleanAreaName(label);
    button.addEventListener("click", () => handler(item));
    areaOptions.appendChild(button);
  });
}

function selectProvince(province) {
  pickerState.province = province;
  pickerState.city = "";
  pickerState.level = "city";
  input.value = cleanAreaName(province);
  renderAreaOptions();
}

function selectCity(city) {
  pickerState.city = city;
  pickerState.level = "district";
  input.value = cleanAreaName(city);
  renderAreaOptions();
}

function selectDistrict(district) {
  input.value = cleanAreaName(district);
  loadWeather(district);
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(city) {
  const clean = cleanAreaName(city);
  const next = [clean, ...getHistory().filter((item) => item !== clean)].slice(0, 8);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

function renderHistory() {
  const history = getHistory();
  recentPanel.hidden = history.length === 0;
  recentList.innerHTML = "";
  history.forEach((city) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = city;
    button.addEventListener("click", () => {
      input.value = city;
      loadWeather(city);
    });
    recentList.appendChild(button);
  });
}

function getWeather(code) {
  const found = weatherMap[code] || ["天气变化", "🌈"];
  return { label: found[0], icon: found[1] };
}

function formatPlace(place) {
  return [place.country, place.admin1, place.admin2, place.name]
    .filter(Boolean)
    .map(cleanAreaName)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(" · ");
}

function cleanAreaName(name) {
  return String(name || "")
    .replace(/省$/, "")
    .replace(/市$/, "")
    .replace(/县$/, "")
    .replace(/区$/, "");
}

function buildAdvice(day, code, temp) {
  const rainyCode = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code);
  if (day.rainProbability >= 60 || day.rainTotal >= 3 || rainyCode) {
    return {
      title: "建议带伞，下午更要留意",
      body: "今天存在明显降雨机会，出门把折叠伞放包里最稳。若有雷阵雨，尽量避开空旷地带和临时户外安排。"
    };
  }

  if (day.rainProbability >= 35 || day.rainTotal > 0) {
    return {
      title: "可以出门，但伞别离太远",
      body: "降雨不算强，但有零星或短时降雨可能。通勤、逛街、拿快递这种短途，带一把轻便伞会舒服很多。"
    };
  }

  if (temp >= 32) {
    return {
      title: "雨不明显，防晒和补水更重要",
      body: "今天更像热感天气，适合轻薄衣物。外出记得防晒，长时间在户外要补水。"
    };
  }

  return {
    title: "天气友好，适合安排出门",
    body: "降雨风险较低，可以把注意力放在穿搭舒适度和行程节奏上。早晚温差变化时，带件薄外套也不错。"
  };
}

function renderHours(hourly) {
  const list = document.querySelector("#hour-list");
  const bestWindow = document.querySelector("#best-window");
  list.innerHTML = "";

  const now = new Date();
  const nextHours = hourly.time
    .map((time, index) => ({ time, index, date: new Date(time) }))
    .filter((item) => item.date >= now)
    .slice(0, 12);

  const hoursToShow = nextHours.length ? nextHours : hourly.time.slice(0, 12).map((time, index) => ({ time, index, date: new Date(time) }));
  const driest = hoursToShow.reduce((best, item) => {
    const probability = hourly.precipitation_probability[item.index] ?? 0;
    return probability < best.probability ? { item, probability } : best;
  }, { item: hoursToShow[0], probability: 101 });

  bestWindow.textContent = `更适合出门：${formatHour(driest.item.time)} 左右，降雨概率约 ${driest.probability}%`;

  hoursToShow.forEach(({ time, index }) => {
    const probability = hourly.precipitation_probability[index] ?? 0;
    const amount = hourly.precipitation[index] ?? 0;
    const code = getWeather(hourly.weather_code[index]);
    const row = document.createElement("div");
    row.className = "hour-item";
    row.innerHTML = `
      <strong>${formatHour(time)}</strong>
      <div>
        <div class="rain-track"><div class="rain-fill" style="width:${Math.max(probability, 3)}%"></div></div>
        <small>${code.label} · ${amount.toFixed(1)} mm</small>
      </div>
      <strong>${probability}%</strong>
    `;
    list.appendChild(row);
  });
}

function renderForecast(daily) {
  const list = document.querySelector("#forecast-list");
  list.innerHTML = "";

  daily.time.forEach((date, index) => {
    const code = getWeather(daily.weather_code[index]);
    const row = document.createElement("div");
    row.className = "forecast-item";
    row.innerHTML = `
      <span>${code.icon}</span>
      <div>
        <strong>${formatDate(date, index)}</strong>
        <small>${code.label} · 降雨概率 ${daily.precipitation_probability_max[index] ?? 0}%</small>
      </div>
      <strong>${Math.round(daily.temperature_2m_max[index])}° / ${Math.round(daily.temperature_2m_min[index])}°</strong>
    `;
    list.appendChild(row);
  });
}

function renderTips(day, temp) {
  const tips = [
    ["伞", day.rainProbability >= 35 ? "带伞指数高" : "带伞指数低", day.rainProbability >= 35 ? "包里放轻便伞，临时阵雨也不会狼狈。" : "雨水干扰不大，短途出门可以轻装。"],
    ["穿", temp >= 30 ? "清爽透气" : "舒适日常", temp >= 30 ? "选轻薄速干面料，午后会更舒服。" : "正常穿搭即可，早晚可按体感加一层。"],
    ["行", day.rainTotal >= 3 ? "避开雨峰" : "行程友好", day.rainTotal >= 3 ? "把户外安排放在降雨概率较低的时段。" : "通勤和出游节奏都比较好安排。"],
    ["晒", temp >= 28 ? "注意防晒" : "阳光温和", temp >= 28 ? "帽子、防晒霜和水杯会很有用。" : "户外体感相对轻松，注意及时补水。"]
  ];

  const grid = document.querySelector("#tips-grid");
  grid.innerHTML = "";
  tips.forEach(([icon, title, body]) => {
    const item = document.createElement("div");
    item.className = "tip-item";
    item.innerHTML = `
      <span class="tip-icon">${icon}</span>
      <div>
        <h4>${title}</h4>
        <p>${body}</p>
      </div>
    `;
    grid.appendChild(item);
  });
}

function formatHour(value) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function formatDate(value, index) {
  if (index === 0) return "今天";
  if (index === 1) return "明天";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", weekday: "short" }).format(new Date(value));
}
