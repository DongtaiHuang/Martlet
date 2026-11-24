# 0031. Customisable feed dashboard

- **Status:** Accepted
- **Date:** 2026-11-24
- **Issue:** #46

## Context

The feed page shows a photo carousel, the meetup (or landmark) feed, and a sidebar of widgets: Trending on campus, Today at McGill, McGill News and Martlet Flight. Every student gets the same order. Students asked to arrange it to suit them by dragging widgets, and to hide what they don't use. The page is server-rendered, and several widgets fetch data, so a layout applied only in the browser would flash the default order first and still fetch hidden widgets.

## Decision

- **What can change:** the order of the four sidebar widgets, whether each is shown, and whether the carousel is shown. The meetup and landmark feed is the page's purpose, so it always stays.
- **Saved in a cookie** (`martlet.dashboard`, one year, `SameSite=Lax`) in a compact format such as `h1.news.flight.-daily.trends`. Its only characters are letters, digits, `.` and `-`, so it is a valid cookie value without encoding. `app/meetups/page.tsx` reads it, so the server renders the student's order from the first paint.
- **Hidden widgets aren't rendered** on the server, so they fetch nothing. Showing one again, or toggling the carousel, refreshes the page to fetch it.
- **Untrusted input:** `parseLayout` (`lib/dashboard.ts`) drops unknown or repeated ids, caps the length, and appends widgets missing from an old cookie in their default position, shown, so new widgets appear for everyone.
- **Interaction:** a **Customize** button opens an editor:
  - Widgets can be **dragged** directly on the page or in the editor list (HTML drag and drop).
  - **Move up/down buttons** do the same with a keyboard, screen reader or touch, where HTML drag and drop is unreliable. Moves are announced ("Martlet Flight moved to position 1 of 4").
  - A show/hide checkbox per widget, a carousel checkbox, and **Reset layout**.
  - While customizing, widgets' own links and buttons are paused so a drag doesn't click them.
- Device-only, like themes and tree species. Nothing about the layout is stored on the server.

## Consequences

- No new tables or permissions, and no layout flash.
- The layout doesn't follow a student across devices; syncing it to the profile later needs an RPC that uses the session user.
- New widgets (Groups, Spots, a progress-tree card; weather in ADR 0032) only need an entry in `WIDGETS` and a slot in the page.
- On phones the sidebar is below the feed, so Customize is further down the page.
