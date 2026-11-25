# 0034. Blackjack with Martlet points

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

The team wants a blackjack game alongside Martlet Flight, using the same Martlet points as the prediction market (ADR 0033). Points must stay play money, and a game run in the browser can't be trusted to report its own wins.

## Decision

- **Play money only.** Bets use the prediction market wallet: points have no cash value, can't be bought or cashed out, and top back up to 1000 each week. The page says so, and that the house has an edge.
- **The server deals** (migration 019). Each hand gets a fresh 52-card deck, shuffled in Postgres with `gen_random_uuid()` ordering and stored with the hand. The deck and the dealer's hole card stay in the database until the hand is over; players can't read or write the table, only call `blackjack_deal`, `blackjack_action` and `blackjack_current`. Each call takes the player from the session and moves points in the same transaction.
- **Rules:** one deck, dealer stands on all 17s, dealer peeks for blackjack, blackjack pays 3:2 rounded down, double down on the first two cards. No splits or insurance, to keep the first version small.
- **Limits:** bets 1–100 points, one hand at a time, 100 hands a day.
- **Practice table:** signed-out visitors and preview mode get the same rules in the browser (`lib/blackjack-engine.ts`) with chips that aren't saved. Unit tests check the engine against the same fixed decks as the SQL tests.
- Blackjack doesn't count toward the forecasters leaderboard, which only scores settled markets.
- **Accessibility:** cards have names ("Queen of hearts"), every deal, draw and result is announced, and all controls are buttons with 44px+ targets.

## Consequences

- No new wallet: one balance across predictions and blackjack. Losing at blackjack leaves fewer points to forecast with until the weekly top-up.
- Splits, insurance or a multi-deck shoe would each need a migration and new tests.
- Hands are kept, so a later stats page or leaderboard can use them.
