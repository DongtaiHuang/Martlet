# 0035. Multiplayer blackjack tables

- **Status:** Accepted
- **Date:** 2026-11-25
- **Issue:** #146

## Context

Students want to play blackjack together, live. Solo blackjack (ADR 0034) already deals on the server with play-money Martlet points. Multiplayer adds shared state that several browsers must see change in real time, and players who may walk away mid-round.

## Decision

- **Everyone plays the dealer**, casino style, rather than each other. Three fixed tables (Redpath, Leacock, Bronfman), five seats each, one seat per student. Same wallet, rules and play-money terms as solo blackjack.
- **Rounds:** the first bet opens a 15-second betting window for the table, which closes early once everyone seated has bet. Players who didn't bet sit the round out. Cards are dealt in seat order, players act in seat order with a 20-second turn timer (timeout = stand), and the last action plays the dealer and pays everyone.
- **Server authoritative:** every move is a Postgres function that locks the table row, so simultaneous clicks are applied one at a time. The deck and the dealer's hole card live in `bj_table_secrets`, which no client can read.
- **Live updates with Supabase Realtime**, not our own WebSocket server (Vercel can't keep one open). `bj_tables` holds only public state plus a version number and is in the `supabase_realtime` publication. Browsers subscribe to its changes and fetch the table through `bj_sync()`, which returns only what a player may see. A slow fallback poll covers dropped connections.
- **Deadlines without a background job:** `bj_sync()` and every action first apply any deadline that has passed, under the table lock. Browsers call `bj_sync()` when a deadline they can see runs out, so the table moves on even if the acting player has left.
- **Leaving:** you can leave before the deal (your bet is refunded) or between rounds, not mid-hand. Seats that stop syncing for 90 seconds are dropped between hands.
- **Limits:** bets 1–100 points, 100 table rounds a day.

## Consequences

- No new infrastructure; uses Realtime's free tier (200 concurrent connections, 2 million messages a month).
- Every client refetches state on each change: a few small RPCs per action per player, fine for five-seat tables.
- A table only advances while someone has it open. That's intended: an abandoned table just waits.
- Splits, side bets or player-vs-player games would need new rules and tests.
