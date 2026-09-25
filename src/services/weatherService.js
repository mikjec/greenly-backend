const cache = new Map();
const fail = (message, status = 502) => Object.assign(new Error(message), { status });

async function request(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw fail(response.status === 429 ? "Limit zapytań pogodowych. Spróbuj później." : "Usługa pogodowa jest niedostępna.", response.status === 429 ? 429 : 502);
    const data = await response.json();
    if (data.error) throw fail("Nieprawidłowa odpowiedź usługi pogodowej.");
    return data;
  } catch (error) {
    if (error.status) throw error;
    throw fail("Nie udało się pobrać pogody. Spróbuj ponownie później.");
  }
}

export function weatherDescription(code) {
  if (code === 0) return "Bezchmurnie";
  if ([1, 2, 3].includes(code)) return "Zachmurzenie";
  if ([45, 48].includes(code)) return "Mgła";
  if ([51, 53, 55, 56, 57].includes(code)) return "Mżawka";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Deszcz";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Śnieg";
  if ([95, 96, 99].includes(code)) return "Burza";
  return "Brak opisu warunków";
}

export async function getWeatherData(location) {
  if (typeof location !== "string" || !location.trim() || location.length > 255) throw fail("Podaj miejscowość lub współrzędne mikroklimatu.", 400);
  const key = location.trim();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const coordinates = key.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  let latitude, longitude, name = key;
  if (coordinates) {
    latitude = Number(coordinates[1]); longitude = Number(coordinates[2]);
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw fail("Współrzędne są poza dozwolonym zakresem.", 400);
  } else {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.search = new URLSearchParams({ name: key, count: "1", language: "pl", format: "json" });
    const geo = await request(url);
    const place = geo.results?.[0];
    if (!place) throw fail("Nie znaleziono miejscowości. Podaj jej nazwę lub współrzędne, np. 52.23, 21.01.", 404);
    ({ latitude, longitude } = place);
    name = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw fail("Nieprawidłowe współrzędne w odpowiedzi usługi pogodowej.");
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({ latitude, longitude, current: "temperature_2m,relative_humidity_2m,weather_code", daily: "rain_sum,showers_sum,temperature_2m_max", timezone: "auto", forecast_days: "1" });
  const data = await request(url);
  const current = data.current;
  const rain = data.daily?.rain_sum?.[0];
  const showers = data.daily?.showers_sum?.[0];
  const maxTemperature = data.daily?.temperature_2m_max?.[0];
  if (![current?.temperature_2m, current?.relative_humidity_2m, rain, showers, maxTemperature].every(Number.isFinite) || !current?.time || !data.daily?.time?.[0]) throw fail("Usługa pogodowa zwróciła niekompletne dane.");
  const precipitationMm = Math.round((rain + showers) * 10) / 10;
  const value = {
    location: name, latitude, longitude, source: "Open-Meteo", timezone: data.timezone,
    observedAt: current.time, forecastDate: data.daily.time[0], fetchedAt: new Date().toISOString(),
    condition: weatherDescription(current.weather_code), temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m, maxTemperature, precipitationMm,
    rainExpected: precipitationMm >= 2,
  };
  if (cache.size >= 200) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + 15 * 60 * 1000 });
  return value;
}

// Use fixed calendar targets, so repeated runs do not compound adjustments.
export function adjustedWateringDate(dueDate, weather, now = new Date()) {
  const due = new Date(dueDate);
  if (!Number.isFinite(due.getTime())) return null;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const afterTomorrow = new Date(today); afterTomorrow.setDate(today.getDate() + 2);
  if (weather.rainExpected && due >= today && due < tomorrow) return afterTomorrow;
  if (!weather.rainExpected && weather.maxTemperature >= 28 && due >= tomorrow && due < afterTomorrow) return today;
  return null;
}
