// Serve MediaPipe's WebAssembly runtime from our own origin (public/mediapipe/), like the
// MapLibre worker. Used by the 3D martlet's face tracking. Runs before dev/build.
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("public/mediapipe", { recursive: true });
cpSync("node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe", { recursive: true });
