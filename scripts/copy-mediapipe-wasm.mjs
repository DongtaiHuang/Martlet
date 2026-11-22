// Serve MediaPipe's WebAssembly runtime and models from our own origin (public/mediapipe/),
// like the MapLibre worker. Used by the 3D martlet's face + arm tracking. Runs before dev/build.
// Models are downloaded once (Google's model bucket doesn't allow cross-origin browser loads
// for all models) and reused if already present.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const DIR = "public/mediapipe";
const MODELS = {
  "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  "pose_landmarker_lite.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

mkdirSync(DIR, { recursive: true });
cpSync("node_modules/@mediapipe/tasks-vision/wasm", DIR, { recursive: true });

for (const [file, url] of Object.entries(MODELS)) {
  const dest = `${DIR}/${file}`;
  if (existsSync(dest)) continue;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    console.log(`mediapipe: downloaded ${file}`);
  } catch (e) {
    // Don't block dev/build; the avatar page shows a tracking error instead.
    console.warn(`mediapipe: couldn't download ${file} (${e.message}); face/arm tracking will be unavailable.`);
  }
}
