# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

Four developers are building Martlet in parallel on separate branches under a 24-hour timeline. Decisions have so far lived across `MARTLET_START_HERE.md`, `docs/TEAM_PLAN.md`, and `docs/CONTRACTS.md`, mixed in with task lists and setup steps, which makes the reasoning hard to find.

## Decision

Record significant architectural decisions as lightweight ADRs (Michael Nygard format) in `docs/adr/`. The existing docs remain the source for task ownership and API signatures; ADRs explain *why*.

## Consequences

- New contributors can see the rationale behind constraints without reading the full plan.
- Changing a recorded decision requires a new ADR, which makes cross-team changes visible in PR review.
- Small overhead per decision; reserve ADRs for choices that affect more than one developer's area.
