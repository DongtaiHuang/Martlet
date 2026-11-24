import assert from "node:assert/strict";
import test from "node:test";
import { describeWeather, forecastAt, forecastUrl, parseForecast, upcomingHours, weatherTip, CAMPUS } from "../lib/weather.ts";

const H = 3600; // seconds; Open-Meteo returns unixtime seconds
const t0 = 1_795_000_000 - (1_795_000_000 % H);
const sample = {
  current: { temperature_2m: -8.4, apparent_temperature: -15.2, weather_code: 73, is_day: 1, wind_speed_10m: 21.6 },
  hourly: {
    time: Array.from({ length: 12 }, (_, i) => t0 + i * H),
    temperature_2m: Array.from({ length: 12 }, (_, i) => -8 + i * 0.5),
    apparent_temperature: Array.from({ length: 12 }, () => -14),
    weather_code: Array.from({ length: 12 }, (_, i) => (i < 6 ? 73 : 3)),
    precipitation_probability: Array.from({ length: 12 }, (_, i) => (i < 6 ? 80 : 10)),
    is_day: Array.from({ length: 12 }, (_, i) => (i < 3 ? 1 : 0)),
  },
  daily: { time: [t0], temperature_2m_max: [-4], temperature_2m_min: [-12], weather_code: [73], precipitation_probability_max: [85] },
};

test("parses Open-Meteo and converts times to ms", () => {
  const f = parseForecast(sample);
  assert.equal(f.now.temp, -8.4);
  assert.equal(f.now.feels, -15.2);
  assert.equal(f.now.isDay, true);
  assert.equal(f.hours.length, 12);
  assert.equal(f.hours[0].time, t0 * 1000);
  assert.deepEqual(f.hours.slice(2, 4).map((h) => h.isDay), [true, false]);
  assert.deepEqual(f.days[0], { time: t0 * 1000, max: -4, min: -12, code: 73, precip: 85 });
});

test("rejects responses without the essentials and skips broken rows", () => {
  for (const bad of [null, "x", {}, { current: { temperature_2m: "cold", weather_code: 0 } }]) assert.equal(parseForecast(bad), null);
  const f = parseForecast({ current: { temperature_2m: 1, weather_code: 0 }, hourly: { time: [t0, t0 + H], temperature_2m: [1, null], weather_code: [0, 0] } });
  assert.equal(f.hours.length, 1);
  assert.equal(f.now.feels, 1, "feels-like falls back to the temperature");
  assert.deepEqual(f.days, []);
});

test("finds the forecast hour for a meetup, and nothing outside the window", () => {
  const f = parseForecast(sample);
  assert.equal(forecastAt(f, (t0 + 2 * H + 1800) * 1000).time, (t0 + 2 * H) * 1000);
  assert.equal(forecastAt(f, (t0 - 1) * 1000), null);
  assert.equal(forecastAt(f, (t0 + 12 * H) * 1000), null);
});

test("upcoming hours start at the current hour", () => {
  const f = parseForecast(sample);
  const hours = upcomingHours(f, (t0 + H + 60) * 1000, 3, 3);
  assert.deepEqual(hours.map((h) => h.time / 1000), [t0 + H, t0 + 4 * H, t0 + 7 * H]);
  assert.deepEqual(upcomingHours(f, (t0 + 99 * H) * 1000), []);
});

test("weather codes and tips", () => {
  assert.equal(describeWeather(0).kind, "clear");
  assert.equal(describeWeather(75).label, "Heavy snow");
  assert.equal(describeWeather(95).kind, "storm");
  assert.equal(describeWeather(1234).label, "Unknown");
  assert.match(weatherTip({ feels: -30, code: 0, precip: 0 }), /Dangerously cold/);
  assert.match(weatherTip({ feels: -16, code: 0, precip: 0 }), /dress warm/);
  assert.match(weatherTip({ feels: 5, code: 63, precip: 70 }), /umbrella/);
  assert.match(weatherTip({ feels: -3, code: 73, precip: 60 }), /boots/);
  assert.equal(weatherTip({ feels: 18, code: 1, precip: 0 }), null);
});

test("only the fixed campus coordinates are requested", () => {
  const url = new URL(forecastUrl());
  assert.equal(url.hostname, "api.open-meteo.com");
  assert.equal(url.searchParams.get("latitude"), String(CAMPUS.latitude));
  assert.equal(url.searchParams.get("longitude"), String(CAMPUS.longitude));
  assert.equal(url.searchParams.get("timeformat"), "unixtime");
});
