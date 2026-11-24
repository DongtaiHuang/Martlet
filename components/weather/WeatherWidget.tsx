import { CloudSun, Wind } from "lucide-react";
import { CAMPUS, dayLabel, describeWeather, formatTemp, getCampusWeather, hourLabel, upcomingHours, WEATHER_SOURCE_URL } from "@/lib/weather";
import { WeatherIcon } from "./WeatherIcon";

/** Next hours after the current one, from the moment the server renders. */
async function loadWeather() {
  const forecast = await getCampusWeather();
  return forecast && { ...forecast, next: upcomingHours(forecast, Date.now()).slice(1) };
}

/** Feed widget (issue #138): campus weather now, the next hours and the next five days. */
export async function WeatherWidget() {
  const forecast = await loadWeather();
  const heading = (
    <h2 id="weather-heading" className="flex items-center gap-2 text-lg font-bold text-ink"><CloudSun aria-hidden="true" size={18} className="text-brand-ink" />Campus weather</h2>
  );
  if (!forecast) {
    return (
      <section aria-labelledby="weather-heading" className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        {heading}
        <p className="mt-2 text-sm text-ink-muted">Couldn’t load the forecast right now. Try again in a few minutes.</p>
      </section>
    );
  }
  const { now } = forecast;
  const hours = forecast.next;
  const days = forecast.days.slice(0, 5);
  return (
    <section aria-labelledby="weather-heading" className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      {heading}
      <div className="mt-3 flex items-center gap-4">
        <WeatherIcon code={now.code} isDay={now.isDay} size={44} className="shrink-0 text-brand-ink" />
        <div className="min-w-0">
          <p className="text-4xl font-extrabold tracking-tight text-ink">{formatTemp(now.temp)}<span className="sr-only">C</span></p>
          <p className="text-sm font-semibold text-ink-2">{describeWeather(now.code).label}</p>
        </div>
        <dl className="ml-auto text-right text-xs text-ink-muted">
          <div><dt className="inline">Feels like </dt><dd className="inline font-semibold text-ink-2">{formatTemp(now.feels)}</dd></div>
          <div className="mt-1 flex items-center justify-end gap-1"><Wind aria-hidden="true" size={13} /><dt className="sr-only">Wind</dt><dd className="font-semibold text-ink-2">{Math.round(now.wind)} km/h</dd></div>
        </dl>
      </div>
      {hours.length > 0 && (
        <ol aria-label="Next hours" className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-canvas p-2 text-center">
          {hours.map((h) => (
            <li key={h.time} className="text-xs">
              <span className="block font-semibold text-ink-muted">{hourLabel(h.time)}</span>
              <WeatherIcon code={h.code} isDay={h.isDay} size={18} className="mx-auto my-1 text-ink-soft" />
              <span className="sr-only">{describeWeather(h.code).label}, </span>
              <span className="block font-bold text-ink">{formatTemp(h.temp)}</span>
              {h.precip >= 20 && <span className="block text-ink-muted">{h.precip}%<span className="sr-only"> chance of precipitation</span></span>}
            </li>
          ))}
        </ol>
      )}
      {days.length > 0 && (
        <ol aria-label="Next five days" className="mt-3 divide-y divide-line">
          {days.map((d, i) => (
            <li key={d.time} className="flex items-center gap-3 py-1.5 text-sm">
              <span className="w-12 font-semibold text-ink-2">{i === 0 ? "Today" : dayLabel(d.time)}</span>
              <WeatherIcon code={d.code} size={18} className="shrink-0 text-ink-soft" />
              <span className="min-w-0 flex-1 truncate text-ink-muted">{describeWeather(d.code).label}{d.precip >= 20 ? `, ${d.precip}%` : ""}</span>
              <span className="tabular-nums"><span className="font-bold text-ink">{formatTemp(d.max)}</span> <span className="text-ink-muted">{formatTemp(d.min)}</span><span className="sr-only"> high and low</span></span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-xs text-ink-subtle">{CAMPUS.name}, °C. Data: <a href={WEATHER_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink-muted">Open-Meteo</a></p>
    </section>
  );
}

export function WeatherWidgetLoading() {
  return (
    <section aria-label="Campus weather" className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <p role="status" className="text-sm text-ink-muted">Loading weather…</p>
      <div aria-hidden="true" className="mt-3 h-24 rounded-xl bg-surface-muted motion-safe:animate-pulse" />
    </section>
  );
}
