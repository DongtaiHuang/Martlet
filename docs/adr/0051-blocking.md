# 0051. Blocking

- **Status:** Accepted
- **Date:** 2026-11-26
- **Builds on:** [0027](0027-community-board-and-moderation.md) (reports), [0040](0040-student-marketplace.md) (marketplace threads), [0042](0042-creator-directory.md) (creator requests), [0041](0041-blackjack-splits-and-table-chat.md) (table chat)

## Context

Students can message each other in marketplace threads, creator requests and blackjack table chat, and they see each other's board posts. Until now the only defence against someone unwanted was a report, which waits for a moderator. Social features ahead, such as live races and Groups, need a way to cut someone off yourself, right away.

## Decision

- **Block the author of an item.** The Report dialog (next to every post, comment, photo, listing, message, creator profile and chat line) has "Block only" and an "Also block this person" checkbox. `block_author(type, id)` finds the author on the server, so user ids never reach the browser. Blocking yourself does nothing; the limit is 500 blocks.
- **Enforced in the database (migration 035):** marketplace messages, creator requests and request messages are refused between a blocked pair, in either direction, with a neutral "You can't message this person". Table chat leaves out lines between a blocked pair.
- **Hidden in lists:** board posts and comments, marketplace listings and creator profiles by people you've blocked are left out of your lists. That's a convenience, not a security boundary.
- **Private:** you can read only your own blocks (RLS), so nobody can see who blocked them. Unblock from the "Blocked people" section of your profile.

## Consequences

- Students can protect themselves without waiting for a moderator. Reports still go to moderators for content that breaks the rules.
- Someone you blocked can still see your public posts; blocking stops contact, not visibility.
- Meetups are unaffected: they're public events, and hosts can already cancel.
