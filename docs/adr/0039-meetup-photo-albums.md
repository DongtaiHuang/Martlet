# 0039. Meetup photo albums

- **Status:** Accepted
- **Date:** 2026-11-25
- **Builds on:** [0009](0009-landmark-photo-unlocks.md) (photo processing), [0027](0027-community-board-and-moderation.md) (reports and moderators), [0038](0038-meetup-cleanup.md) (retention)

## Context

Students want to share the photos from a meetup with the people who were there, download them, and not have them kept forever (issue #117). Photos of people are sensitive: they must not leak outside the group, must not carry GPS data (ADR 0008), and must be removable and reportable.

The app never uses the Supabase service-role key, and Supabase only deletes a stored file when it's removed through the Storage API. Deleting the database row (or the `storage.objects` row) leaves the file behind.

## Decision

- **Who:** only the meetup's host and students with a Peck can see or add photos. Guests and other students never see the album. Moderators see reported photos.
- **When:** the album opens at the start time and **closes 7 days later**. A cancelled meetup has no album. From the moment it closes, the database's access rules refuse every read of its photos, so nobody can see or download them.
- **Limits:** 20 photos per person, 300 per meetup, JPEG only, 5 MB. Photos are resized and re-encoded in the browser (`prepareLandmarkPhoto`), which strips EXIF/GPS.
- **Storage:** private bucket `meetup-photos`, path `{meetup}/{photo}.jpg`, short-lived signed URLs. The upload policy only accepts a file for the uploader's own photo row reserved in the last 10 minutes.
- **Downloads:** each photo has a download link; "Download all" builds a ZIP in the browser (`lib/zip.ts`, no extra dependency).
- **Removal and reports:** the uploader, the host or a moderator can remove a photo. Other participants can report it through the Board's reports (`target_type = 'photo'`): three reports hide it until a moderator restores or removes it in `/moderation`.
- **Deleting the files:** each student's dead files (removed, album closed, or meetup deleted) are deleted through the Storage API with their own session, by a background call that runs at most every 6 hours per browser when they use Martlet. Only the uploader can still read their own dead files, which the Storage API requires in order to delete them.

## Consequences

- Nobody else can see a photo once its album closes or it's removed, but the file itself stays in Storage until its uploader next uses Martlet. A student who never comes back leaves their files behind, readable only by them. Deleting those too would need a trusted server job with the service-role key (for example a Supabase Edge Function on a schedule), which needs its own ADR.
- Moderation now covers board posts, comments and photos. The unified moderation draft (#114) can add meetups and landmark photos the same way.
- No check-in yet: anyone with a Peck counts as "there", as on the meetup page.
