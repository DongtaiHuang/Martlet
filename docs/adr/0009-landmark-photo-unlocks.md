# 0009. Landmark photo unlocks with visit check-ins

- **Status:** Proposed
- **Date:** 2026-11-21
- **Amends:** [0007](0007-frozen-mvp-and-service-contracts.md) (brings deferred "photo unlocking" into scope), [0008](0008-client-side-locate-me.md) (a one-shot position is sent to the server, never stored)

## Context

Martlet's MVP only has meetups. The original idea also had a map of places you unlock by going there and sharing a photo, which ADR 0007 deferred. It fits the goal of getting students out to real places and meeting people. Landmarks also give people a reason to open the app when there's no meetup happening.

Constraints:
- **Privacy (ADR 0004):** no private addresses, no live tracking, no stored user positions. Photos can show faces.
- **Abuse:** the browser can't be trusted (ADR 0003), so unlock rules must hold even for direct API calls.
- **Real-world flow:** people often take a photo at the landmark but upload it, or swap it, later from home, so verifying location at upload time would fail genuine users.
- **Photo GPS (EXIF) is unreliable:** phones often strip it when uploading through a browser, it's easy to edit, and storing it would leak exact positions.

## Decision

### Landmarks
- A curated list of **public places on and around campus in Montreal**, each with a challenge prompt, e.g. "Take a photo high-fiving the Roddick Gates". Landmarks are a separate concept from meetup `campus_locations` (meetups stay on campus); they get their own map markers.
- Each landmark shows a **preview card**: name, challenge, and a blurred cover while locked.
- **Initial landmarks:**

  | Landmark | Area | Notes |
  |---|---|---|
  | Saint Joseph's Oratory | Mount Royal, off campus | Large site, so it needs a wider `radius_m` |
  | Old Port (Vieux-Port) | Old Montreal, off campus | Large area: set a wide radius or pick one anchor point (e.g. the Clock Tower) |
  | Redpath Museum | Campus | |
  | Leacock Building | Campus | |
  | Rutherford Physics Building observatory | Campus | Rooftop dome; challenge must be doable from publicly accessible ground |
  | La Banquise | Plateau, off campus | A restaurant: challenge must be doable from the street, without a purchase |

  Coordinates and radii are set in the seed migration and must be checked on the map. Challenges must never require entering restricted or private areas.

### Unlocking
- A user unlocks a landmark by uploading **one photo** of themselves doing the challenge there, with an optional caption. There's one unlock per user per landmark.
- Once you've unlocked a landmark, you can see **all users' photos** for it (no friends filter; there's no social graph yet). Before unlocking you see only the preview. This is enforced by RLS, not just the UI.
- **Unlocks are permanent:** users can **modify** their unlock (replace the photo, edit the caption) but **cannot delete** it. Removal is a moderator action (see Privacy).

### Verification belongs to the visit, not the photo
- At the landmark, the user taps **"I'm here"**. The browser reads its position **once** (opt-in, like ADR 0008) and sends it to a server action. The server computes the distance to the landmark and accepts it if it's within the landmark's `radius_m` plus the reported accuracy, up to a cap.
- The server records a **check-in** (user, landmark, time, verified). **The coordinates are discarded after the comparison and never stored, logged, or shared.**
- The location check happens **only at check-in, while the user is at the landmark**. After that, the photo can be uploaded or replaced **later, from anywhere, with no time limit**. Location no longer matters once the visit is verified. An unlock shows a **"verified visit"** badge when a verified check-in exists for that user and landmark. Replacing the photo doesn't affect it.
- Unverified unlocks are **allowed** (honour system, e.g. GPS failed indoors) but show no badge.
- Photo EXIF GPS is **not** used for verification in this version.

### Data model (Supabase)

```
landmarks          id, name, latitude, longitude, radius_m, challenge_prompt,
                   description, cover_image_path         -- curated; read-only to users
landmark_checkins  user_id, landmark_id, checked_in_at, verified   -- no coordinates
landmark_unlocks   user_id, landmark_id (PK pair), photo_path, caption,
                   created_at, updated_at
storage bucket     landmark-photos (private), path {user_id}/{landmark_id}.jpg
```

- `landmarks`: select for authenticated users; no client writes.
- `landmark_checkins`: inserted **only by the server action** after the distance check (a `security definer` function or RPC). Clients can't insert or update them directly, so they can't set `verified` themselves. Users can read their own.
- `landmark_unlocks`: insert own (`user_id = auth.uid()`). Update own, limited by column grants to `photo_path` and `caption`. **No delete policy.** Select: your own unlock, plus all unlocks of landmarks you've unlocked.
- Storage: insert and update (upsert) only in your own folder. **No delete.** Read objects only for landmarks you've unlocked. A fixed path per unlock means replacing the photo overwrites it, so there are no orphaned files and no way to "delete by removing the file". The UI adds `?v=<updated_at>` to bust caches.
- Bucket limits: images only, ~5 MB max, enforced by the bucket settings.

### Photos
- Photos are resized and re-encoded in the **browser** before upload (canvas, ~1280 px JPEG, plus a small thumbnail). This strips EXIF metadata such as GPS and device info, and keeps storage and bandwidth low without paid server-side image processing.
- Displayed through short-lived signed URLs (the bucket is private).

### Privacy and moderation
- The upload form states that the photo is **visible to everyone who has unlocked this landmark**, and that **unlocks are permanent; the photo and caption can be changed but not removed**.
- A **report** action, plus moderator removal through the Supabase dashboard, covers takedown requests (including people who appear in someone else's photo). Users can always replace their own photo.
- Landmarks are public places only, and challenges never require entering restricted areas or buying anything. There's no tracking, and the position is read only when the user taps "I'm here".

### Build order
1. **Core:** landmarks table and seed, map markers, preview card, landmark page, photo upload with honour-system unlock, RLS-gated gallery, no-delete rules.
2. **Safety and polish:** report flow, profile progress ("5 / 20 landmarks"), points (the "Feathers" idea; needs its own small decision).
3. **Last:** check-ins and the "verified visit" badge.

### Service API
New `lib/landmarks.ts`, following the `lib/meetups.ts` pattern (server-only, mock mode without Supabase):
`listLandmarks()`, `getLandmark(id)`, `listLandmarkPhotos(id)`, `saveUnlock(landmarkId, photo, caption)` (create or modify), `checkIn(landmarkId, position)` (phase 3; position used once, never stored).

## Consequences

- Gives students a reason to go to real campus places even when no meetup is on, and adds a social payoff (seeing others' photos).
- New storage of **personal photos**: needs the moderation path above before any public demo. Permanent unlocks make takedowns a team responsibility.
- Verification is **best-effort**: positions can be spoofed and indoor GPS is poor. The badge means "probably visited", not proof. Generous radii are needed.
- The server receives a position at check-in. This is the new data flow ADR 0008 required an ADR for. It must stay one-shot and unstored.
- Landmarks are seeded by migration like `campus_locations`; adding one is a code and migration change.
- Three landmarks are off campus (Oratory, Old Port, La Banquise), so the map must zoom out beyond campus to show them, and unlocking them takes a real trip.
- Adds work for several owners: database/Storage/RLS and `lib/landmarks.ts` (Developer 3), map markers and preview card (Developer 4), landmark page, upload form and gallery (Developers 1 and 2). The core meetup flow should be stable and deployed first.

### Open questions
- The challenge text for each landmark, and who curates future landmarks.
- Whether the Old Port uses one anchor point or a wide radius.
