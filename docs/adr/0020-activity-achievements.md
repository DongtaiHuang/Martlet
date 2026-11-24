# 0020. Activity achievements computed on read

- **Status:** Accepted
- **Date:** 2026-11-22
- **Builds on:** [0019](0019-achievements.md) (catalogue, `earn()`, `user_achievements`)

## Context

ADR 0019 added discovery achievements triggered in the browser (hovering martlets, the Konami code, previewing tree stages). A second, equally natural axis is **activity progression**: meetups hosted, meetups pecked or flapped, landmarks unlocked, trends shared and the likes they collect. These facts already exist as rows behind existing services; unlike the browser triggers, they are server-verifiable.

## Decision

Activity achievements are **computed on read**, never stored separately. `lib/activity-achievements.ts` is a pure table of ladders (id, target, current) over an `ActivityCounts` snapshot; the ids are ordinary entries in the same `lib/achievement-catalog.ts` catalogue (non-hidden, so they show as visible goals). `lib/activity-counts.ts` assembles the snapshot server-side from `listMeetups`, `listLandmarks` and `listTrends`.

Earning flows through the **existing 0019 path unchanged**: pages render `<EarnActivity ids={…}/>` with the satisfied ladder ids, the client calls the same `earn()`, the server action writes the same `user_achievements` row (deduplicated by its primary key), and the same toast announces it. Trend counts use the ranked top-50 list the app already loads, so entries that fall out of the window stop counting.

Eligibility is checked when `/progress` or `/achievements` is visited, so a badge earned mid-feed toasts on the next visit to those pages rather than at the exact moment of the action.

## Consequences

No new tables, RLS, or write paths — ADR 0003 remains the only authorization boundary, and permanence still comes from `user_achievements` having no update/delete. The catalogue is the single list of everything earnable; thresholds live only in the ladder table. Adding an activity badge is one catalogue entry plus one ladder. Streaks or time-boxed badges would still need stored state and a new ADR.
