# 0036. Martlet Coin trading sim

- **Status:** Proposed
- **Date:** 2026-11-25
- **Issue:** #148

## Context

The team wants a "Martlet Coin" so students can practise trading. A real cryptocurrency or token would be a regulated financial product (and could be bought or sold for money), which Martlet must not offer. Martlet already has play-money points (ADR 0033).

## Decision

- **A simulated coin, not crypto.** MLT has no blockchain, no wallets and no real money. It's bought and sold with Martlet points, which have no cash value and can't be bought or cashed out. The page says so.
- **One shared price**, generated in Postgres (migration 021) one minute at a time, the first time anyone asks after a minute passes. Each minute is a random walk with 0.4% volatility that drifts back toward 10 points, nudged up by meetups created in the last hour and by the previous minute's net buying (selling pushes it down). Prices are stored, so every student sees the same chart. An advisory lock stops two requests generating the same minute; long idle gaps restart from 7 days ago.
- **Trading:** buy with 1–500 whole points or sell any amount of coins at the current price with a 0.5% spread, sales paid in whole points rounded down. At most 20 trades a minute. Each trade runs in one function (`mlt_trade`) that takes the user from the session and locks the wallet and holding.
- **Privacy:** prices are visible to members; holdings and trades only to their owner. The leaderboard shows display names and profit (sales + current value − cost).
- **Updates:** prices change once a minute, so the page polls every 30 seconds rather than using Realtime.

## Consequences

- The spread and mean reversion make it hard to farm points; the weekly top-up caps losses.
- Net buying moves the price, so groups can push it around. That's part of the game; the spread and trade limits keep it modest.
- Order books, limit orders or several coins would each need a new design.
