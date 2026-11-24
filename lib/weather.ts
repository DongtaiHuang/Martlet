// Campus weather (issue #138, ADR 0032). Open-Meteo: free, no API key. The coordinates are
// McGill's downtown campus, never the student's position (ADR 0008).

export const CAMPUS = { latitude: 45.5048, longitude: -73.5772, name: "McGill downtown campus" } as const;
export const WEATHER_SOURCE_URL = "https://open-meteo.com/";
const TIME_ZONE = "America/Montreal";

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export interface WeatherNow { temp: number; feels: number; code: number; isDay: boolean; wind: number }
export interface WeatherHour { time: number; temp: number; feels: number; code: number; precip: number; isDay: boolean }
export interface WeatherDay { time: number; max: number; min: number; code: number; precip: number }
export interface Forecast { now: WeatherNow; hours: WeatherHour[]; days: WeatherDay[] }

/** WMO weather interpretation codes, as Open-Meteo reports them. */
export function describeWeather(code: number): { label: string; kind: WeatherKind } {
  if (code === 0) return { label: "Clear", kind: "clear" };
  if (code === 1) return { label: "Mostly clear", kind: "partly" };
  if (code === 2) return { label: "Partly cloudy", kind: "partly" };
  if (code === 3) return { label: "Overcast", kind: "cloudy" };
  if (code === 45 || code === 48) return { label: code === 48 ? "Freezing fog" : "Fog", kind: "fog" };
  if (code >= 51 && code <= 55) return { label: "Drizzle", kind: "drizzle" };
  if (code === 56 || code === 57) return { label: "Freezing drizzle", kind: "drizzle" };
  if (code === 66 || code === 67) return { label: "Freezing rain", kind: "rain" };
  if (code >= 61 && code <= 65) return { label: code === 65 ? "Heavy rain" : code === 61 ? "Light rain" : "Rain", kind: "rain" };
  if (code >= 80 && code <= 82) return { label: "Rain showers", kind: "rain" };
  if (code === 77) return { label: "Snow grains", kind: "snow" };
  if (code >= 71 && code <= 75) return { label: code === 75 ? "Heavy snow" : code === 71 ? "Light snow" : "Snow", kind: "snow" };
  if (code === 85 || code === 86) return { label: "Snow showers", kind: "snow" };
  if (code === 95 || code === 96 || code === 99) return { label: code === 95 ? "Thunderstorm" : "Thunderstorm with hail", kind: "storm" };
  return { label: "Unknown", kind: "cloudy" };
}

export function forecastUrl(): string {
  const params = new URLSearchParams({
    latitude: String(CAMPUS.latitude),
    longitude: String(CAMPUS.longitude),
    current: "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m",
    hourly: "temperature_2m,apparent_temperature,weather_code,precipitation_probability,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: TIME_ZONE,
    timeformat: "unixtime",
    forecast_days: "7",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** Validates an Open-Meteo response; null if the essentials are missing. Times become epoch ms. */
export function parseForecast(json: unknown): Forecast | null {
  const root = rec(json), c = rec(root.current), h = rec(root.hourly), d = rec(root.daily);
  const temp = num(c.temperature_2m), code = num(c.weather_code);
  if (temp === null || code === null) return null;
  const now: WeatherNow = {
    temp, code,
    feels: num(c.apparent_temperature) ?? temp,
    isDay: c.is_day !== 0,
    wind: num(c.wind_speed_10m) ?? 0,
  };
  const hours: WeatherHour[] = [];
  arr(h.time).forEach((t, i) => {
    const time = num(t), temp = num(arr(h.temperature_2m)[i]), code = num(arr(h.weather_code)[i]);
    if (time === null || temp === null || code === null) return;
    hours.push({ time: time * 1000, temp, code, feels: num(arr(h.apparent_temperature)[i]) ?? temp, precip: num(arr(h.precipitation_probability)[i]) ?? 0, isDay: arr(h.is_day)[i] !== 0 });
  });
  const days: WeatherDay[] = [];
  arr(d.time).forEach((t, i) => {
    const time = num(t), max = num(arr(d.temperature_2m_max)[i]), min = num(arr(d.temperature_2m_min)[i]), code = num(arr(d.weather_code)[i]);
    if (time === null || max === null || min === null || code === null) return;
    days.push({ time: time * 1000, max, min, code, precip: num(arr(d.precipitation_probability_max)[i]) ?? 0 });
  });
  return { now, hours, days };
}

/** The forecast hour for a moment, or null if it's outside the forecast (past, or over 7 days out). */
export function forecastAt(forecast: Forecast, at: number): WeatherHour | null {
  const hour = 3_600_000;
  const match = forecast.hours.find((h) => at >= h.time && at < h.time + hour);
  return match ?? null;
}

/** The next `count` hours from now, `step` hours apart. */
export function upcomingHours(forecast: Forecast, now: number, count = 5, step = 3): WeatherHour[] {
  const start = forecast.hours.findIndex((h) => h.time + 3_600_000 > now);
  if (start < 0) return [];
  return forecast.hours.slice(start).filter((_, i) => i % step === 0).slice(0, count);
}

/** A short tip for a meetup at this hour, or null when nothing's worth saying. */
export function weatherTip(hour: Pick<WeatherHour, "feels" | "code" | "precip">): string | null {
  const { kind } = describeWeather(hour.code);
  if (hour.feels <= -25) return "Dangerously cold: dress in layers and cover skin.";
  if (hour.feels <= -15) return "Very cold: dress warm.";
  if (kind === "storm") return "Thunderstorms expected: an indoor spot is safer.";
  if (kind === "snow" && hour.precip >= 40) return "Snow likely: wear boots.";
  if ((kind === "rain" || kind === "drizzle") && hour.precip >= 40) return "Rain likely: bring an umbrella.";
  if (hour.feels >= 30) return "Hot: bring water.";
  return null;
}

export const formatTemp = (t: number) => `${Math.round(t)}°`;

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, ...opts });
export const hourLabel = (time: number) => fmt({ hour: "numeric" }).format(time).replace(/\./g, "");
export const dayLabel = (time: number) => fmt({ weekday: "short" }).format(time);

/** Today's forecast for McGill, or null if Open-Meteo can't be reached. Shared cache, 15 minutes. */
export async function getCampusWeather(): Promise<Forecast | null> {
  try {
    const res = await fetch(forecastUrl(), { next: { revalidate: 900 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return parseForecast(await res.json());
  } catch (error) {
    console.warn("Weather unavailable", error);
    return null;
  }
}
