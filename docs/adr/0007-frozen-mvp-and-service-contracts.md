# 0007. Frozen MVP scope and mock-first service contracts

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

Four developers work in parallel for 24 hours. Without a fixed scope and stable interfaces, branches drift and integration fails late.

## Decision

- Freeze MVP scope: sign-in and profile, create meetup, upcoming feed and detail, peck/flap, host cancellation, map, mobile layout, deployment. Defer chat, messaging, marketplace, external feeds, social graph, Feathers economy, photo unlocking, and recommendations.
- Commit shared contracts to `main` before branching: `types/meetup.ts`, `lib/locations.ts`, and the function signatures in `docs/CONTRACTS.md`.
- Services start as mocks (`lib/mock-meetups.ts`); owners replace the internals without changing signatures. Components call services instead of making their own Supabase fetches.
- UI components are presentational: e.g. `MeetupCard` receives `onPeck`/`onFlap` callbacks rather than performing mutations itself.
- Each developer owns specific paths (originally `docs/archive/TEAM_PLAN.md`, now `.github/CODEOWNERS`); editing another owner's file requires coordination.

## Consequences

- Frontend work can proceed before the database is ready.
- Changing a shared type or signature affects every branch and should go through a PR (and an ADR if it changes a decision here).
- Bringing a deferred feature back into scope needs a new ADR.
