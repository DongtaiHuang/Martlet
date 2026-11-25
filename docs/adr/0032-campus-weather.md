# 0032. Campus weather from Open-Meteo

- **Status:** Accepted
- **Date:** 2026-11-24
- **Issue:** #138

## Context

Students plan meetups around Montreal weather: wind chill in winter, rain in spring and fall. The feed has a customisable widget sidebar (ADR 0031), and each meetup has a start time, so both are natural places to show a forecast.

## Decision

- **Source:** [Open-Meteo](https://open-meteo.com/). It's free, needs no API key or account, and returns current conditions, hourly and daily forecasts in one request.
- **Fixed location:** the request always uses McGill's downtown campus coordinates (`CAMPUS` in `lib/weather.ts`). No student's location is sent anywhere (ADR 0008).
- **One shared request:** fetched on the server with `next: { revalidate: 900 }` and a 5 s timeout. Every student shares the cached forecast, so the app makes about one request per 15 minutes, well within Open-Meteo's free limits.
- **Untrusted response:** `parseForecast` validates every field and drops broken rows. If the API is down, the widget says so and the page still renders; the meetup forecast is simply omitted.
- **Where it shows:**
  - A **Campus weather** widget on the feed (`weather` in `WIDGETS`): now, feels-like, wind, the next hours and five days. New layouts show it first; saved layouts get it at the end.
  - A **Forecast** row on upcoming meetups within the 7-day window, with a short tip when it matters (very cold, rain, snow, storms, heat).
- Celsius only; icons are decorative and every value has a text label.

## Consequences

- No keys, secrets, tables or permissions.
- The forecast is for downtown campus; Macdonald campus meetups get a close-but-not-exact forecast.
- Open-Meteo's free tier is for non-commercial use. If Martlet becomes commercial, switch to its paid plan or another provider; only `lib/weather.ts` changes.
