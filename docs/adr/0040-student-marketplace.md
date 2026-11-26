# 0040. Student marketplace

- **Status:** Accepted
- **Date:** 2026-11-25
- **Builds on:** [0004](0004-approved-campus-locations.md) (approved locations), [0027](0027-community-board-and-moderation.md) (reports and moderators), [0039](0039-meetup-photo-albums.md) (photo storage and purge)

## Context

Students want to sell, swap and give away things like textbooks, furniture and winter gear (issue #48). The issue was deferred because of scams, payment disputes, prohibited items, safety at in-person exchanges, and exposing contact details. The freelance part already lives on the Campus Board as **Skills** listings (ADR 0027).

## Decision

- **Listings only, no payments.** Martlet never takes, holds or moves money. Kinds: sell (price required, up to $1,000), free, swap, and wanted (optional budget). Seven categories; textbooks may name a course from the catalog.
- **Signed-in McGill students only.** Guests can't see listings, photos or sellers' names.
- **Meet on campus.** Every listing names an approved campus building (ADR 0004) as the meeting spot. No addresses, no coordinates from users.
- **Private threads instead of contact details.** An interested student messages the seller on the listing; the seller replies in that student's thread and can't cold-message anyone. Threads are visible only to the two of them (and moderators). Each new message sends one refreshed notification per listing (`listing_message`). This avoids sharing phone numbers or emails.
- **Banned items** (alcohol and drugs, weapons, completed coursework, tickets above face value, counterfeit or stolen goods, animals, anything illegal) are listed on the form, and the seller must confirm their item is allowed.
- **Moderation:** listings and messages join the Board's reports (`target_type` `listing` and `listing_message`). Three reports hide a listing; a private message has only one possible reporter, so one report hides it. Moderators restore or remove them in `/moderation`. Sellers can't un-hide a listing.
- **Limits:** 10 new listings a day, 20 open at once, 30 messages an hour, 4 photos per listing.
- **Lifetime:** listings last 30 days; sellers can renew in the last week. An hourly `pg_cron` job deletes listings 30 days after they expire and 7 days after they're removed, with their messages and notifications.
- **Photos:** private `listing-photos` bucket, JPEG re-encoded in the browser (no EXIF/GPS), readable while the listing is readable to you. Files of removed or deleted listings are deleted through the Storage API by their seller's session, using the same background purge as meetup albums (ADR 0039).

## Consequences

- Disputes stay between students: the app states that it doesn't handle payments and shows safety advice on every page.
- Hidden or removed listings disappear at once; their photo files linger, readable only by the seller, until the seller's next visit (same trade-off as ADR 0039).
- No blocking yet: a student who receives unwanted messages reports them, which hides them. Blocking would be a follow-up shared with future social features.
- Search is a simple title/description/course match, enough for the expected volume.
