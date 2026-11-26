# 0041. Blackjack splits and table chat

- **Status:** Accepted
- **Date:** 2026-11-25
- **Builds on:** [0034](0034-blackjack.md) (solo blackjack), [0035](0035-blackjack-tables.md) (multiplayer tables), [0027](0027-community-board-and-moderation.md) (reports and moderators)

## Context

ADRs 0034 and 0035 left out splitting pairs to keep the first version small. Players asked for it, and for a way to talk to the other students at a live table while they play, including while they look at another blackjack page.

## Decision

### Splitting pairs (migration 027)

- **Two first cards of the same rank** (two 8s, two kings; not a king and a queen) can be split **once**, solo and at tables, for a second bet equal to the first.
- Each hand gets its second card straight away and is played in turn, hand 1 first. At a table both hands share your 20-second turn timer, which restarts after each move as before. A timeout stands on the hand in play and any hand still to come.
- **Double after a split** is allowed. **Split aces** get one card each and stand. A 21 on a split hand is not a blackjack and pays 1:1.
- The dealer still draws if any of your hands is standing. Payouts are added per hand; the solo history and the table results row record both bets together (a table round with a split counts as one hand toward the daily limit).
- The same rules are in the practice engine (`lib/blackjack-engine.ts`), and unit tests use the same fixed decks as the SQL tests.

### Table chat (migration 028)

- **Only in blackjack, only at your table.** Students seated at a table can text each other. Messages are visible only to people seated there (RLS, also for Realtime) and to moderators. Guests and people not seated can't read or send.
- **Opt-in.** A "Table chat" switch at the table turns it on for that browser. The chat window is rendered by the blackjack layout, so it stays open while you move between solo blackjack, the table list and your table. Reading the chat counts as being at the table, so your seat isn't dropped while you chat from another blackjack page.
- **Live with Supabase Realtime** on `bj_chat_messages` inserts, then a fetch through `bj_chat_recent()`; a 30-second poll covers dropped connections.
- **Short-lived and limited:** 1–200 characters, 10 messages a minute, the last 50 messages of the past day are shown, and messages older than a day are deleted on the next send at that table.
- **Moderation:** messages join the Board's reports as `table_chat`. A table has at most four other people, so one report hides a message until a moderator restores or removes it in `/moderation`. Hidden messages are kept up to 30 days for review.

## Consequences

- Splitting adds a second bet, so a hand can now risk up to 400 points (100 split, each doubled).
- Chat is not private messaging: anyone who sits down at the table later the same day can read earlier messages there.
- No blocking or muting yet; a student reports an unwanted message, which hides it for everyone.
