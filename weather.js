/* ============================================================
   AMAN PATROL — weather tile (Open-Meteo, free, no API key).
   Shows current conditions for Greenside/Emmarentia with
   rain / wind / heat warnings relevant to patrolling.
   ============================================================ */
(function () {
  "use strict";

  var WMO = {
    0: { label: "Clear sky", icon: "sun" }, 1: { label: "Mostly clear", icon: "sun" },
    2: { label: "Partly cloudy", icon: "partsun" }, 3: { label: "Overcast", icon: "cloud" },
    45: { label: "Fog", icon: "fog" }, 48: { label: "Freezing fog", icon: "fog" },
    51: { label: "Light drizzle", icon: "rain" }, 53: { label: "Drizzle", icon: "rain" }, 55: { label: "Heavy drizzle", icon: "rain" },
    56: { label: "Freezing drizzle", icon: "rain" }, 57: { label: "Freezing drizzle", icon: "rain" },
    61: { label: "Light rain", icon: "rain" }, 63: { label: "Rain", icon: "rain" }, 65: { label: "Heavy rain", icon: "rain" },
    66: { label: "Freezing rain", icon: "rain" }, 67: { label: "Freezing rain", icon: "rain" },
    71: { label: "Light snow", icon: "snow" }, 73: { label: "Snow", icon: "snow" }, 75: { label: "Heavy snow", icon: "snow" },
    77: { label: "Snow grains", icon: "snow" },
    80: { label: "Light showers", icon: "rain" }, 81: { label: "Showers", icon: "rain" }, 82: { label: "Violent showers", icon: "rain" },
    85: { label: "Snow showers", icon: "snow" }, 86: { label: "Snow showers", icon: "snow" },
    95: { label: "Thunderstorm", icon: "storm" }, 96: { label: "Storm with hail", icon: "storm" }, 99: { label: "Storm with hail", icon: "storm" }
  };

  var CACHE_KEY = "aman_weather_cache_v1";
  var CACHE_MS = 30 * 60 * 1000;

  function getCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; }
  }
  function setCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); } catch (e) { /* ignore */ }
  }

  function iconSvg(name) {
    var s = "";
    if (name === "sun") {
      s = '<circle cx="22" cy="22" r="9" fill="#ffd166"/><g stroke="#ffd166" stroke-width="3" stroke-linecap="round">' +
        '<line x1="22" y1="4" x2="22" y2="9"/><line x1="22" y1="35" x2="22" y2="40"/><line x1="4" y1="22" x2="9" y2="22"/><line x1="35" y1="22" x2="40" y2="22"/>' +
        '<line x1="9" y1="9" x2="12.5" y2="12.5"/><line x1="31.5" y1="31.5" x2="35" y2="35"/><line x1="35" y1="9" x2="31.5" y2="12.5"/><line x1="9" y1="35" x2="12.5" y2="31.5"/></g>';
    } else if (name === "moon") {
      s = '<path d="M30 24a11 11 0 0 1-14.5-14.5A12 12 0 1 0 30 24z" fill="#cdd9f0"/>';
    } else if (name === "rain") {
      s = '<path d="M14 26a8 8 0 0 1 1-15.9A11 11 0 0 1 36 12a8 8 0 0 1-1 14z" fill="#9fb4d8"/><g stroke="#7ea8e0" stroke-width="3" stroke-linecap="round"><line x1="16" y1="30" x2="14" y2="37"/><line x1="24" y1="30" x2="22" y2="37"/><line x1="32" y1="30" x2="30" y2="37"/></g>';
    } else if (name === "storm") {
      s = '<path d="M14 24a8 8 0 0 1 1-15.9A11 11 0 0 1 36 10a8 8 0 0 1-1 14z" fill="#9fb4d8"/><path d="M23 24l-5 9h5l-3 8 9-11h-5l3-6z" fill="#ffd166"/>';
    } else if (name === "snow") {
      s = '<path d="M14 24a8 8 0 0 1 1-15.9A11 11 0 0 1 36 10a8 8 0 0 1-1 14z" fill="#c7d6ee"/><g fill="#e8f1ff"><circle cx="16" cy="32" r="2.4"/><circle cx="24" cy="35" r="2.4"/><circle cx="32" cy="32" r="2.4"/></g>';
    } else if (name === "fog") {
      s = '<path d="M14 20a8 8 0 0 1 1-15.9A11 11 0 0 1 36 6a8 8 0 0 1-1 14z" fill="#b9c7dd"/><g stroke="#b9c7dd" stroke-width="3" stroke-linecap="round"><line x1="10" y1="27" x2="36" y2="27"/><line x1="14" y1="34" x2="32" y2="34"/></g>';
    } else if (name === "partsun") {
      s = '<circle cx="17" cy="19" r="8" fill="#ffd166"/><path d="M16 30a8 8 0 0 1 1-15.9A11 11 0 0 1 38 16a8 8 0 0 1-1 14z" fill="#9fb4d8" transform="translate(-2 -2)"/>';
    } else {
      s = '<path d="M14 26a8 8 0 0 1 1-15.9A11 11 0 0 1 36 12a8 8 0 0 1-1 14z" fill="#9fb4d8"/>';
    }
    return '<svg class="w-icon" viewBox="0 0 44 44" aria-hidden="true">' + s + "</svg>";
  }

  function warnings(d) {
    var w = [];
    if (d.precipitation > 0.2 || [61, 63, 65, 80, 81, 82, 95, 96, 99].indexOf(d.weather_code) !== -1)
      w.push("Rain — wear waterproof reflective gear and take extra care on wet roads.");
    if (d.wind_gusts >= 45) w.push("Strong wind gusts — secure loose items; consider shortening the patrol.");
    else if (d.wind_speed >= 30) w.push("Windy conditions — dress warmly.");
    if (d.temperature >= 32) w.push("High heat — carry water and patrol in the shade where possible.");
    if (d.temperature <= 4) w.push("Very cold — dress in warm layers.");
    if ([95, 96, 99].indexOf(d.weather_code) !== -1) w.push("Thunderstorm — avoid open ground and the dam area; lightning risk.");
    if (d.is_day === 0) w.push("After dark — hi-vis vests on, stay in pairs, keep to lit routes.");
    return w.slice(0, 2);
  }

  function fetchCurrent() {
    var c = (window.AREA && window.AREA.center) || { lat: -26.1509, lng: 28.0043 };
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + c.lat + "&longitude=" + c.lng +
      "&current=temperature_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&timezone=Africa%2FJohannesburg";
    return fetch(url).then(function (r) { return r.json(); });
  }

  window.AmanWeather = {
    /** Returns a Promise resolving to { temp, label, icon, iconSvg, wind, gusts, rain, warnings[], stale } */
    current: function () {
      var cached = getCache();
      if (cached && Date.now() - cached.at < CACHE_MS) {
        return Promise.resolve(Object.assign({ stale: false }, cached.data));
      }
      return fetchCurrent().then(function (j) {
        var cur = j && j.current;
        if (!cur) throw new Error("no data");
        var wmo = WMO[cur.weather_code] || { label: "Unknown", icon: "cloud" };
        var isDay = cur.is_day === 1 || cur.is_day === true;
        var iconName = (wmo.icon === "sun" && !isDay) ? "moon" : wmo.icon;
        var data = {
          temp: Math.round(cur.temperature_2m), feels: Math.round(cur.apparent_temperature),
          label: wmo.label, icon: iconName, iconSvg: iconSvg(iconName),
          wind: Math.round(cur.wind_speed_10m), gusts: Math.round(cur.wind_gusts_10m),
          rain: cur.precipitation, is_day: isDay ? 1 : 0,
          warnings: warnings({
            precipitation: cur.precipitation, weather_code: cur.weather_code,
            wind_speed: cur.wind_speed_10m, wind_gusts: cur.wind_gusts_10m,
            temperature: cur.temperature_2m, is_day: isDay ? 1 : 0
          })
        };
        setCache(data);
        return Object.assign({ stale: false }, data);
      }).catch(function () {
        if (cached) return Object.assign({ stale: true }, cached.data);
        throw new Error("offline");
      });
    }
  };
})();
