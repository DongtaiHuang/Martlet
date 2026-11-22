# ADR 0028: Unified moderation across meetups, landmarks and Campus Board

- Status: Proposed
- Date: 2026-11-22
- Related: ADR 0003 (RLS), ADR 0009 (landmark unlock retention), ADR 0025 (guest browsing), ADR 0027 (Board moderation)

## Context

Martlet has a public meetup feed, member-only landmark photo galleries, and a Campus Board. Reporting and moderation previously covered Board content only. A public social platform needs consistent review, preserved evidence, and authorization that cannot be bypassed through the Supabase API.

## Decision

- Preserve Board reports in content_reports and existing Board reporting APIs.
- Add community_reports for meetup and landmark-photo reports: one report per user per target, validated reasons, rate limits, and a three-distinct-reporter auto-hide threshold.
- Keep underlying meetups, reactions, unlocks and images intact. moderation_status is a soft-hide state, not a deletion.
- Reuse profiles.is_moderator. The unified /moderation queue shows Board posts/comments, meetups and landmark photos.
- Use moderate_community_content for moderator decisions, recording all decisions in moderation_decisions. Revoke direct access to the old unaudited moderate_content RPC.
- Enforce hidden-meetup visibility through restrictive RLS and explicitly filter the SECURITY DEFINER guest_meetups RPC. Restrict the private photo storage signed-URL policy using the moderation state.
- Owners can see their own moderated items and moderators retain review access. Other users cannot view hidden or removed content.

## Privacy and limitations

Photo signed URLs issued before a moderation decision can remain usable until expiry (currently up to an hour). Existing stored photos and landmark unlocks remain for potential appeals. Report notes and audit logs are moderator-only. This release does not add user bans, an appeals system, or hard deletion of private information.

## Deployment

Apply migration 018_unified_moderation.sql to a disposable database first and run tests/unified-moderation-database.test.sql. After review and database backup, the authorized database owner applies it to the hosted Supabase project, followed by a matching app deployment. Do not reset a live database.
