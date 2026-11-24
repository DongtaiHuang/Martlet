# 0011. Advisory meetup polls and single-choice voting

- **Status:** Superseded by [0022](0022-custom-meeting-spots.md) (poll UI retired; existing poll data is kept)

## Context

Hosts need a way to gauge interest in dates, locations, and activities before a meetup. Martlet’s confirmed meetup details are protected by existing database grants and policies.

## Decision

Each meetup can have one poll with two to five ordered options. A poll closes at its deadline, at meetup cancellation or start, or when the host closes it early. Proposed times are stored as UTC timestamps. Location options reference approved campus locations. Results are advisory. They leave the confirmed meetup details to the existing meetup workflow.

The database stores the poll, its typed options, and votes in separate tables. Each signed-in student has one vote, independent of Peck. A change replaces the existing choice. The composite foreign key ties a choice to its poll.

The cookie-bound Supabase client calls narrowly scoped RPCs. RPCs derive identity from `auth.uid()`, and the write RPCs acquire the meetup row lock before reading or changing the poll. This serializes writes with cancellation and allows deadlines to be checked after waiting for a lock. Public table writes and vote reads are revoked, with RLS enabled as a second boundary. Results expose aggregate counts and only the caller’s selection. Poll visibility follows the current shared signed-in meetup access model. If meetup visibility becomes private, update the RPC checks with the meetup rules.

## Consequences

Closed polls remain visible. The MVP supports single-choice voting, one poll per meetup, and refresh after the current student’s changes. It has no live push updates, poll edits, deletion, or automatic rescheduling.
