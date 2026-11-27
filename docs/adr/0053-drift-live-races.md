# 0053. Martlet Drift live races

- **Status:** Accepted
- **Date:** 2026-11-26
- **Builds on:** [0050](0050-drift-ghost-races.md) (ghosts and path checks), [0051](0051-blocking.md) (blocking), [0052](0052-drift-tracks.md) (tracks)

## Context

Ghost races let you race a recording. Students want to race their friends live: a small group, not strangers.

## Decision

- **Private rooms of up to 4.** Anyone signed in can open a room on a track and gets a 6-character code (no 0/O or 1/I). Friends join with the code. You're in one room at a time. Rooms are deleted after 3 hours. Someone who has blocked a member, or been blocked by one, can't join.
- **Same run, same moment.** The host starts the race (2 to 4 drivers). Everyone's 90-second run begins 6 seconds later by the server's clock, so browsers line up without talking to each other. Most drift points wins.
- **Live cars over Realtime broadcast.** Each browser sends its car's position and points about 10 times a second on the private channel `drift-room:<code>`. RLS on `realtime.messages` lets only the room's members send or hear on it. Positions aren't stored. They're game cars on a game map, not anyone's real location (ADR 0008). Other cars are solid but don't collide, and they're eased between updates. A car that goes quiet for 3 seconds disappears.
- **Checked results.** Each driver reports their score with the run's replay. The server applies the ghost checks: the result must come 85 s to 5 min after the start, the path must be plausible, and the path must end on the score. A run that fails counts as finished with no score. The race is over when everyone has finished, or after 2½ minutes. The host can start a rematch, on another track if they like.
- **No leaderboard effect.** Race scores stay in the room. The leaderboard and ghosts still come from solo runs, which keeps one cheating path closed.
- The room and its results go through security-definer functions (migration 037). The tables aren't readable directly.

## Consequences

- Up to 40 broadcast messages a second per room. That's well within Supabase Realtime's limits for a few rooms, but a popular weekend would need watching.
- Live positions come from browsers and can be faked. They only affect what others see during the race; the result that counts is checked on the server.
- Lag shows as cars easing a little behind where they really are. That's acceptable with no collisions.
