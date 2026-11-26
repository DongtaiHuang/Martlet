# 0045. Creator profile photos

- **Status:** Accepted
- **Date:** 2026-11-26
- **Builds on:** [0042](0042-creator-directory.md) (creator directory), [0009](0009-landmark-photo-unlocks.md) (photos re-encoded in the browser)

## Context

Creator profiles (ADR 0042) show a name, a headline and a portfolio, but no face. Students choosing a photographer, tutor or musician want to see who they'll meet. A photo of a student is personal data, so it has to be optional, visible only inside Martlet, and easy to remove.

## Decision

- **Optional and square.** A creator can add one profile photo. The browser crops it to a centred 400×400 square and re-encodes it as JPEG, which drops EXIF data such as GPS location. The server accepts only a JPEG of up to 500 KB.
- **Same private bucket and visibility as the portfolio.** The photo is stored as `{student-id}/photo.jpg` in the `creator-works` bucket. It's readable by whoever can read the profile: signed-in students while the profile is visible, the owner always, and moderators. `creator_profiles.has_photo` says whether to show it, and the app serves it through short-lived signed URLs.
- **No photo means a pixel chick.** Without a photo, the profile shows the map's pixel chick in a colour derived from the student's id (ADR 0044's style).
- **Moderation through the profile.** Reports on the profile cover the photo: hiding or removing the profile hides or removes the photo with it.
- **Clean-up.** Removing the photo, deleting the profile or a moderator removing it makes the file dead, and the owner's background purge deletes it. Migration 031 also fixes 029's purge, which would otherwise have treated every photo as dead because its name isn't a work id.

## Consequences

- Profiles feel personal, and students can decide whether to show their face.
- A bad photo hides the whole profile after three reports, rather than just the photo. A photo-only report could be added if that turns out to be too blunt.
