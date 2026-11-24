# 0013. Landmarks map, tower pins that grow, and popup birds

- **Status:** Accepted
- **Date:** 2026-11-21
- **Builds on:** [0009](0009-landmark-photo-unlocks.md) (landmark map markers and preview card), [0006](0006-maplibre-configurable-style.md) (MapLibre), [0008](0008-client-side-locate-me.md) (locate-me stays in the browser)

## Context

ADR 0009 gives landmarks "their own map markers" and a preview card but leaves the look open. The first version used coloured circles with a star (gold until discovered, green once completed). They worked but didn't say much: every landmark looked the same however popular it was, and there was no reason to come back to one you'd already unlocked.

We also wanted:
- A dedicated map on `/landmarks` that lists every landmark, including the off-campus ones, without making Explore harder to use.
- Explore and Landmarks to feel like the same map (same style, 3D buildings, controls).
- Popups with some personality, in the pixel-art style of the progress tree ([0012](0012-progress-growth-tree.md)).

Constraints: no new data, permissions or dependencies; it must stay light on phones; nothing about a user's position leaves the browser (0008).

## Decision

### One shared campus map
- `createCampusMap()` (`components/map/map-config.ts`) builds the map for both Explore and Landmarks: same style, start view (campus, zoom 16, where the style shows 3D buildings) and controls, inside the same frame (`CAMPUS_MAP_FRAME`).
- **Explore** gets a layer toggle: **All / Meetups / Landmarks**. The category chips apply to meetups only.
- **Landmarks** (`components/map/LandmarkMap.tsx`) shows only landmarks, with a scrollable sidebar list beside the map (below it on phones). Picking a landmark in the list flies the map there and opens its popup; clicking a pin highlights it in the list. One popup is open at a time.
- Both maps **open on campus in 3D**. Fitting all landmarks at once (Oratory to Old Port) needs about zoom 12.5. The map's tiles have no building data below zoom 13, so that view is flat. Off-campus landmarks are one click away in the sidebar, and Explore's hint says to zoom out for them.

### Tower pins that grow with photos
- Each landmark is a **pixel-art brick tower** (red brick, cream stone, blue windows, pink spire), generated in code (`components/map/landmark-tower.ts`) as one SVG `<path>` per colour, like the progress tree. The same tower is used on both maps and as the sidebar icon.
- **Height and detail follow the number of photos shared there** (`unlock_count`), in six tiers:

  | Photos | Tower |
  |---|---|
  | 0 | Short battlement |
  | 1+ | Small spire |
  | 3+ | Windows and crenels |
  | 6+ | Taller, with a flag |
  | 11+ | Side turrets |
  | 25+ | Tall spire and turrets |

- **Grey until the user discovers it** (unlocks it), in colour after. The tier still shows on grey towers, so popular places stand out before you go.
- Pins are anchored at the base (`anchor: "bottom"`), so towers stand on their spot; popups open just above the tower. The selected pin on `/landmarks` gets a red glow.
- Each pin has an accessible name, e.g. "Landmark: Redpath Museum (locked, 3 photos)".

### Popups with a bird
- Meetup and landmark popups share one builder (`popup-content.ts`): rounded card, a tag, title, details, and a call-to-action button.
- Each popup has a small **pixel-art chick** (`popup-bird.ts`). Its body colour comes from a hash of the meetup or landmark id, so the same place always has the same bird.
- On an **undiscovered landmark the bird is grey** and silent.
- Otherwise, **hovering or focusing the bird** shows a speech bubble with a random McGill/Montreal quote (`bird-quotes.ts`, a fixed list written in-house). The bubble drops down over the popup text rather than above it, because above it was clipped by the map frame. It has `role="tooltip"`, the bird is keyboard-focusable, and the bubble's fade is disabled under `prefers-reduced-motion`.

### Safety
- All markup is built with DOM APIs and `textContent`. The SVG strings contain only constant colours and numbers, so `innerHTML` and `dangerouslySetInnerHTML` never receive user data.

## Alternatives considered

- **Star circles (gold/green):** first version; clear but flat, and it didn't show how active a landmark is.
- **Zoomed-out overview on `/landmarks` (fit all landmarks):** shows everything at once but is 2D at that zoom. We tried forcing 3D at zoom 13, but the overview needs ~12.5, which has no building data.
- **Tilted (pitched) overview:** looks 3D but still has no buildings at that zoom, and makes far-off pins small.
- **Images per tier (PNG/SVG files):** more artistic control, but 12 assets (6 tiers × colour/grey) to keep consistent; code generation keeps them in sync.
- **Quote bubble above the popup:** keeps the text uncovered, but gets cut off near the top of the map.
- **Grow towers by the user's own photos instead of everyone's:** less interesting; a landmark's popularity is the more useful signal on a shared map.

## Consequences

- The map now shows at a glance which landmarks are popular and which you still need to discover, and towers keep growing after you've unlocked them.
- No schema, RLS or API changes; tiers come from the existing `unlock_count`, and discovered state from `unlocked`.
- `/landmarks` no longer opens on an overview of all landmarks, so the three off-campus ones (Oratory, Old Port, La Banquise) aren't visible until you zoom out or pick them in the list. This refines ADR 0009's note that the map must zoom out to show them.
- Tier thresholds are a single table in `landmark-tower.ts`; with only a few users, most towers will sit in the lower tiers during the demo.
- Quotes are a hard-coded list: adding or editing one is a code change, and they need a light review to stay friendly and accurate.
- Tall towers cover more of the map than circles did: from about 14 px (no photos) to about 60 px at the top tier on Explore (about 75 px on Landmarks).
