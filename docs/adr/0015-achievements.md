# 0015. Achievements for niche and hidden features

- **Status:** Proposed
- **Date:** 2026-11-21
- **Builds on:** [0003](0003-rls-authorization-boundary.md) (RLS), [0012](0012-progress-growth-tree.md) (tree), [0013](0013-landmark-map-tower-pins.md) (map, popup birds)

## Context

Martlet has small touches people can miss: martlets that talk when you hover them, photo fruit on the progress tree, stage previews, a 3D map you can tilt. We want to reward people for finding them and give them a reason to poke around, with a visible "Achievement unlocked" moment and a page to see what they've collected.

Constraints:
- The user must come from the Supabase session, never the browser (`AGENTS.md`), and RLS is the real authorization (0003).
- Most triggers happen in the browser (hover, a key sequence, the time of day), so the server can't verify them. That's acceptable: achievements are cosmetic and grant nothing.
- Demo (mock) mode and signed-out visitors should still get the fun.
- Nothing about a user's position is sent or stored (0008).

## Decision

### The list lives in code
- `lib/achievement-catalog.ts` lists every achievement: id, icon, title, description, and whether it's **hidden**. Hidden ones show as "???" with a lock until earned.
- Initial set:

  | Achievement | Trigger | Hidden |
  |---|---|---|
  | Bird whisperer | Hover or focus a talking martlet in a map popup | Yes |
  | Chatterbox | Hear 10 different martlet quotes | Yes |
  | Fruit inspector | Hover or focus a photo on your tree | Yes |
  | Time traveller | Preview another tree stage (`/progress?stage=N`) | Yes |
  | New angle | Tilt or rotate the campus map yourself | Yes |
  | Night owl | Open Martlet between 2 and 5 a.m. (browser's local time) | Yes |
  | Old school | Type ↑ ↑ ↓ ↓ ← → ← → B A | Yes |
  | Field trip | Visit an off-campus landmark (more than 1.5 km from campus) on a map | No |
  | Tourist | Explore every landmark on a map | No |

### Saving
- New table `user_achievements (user_id, achievement_id, earned_at)` (`supabase/migrations/008_achievements.sql`), one row per user per achievement.
  - RLS: users can **read and insert only their own rows**. No update or delete, so achievements are permanent.
  - `achievement_id` is checked for shape in SQL; the server action only accepts ids from the catalogue.
- Server action `earnAchievement(id)` (`app/achievements/actions.ts`) gets the user from the session and returns `new`, `already`, `guest`, `invalid` or `error`. It never takes a user id.
- **Guests** (signed out, or demo mode) get `guest`, and the browser keeps their achievements in `localStorage`. They aren't copied to an account on sign-in, because a shared browser could hand one person's achievements to another.
- Counters that span visits (quotes heard, landmarks opened) are kept per browser in `localStorage`; only the earned achievement is saved to the account.

### Triggering and the toast
- `earn(id)` (`components/achievements/earn.ts`) is the one entry point. It's called from:
  - the popup bird,
  - the maps,
  - `<EarnOnMount>` on server-rendered pages,
  - any element marked `data-achievement="<id>"` (hover or focus).
  It calls the server at most once per achievement per page load.
- `<AchievementToaster>` is mounted once in the root layout.
  - It shows an **"Achievement unlocked" bar in the top-right corner**: slides in, stays about 6 seconds, fades out. It can also be dismissed.
  - It's announced politely to screen readers (`role="status"`), and its animation is off under `prefers-reduced-motion`.
  - Guests see "Saved in this browser. Sign in to keep it on your profile."
  - It also watches the app-wide triggers: the key sequence and the late-night check.
- A toast only appears for a **newly** earned achievement, so earning one on another device doesn't pop it up again.

### The page
- Its own page, `/achievements`. It shows "X of N unlocked", a progress bar, then **Still to unlock** (goals first, hidden ones as "???") and **Unlocked** (with the date each was earned). It updates live when one is earned on the page.
- **Profile menu:** on larger screens, hovering or keyboard-focusing **Profile** in the nav opens a menu with Your profile and Achievements (X / N); the list of what's still to unlock is on the Achievements page. It loads the user's achievements the first time it opens (server action `myAchievements()`), so other pages don't pay for it. Phones have no hover: tapping Profile opens the profile, which links to Achievements.

## Alternatives considered

- **Browser-only (`localStorage` for everyone):** no migration, but achievements wouldn't follow the account to other devices.
- **Verify triggers on the server:** most triggers are UI interactions the server never sees; not worth it for cosmetic badges.
- **A database table of achievement definitions:** lets admins edit them without a deploy, but needs admin tooling we don't have; a code list is reviewed like any other change.
- **Merge guest achievements into the account on sign-in:** nicer for one person, wrong on a shared browser.
- **A toast library:** one small component does the job without a dependency.

## Consequences

- Students get small rewards for exploring, and the demo has a fun moment to show.
- One new table, readable only by its owner. Anyone signed in can earn any achievement by calling the server action directly; that's accepted because they're cosmetic.
- Adding an achievement is a code change (catalogue entry plus a trigger). Removing one leaves old rows that the page ignores.
- The toaster is on every page, as a small client component with a few listeners.
- `app/profile/` and `components/layout/` (Developer 1) and the migrations (Developer 3) gain small additions; coordinate in the PR.
- Follow-ups: let other people see your achievements once public profiles exist, and add achievements for core actions (first meetup hosted, first landmark unlocked).
