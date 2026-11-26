# 0043. Trend images

- **Status:** Accepted
- **Date:** 2026-11-26
- **Issue:** #116
- **Changes:** [0017](0017-trends-side-panel.md)'s "Martlet never calls the Spotify API": the server now calls Spotify's public oEmbed endpoint (no API key, no user data) once per shared song
- **Builds on:** [0027](0027-community-board-and-moderation.md) (reports and moderators), [0039](0039-meetup-photo-albums.md) (private storage and purge)

## Context

Trend entries show only a name and a type icon, so the side panel is a list of text. Album art for songs and a photo for recipes make it much easier to scan. Getting those images means the server fetching URLs that students paste, which is a classic server-side request forgery (SSRF) risk, and showing third-party images directly would reveal every viewer's IP address to those sites.

## Decision

- **Fetched once, when an entry is shared**, by the server action that creates it, never on page views. If anything fails, the entry is shared without an image.
- **Only known sources:** songs from `open.spotify.com` (track, album, playlist, episode or show pages) through Spotify's public oEmbed endpoint, which returns the cover image without OAuth; recipes from a fixed list of recipe sites (`RECIPE_HOSTS` in `lib/trend-image-rules.ts`) through the page's `og:image`. Coffee and study entries keep the type icon.
- **SSRF rules** (`lib/trend-image-fetch.ts`): https on port 443 only, no credentials in URLs; every connection's address is checked in the DNS lookup used to connect, refusing loopback, private, link-local (including cloud metadata), carrier-grade NAT, multicast and other non-public ranges for IPv4 and IPv6 (including IPv4-mapped), and IP literals are checked directly; at most 2 redirects, each re-checked; 4-second timeouts plus an overall deadline; size caps (600 KB page, 50 KB JSON, 2 MB image); no cookies sent.
- **Copied into Martlet's storage:** the image is checked by its magic bytes (JPEG, PNG or WebP only; never SVG) and uploaded with the sharer's session to a private `trend-images` bucket as `{entry-id}.img`; viewers get short-lived signed URLs, so they never contact Spotify or recipe sites. The sharer can only upload for their own entry, within 10 minutes of sharing it, and only before an image is attached.
- **Reportable:** `trend_image` joins the Board's reports (ADR 0027). Three reports hide the image (the entry stays); moderators restore or remove it in `/moderation`. Files of removed images are deleted by their owner's session through the same background purge as albums, listings and portfolios.

## Consequences

- Trends look richer at no cost to viewers' privacy, and nothing needs an API key.
- Because the bucket accepts uploads from the sharer's session, a student could upload any small JPEG, PNG or WebP for their own new entry instead of the fetched one. That's the same exposure as other student uploads, and reports cover it.
- Adding a recipe site means adding it to `RECIPE_HOSTS`. Entries shared before this change have no image; a backfill could be a follow-up.
- Trend entries' text still isn't reportable; that would be a separate change.
