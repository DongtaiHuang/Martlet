# 0027. Community board and moderation

- **Status:** Accepted
- **Date:** 2026-11-22
- **Issues:** #45 (moderation), #44 (tips, Q&A, skillshare), #48 (freelance, partly)

## Context
Students asked for memes ("McGill shitposts"), tips, Q&A and a way to offer skills or freelance help. User content needs a way to report and remove harmful posts first (#45).

## Decision
**One board (`/board`) with four post kinds:**
- **meme:** text and an optional image;
- **tip;**
- **question:** answers in comments; the asker marks the best answer;
- **skill:** skillshare or freelance offers, with "Host it as a meetup".

**Marketplace limits:**
- Skill posts are **listings only**. No payments in the app, and no buying or selling of items (thrift stays deferred in #48).
- The form warns to meet on campus in public and never to share banking details.

**Accounts and limits:**
- Signed-in McGill accounts only (guests can't read or post).
- Votes are upvotes only.
- Rate limits: 5 posts and 30 comments per hour.

**Moderation:**
- Anyone signed in can report a post or comment with a reason (one report per person). Reports are anonymous to the author.
- **3 distinct open reports auto-hide** the item until a moderator acts.
- Moderators (`profiles.is_moderator`, set by hand in Supabase) use `/moderation` to **remove**, **restore** or **dismiss**. Each decision resolves the open reports.
- Authors can delete their own posts and comments. Hidden items stay visible to their author, marked "Hidden pending review".

**Security:**
- All writes go through `SECURITY DEFINER` RPCs that use `auth.uid()`; reads use RLS.
- Users can't make themselves moderators (only `display_name` is updatable).
- Images are resized and re-encoded in the browser (EXIF and GPS dropped, ADR 0009) and stored in a private bucket. They can only be uploaded for your own post and are served through signed URLs.

**Retention:** removed content stays in the database, so moderators can review appeals. Deleting it for good is a manual admin action.

## Consequences
- The first moderators need `update profiles set is_moderator = true where id = '<uuid>';`.
- Future user-content features (#42 groups, member tips in the guide) should reuse `content_reports` and `moderate_content`.
