# 0033. Play-money prediction market

- **Status:** Proposed
- **Date:** 2026-11-24
- **Issue:** #139

## Context

Students want to forecast campus events ("Will Redpath stay open 24/7 during finals?") and see how the crowd's odds move over time. Real-money prediction markets count as gambling in Quebec, and the team decided this is a game only.

## Decision

- **Play money only.** Martlet points can't be bought, cashed out, transferred or exchanged for anything of value, and there are no prizes. Every student starts with 1000 points and is topped back up to 1000 once a week, so nobody is permanently out.
- **Yes/no markets.** Each has a question (10–140 characters), resolution details, and a closing time between 1 hour and 180 days away.
- **Moderated.** Students propose markets (3 a day); moderators (ADR 0027) approve or reject them. A moderator's own market opens at once. Moderators resolve markets YES, NO or cancelled, and a moderator who holds a position in a market can't resolve it.
- **Pricing: LMSR** (logarithmic market scoring rule) with liquidity `b = 100`. There's always a price, no order book or matching is needed, and the house's worst-case loss per market is `b·ln 2 ≈ 69` points. A YES share pays 1 point if YES wins; the YES price is the market's probability.
- **Trades:**
  - Buys are 1–500 whole points; sales pay back whole points, rounded down, so rounding can't create points.
  - At most 20 trades a minute per student.
  - Each trade runs in one Postgres function (`trade_market`) that takes the user from the session, locks the market, wallet and position rows, checks balance and holdings, and appends to a trade log.
- **Privacy:** wallets, positions and trades are readable only by their owner. The price graph comes from `get_market_history`, which returns times and probabilities with no user ids. The leaderboard shows display names only.
- **Leaderboard:** points won minus points spent on settled markets. Under LMSR, profit comes from moving the price toward the right answer, so it rewards accurate forecasts.
- **Math in two places:** `lib/market-math.ts` mirrors the SQL so the trade form can preview a trade; the database is the source of truth.

## Consequences

- Members only for now; guests can't see markets.
- Markets about individual private people aren't allowed (board rules); moderators reject them.
- Moderation load grows with proposals; the daily limit keeps it small.
- Changing `b` per market, multi-outcome markets, or a guest view would each need a follow-up.
