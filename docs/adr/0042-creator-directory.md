# 0042. Creator directory

- **Status:** Accepted
- **Date:** 2026-11-26
- **Builds on:** [0027](0027-community-board-and-moderation.md) (reports and moderators), [0039](0039-meetup-photo-albums.md) (photo storage and purge), [0040](0040-student-marketplace.md) (private threads, no payments)
- **Changes:** the Campus Board's **Skill** posts from 0027 (no new ones; old ones stay readable)

## Context

Students who make music, write code, take photos, draw, design or tutor had only one-off **Skill** posts on the Campus Board (ADR 0027). A post can't show a body of work, gets buried under memes, and gives no way to handle a job from first message to done. Students looking for a photographer, a logo or a tutor want to browse people and their work, not posts.

## Decision

- **One creator profile per student** (`creator_profiles`): headline, about text, 1–3 kinds of work (music, coding, photography, drawing & art, design, video, writing, tutoring, other), free-text rates, up to 5 `https` links, and an "open for requests" switch for when they're booked. Signed-in McGill students only, like the Marketplace.
- **Portfolio:** up to 8 works, each an image, a link (a track, repo or video), or both. Images go in a private `creator-works` bucket as JPEGs re-encoded in the browser (no EXIF/GPS, ADR 0009), readable while the profile is readable to you. Music and code are shown through links: **no audio uploads**, which keeps storage small and moderation to images and text.
- **Requests instead of contact details.** A student sends a request to a creator who is open for requests: kind of work, optional budget (up to $1,000), optional date, and a first message. Each request has its own private thread between the two of them (and moderators). The creator accepts or declines an open request and marks an accepted one done; the client can withdraw. Each new request, message or status change refreshes one notification per request (`creator_request`). No emails or phone numbers are shown.
- **No payments.** Martlet never handles money; the forms say so and advise agreeing on the price first, meeting on campus and not paying in full in advance. No doing other students' graded work.
- **Moderation:** profiles (`target_type` `creator`, keyed by the student's id) and request messages (`creator_message`) join the Board's reports. Three reports hide a profile with its works and images; one report hides a private message. Owners can still edit a hidden profile but can't un-hide it. Moderators restore or remove in `/moderation`; a removed profile can't be edited.
- **Limits:** 20 new works a day, 5 new requests a day, at most 2 open or accepted requests from one student to the same creator, 30 request messages an hour.
- **Lifetime:** profiles stay until their owner deletes them (which deletes works and every request thread). A daily `pg_cron` job deletes declined and closed requests 30 days after their last change, any request after 180 days without activity, and removed profiles 30 days after removal (their owners can then start over). Image files of deleted works or removed profiles are deleted by their owner's session through the same background purge as albums and listings.
- **The Board's Skill kind is retired.** The new-post form and the filters no longer offer it and point to Creators instead. The database still accepts the `skill` kind so existing posts keep working; nothing is migrated or deleted.

## Consequences

- Creators get a page they can share with other students, and clients get one place to track a job.
- Request threads reuse the Marketplace's thread and notification patterns, so both features change together if threads gain blocking (planned app-wide mute/block).
- Hidden or removed profiles disappear at once; their image files linger, readable only by the owner, until the owner's next visit (same trade-off as ADRs 0039 and 0040).
- No search ranking or reviews yet: the directory is sorted by most recently updated and searched by headline, about text and rates. Ratings after a closed request would be a follow-up with its own abuse rules.
