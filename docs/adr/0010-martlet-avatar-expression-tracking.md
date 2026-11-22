# 0010. Martlet avatar with in-browser expression tracking

- **Status:** Proposed
- **Date:** 2026-11-22
- **Relates to:** [0007](0007-frozen-mvp-and-service-contracts.md) (adds a feature beyond the frozen MVP), issue #28 (achievements)

## Context

Students need a recognisable identity on Martlet that rewards taking part, without photos of their faces being spread around. We explored three options:

1. **Photo face loop:** three webcam frames shown as a GIF-like loop. Rejected. Face images are sensitive personal information under Québec's Law 25. Storing them would require consent, retention and deletion rules, and they could be misused for recognition.
2. **2D illustrated avatar.** Kept only as a fallback for devices that can't render 3D.
3. **3D low-poly martlet that mirrors the user's expressions,** Memoji-style. Chosen.

The martlet is an original swallow-style character inspired by McGill's mascot. It is not the McGill crest or its artwork.

## Decision

- **Avatar:** `/avatar` shows a 3D low-poly martlet (Three.js via `@react-three/fiber`), loaded only on that page and only in the browser. Users can turn it around by dragging or with the arrow keys.
- **Customisation from achievements, with no new tables:** accessories (scarf, backpack, camera, beanie, graduation cap), plumage colours and landmark pins unlock based on counts of hosted meetups, joined meetups and landmark unlocks. The counts are read from existing tables through RLS. Thresholds live in `components/avatar/items.ts`.
- **Expression tracking runs entirely in the browser.** MediaPipe Face Landmarker and Pose Landmarker read the front camera and output numbers:
  - blink, jaw, smile, brows, tongue, pucker, cheek puff, frown, wide or squinting eyes, mouth shift, head yaw/pitch/roll
  - for each arm: raise, forward/back swing and elbow bend

  The martlet is driven only by these numbers.
- **Privacy rules:**
  - The camera starts only when the user taps **Start camera**. It stops on **Stop camera** or when the user leaves the page.
  - Video frames are never uploaded, stored, logged or used to identify anyone. Only the expression numbers above are read from them.
  - A recorded **expression clip** is 3 seconds of those numbers (about 45 samples, a few KB). In this version it exists only in the browser tab.
  - Saving or sharing clips later (for example, an animated martlet on meetup cards) only needs storage for numbers, not images. It still needs its own decision covering who can see clips and how they're deleted.
- **Self-hosted runtime and models:** `scripts/copy-mediapipe-wasm.mjs` runs before `dev` and `build`. It copies MediaPipe's WebAssembly runtime from `node_modules` and downloads the face model (about 3.8 MB) and the lite pose model (about 5.8 MB) into `public/mediapipe/` (git-ignored). Google's bucket doesn't allow cross-origin browser loads of the pose model, and self-hosting avoids sending users' browsers to a third party.
- **Accessibility:**
  - The viewer can be reached with the keyboard: arrow keys turn and tilt it, and Home resets.
  - "Reduced motion" turns off idle animation.
  - Every customisation control is a normal button.

## Consequences

- Students get an avatar that is expressive and personal, with no stored face data. This avoids Law 25's sensitive-data obligations for images and stays far away from biometric rules.
- The page adds about 150 KB of 3D code, plus about 10 MB of models downloaded only after the camera is started. The rest of the app is unaffected.
- Builds need network access the first time, to download the models. If the download fails, the build still succeeds and tracking shows an error.
- Tracking quality depends on the device and the lighting. MediaPipe's `tongueOut` is unreliable, and arm swing uses depth estimated from one camera. Both are approximate.
- A future "martlet in your achievement tree" or "martlet on feed cards" can reuse the same component and expression-number format.
