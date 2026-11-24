import { describeWeather, forecastAt, formatTemp, getCampusWeather, weatherTip } from "@/lib/weather";
import { WeatherIcon } from "./WeatherIcon";

/** Forecast for a meetup's start time (issue #138). Renders nothing outside the 7-day forecast. */
export async function MeetupWeather({ startsAt }: { startsAt: string }) {
  const forecast = await getCampusWeather();
  const hour = forecast ? forecastAt(forecast, Date.parse(startsAt)) : null;
  if (!hour) return null;
  const tip = weatherTip(hour);
  return (
    <div>
      <dt className="relative pl-7 text-sm font-bold"><WeatherIcon code={hour.code} isDay={hour.isDay} size={18} className="absolute top-0 left-0 text-brand-ink" />Forecast</dt>
      <dd className="pl-7 text-sm text-ink-2">
        {formatTemp(hour.temp)}C, {describeWeather(hour.code).label.toLowerCase()}
        {Math.round(hour.feels) !== Math.round(hour.temp) && `, feels like ${formatTemp(hour.feels)}`}
        {hour.precip >= 20 && `, ${hour.precip}% chance of precipitation`}
        {tip && <span className="mt-1 block font-semibold text-ink">{tip}</span>}
      </dd>
    </div>
  );
}
