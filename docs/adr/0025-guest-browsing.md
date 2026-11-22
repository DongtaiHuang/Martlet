# ADR 0025: Guest browsing

- Status: Accepted
- Date: 2026-11-22

## Context
Every page needed sign-in, so a visitor without a McGill account saw nothing but a login form. We want people to see what's happening on campus first. Joining, liking, posting and unlocking still need an account.

## Decision
- `proxy.ts` lets signed-out visitors open `/`, `/meetups`, `/meetups/<id>`, `/landmarks/**`, `/explore`, `/play` and `/achievements`. Creating and editing meetups, the profile, progress and notifications still redirect to sign-in.
- **Meetups:** guests get no table access. They read through one `SECURITY DEFINER` function, `guest_meetups(p_id)` (migration 015). It returns the feed's summary fields only:
  - counts, never who joined;
  - the host's display name;
  - custom (off-map) meeting instructions replaced with "sign in for details", because they can be personal.
- **Landmarks** are a public campus catalog, so `anon` can read `landmarks` and the unlock counts. Landmark photos stay members-only (storage RLS unchanged).
- **Actions:** guests see counts instead of buttons, plus a sign-in prompt. Server actions and RLS still require a session, so the UI is UX only.

## Consequences
- Signed-in reads are unchanged.
- Any new field that guests should see must be added to `guest_meetups` deliberately.
