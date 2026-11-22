"use client";

// Camera → MediaPipe Face Landmarker → Face values (prototype). Runs fully in the browser.
// The video never leaves the device and is never stored; only expression numbers are read.
import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker, FaceLandmarkerResult, Landmark, NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";
import { NEUTRAL, toRow, type Clip, type Face } from "./face";

// All served from our own origin by scripts/copy-mediapipe-wasm.mjs.
const WASM_BASE = "/mediapipe";
const FACE_MODEL = "/mediapipe/face_landmarker.task";
const POSE_MODEL = "/mediapipe/pose_landmarker_lite.task";
const CLIP_SECONDS = 3, CLIP_FPS = 15;

export type TrackerStatus = "idle" | "loading" | "live" | "recording" | "error";

type Arm = { raise: number; swing: number; bend: number };
const REST: Arm = { raise: 0, swing: 0, bend: 0 };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * One arm's pose from MediaPipe world landmarks (metres, hip-centred, y down, smaller z = closer
 * to the camera): raise (down → sideways → overhead), swing (back ↔ toward camera), elbow bend.
 */
function armPose(world: Landmark[], img: NormalizedLandmark[], shoulder: number, elbow: number, wrist: number): Arm {
  const a = world[shoulder], b = world[elbow], c = world[wrist];
  const seen = (i: number) => (img[i]?.visibility ?? 1) >= 0.5;
  if (!a || !b || !seen(shoulder) || !seen(elbow)) return REST;
  let vx = b.x - a.x, vy = b.y - a.y, vz = b.z - a.z;
  const len = Math.hypot(vx, vy, vz) || 1; vx /= len; vy /= len; vz /= len;
  const raise = clamp01(Math.atan2(Math.abs(vx), vy) / (Math.PI * 0.85));
  const swing = Math.max(-1, Math.min(1, Math.asin(Math.max(-1, Math.min(1, -vz))) / (Math.PI / 2)));
  let bend = 0;
  if (c && seen(wrist)) {
    const ux = a.x - b.x, uy = a.y - b.y, uz = a.z - b.z, wx = c.x - b.x, wy = c.y - b.y, wz = c.z - b.z;
    const cos = (ux * wx + uy * wy + uz * wz) / ((Math.hypot(ux, uy, uz) * Math.hypot(wx, wy, wz)) || 1);
    bend = clamp01((Math.PI - Math.acos(Math.max(-1, Math.min(1, cos)))) / (Math.PI * 0.7));
  }
  return { raise, swing, bend };
}

function toFace(res: FaceLandmarkerResult): Face | null {
  const shapes = res.faceBlendshapes?.[0]?.categories;
  if (!shapes) return null;
  const s = (name: string) => shapes.find((c) => c.categoryName === name)?.score ?? 0;
  const face: Face = {
    // Mirrored like a selfie: your left eye drives the eye on the same side of the screen.
    blinkL: s("eyeBlinkRight"), blinkR: s("eyeBlinkLeft"), jaw: s("jawOpen"),
    smile: (s("mouthSmileLeft") + s("mouthSmileRight")) / 2,
    browUp: s("browInnerUp"), browDown: (s("browDownLeft") + s("browDownRight")) / 2,
    yaw: 0, pitch: 0, roll: 0,
    tongue: s("tongueOut"), pucker: Math.max(s("mouthPucker"), s("mouthFunnel")), puff: s("cheekPuff"),
    frown: (s("mouthFrownLeft") + s("mouthFrownRight")) / 2,
    wide: (s("eyeWideLeft") + s("eyeWideRight")) / 2, squint: (s("eyeSquintLeft") + s("eyeSquintRight")) / 2,
    mouthX: s("mouthLeft") - s("mouthRight"), // your mouth's left is on the screen's right (mirrored)
    wingL: 0, wingR: 0, swingL: 0, swingR: 0, bendL: 0, bendR: 0,
  };
  const m = res.facialTransformationMatrixes?.[0]?.data;
  if (m) { // column-major 4x4 rotation → yaw/pitch/roll (radians), mirrored
    face.yaw = -Math.atan2(m[8], m[10]);
    face.pitch = Math.asin(Math.max(-1, Math.min(1, -m[9])));
    face.roll = -Math.atan2(m[1], m[5]);
  }
  return face;
}

/** Returns `faceRef`, which always holds the latest expression (NEUTRAL when not tracking). */
export function useFaceTracker() {
  const [status, setStatus] = useState<TrackerStatus>("idle");
  const [error, setError] = useState("");
  const faceRef = useRef<Face>({ ...NEUTRAL });
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const poseRef = useRef<PoseLandmarker | null>(null);
  const armsRef = useRef<{ l: Arm; r: Arm }>({ l: REST, r: REST });
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const recordingRef = useRef<{ start: number; rows: number[][]; done: (c: Clip) => void } | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    faceRef.current = { ...NEUTRAL };
    setStatus("idle");
  }, []);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    landmarkerRef.current?.close();
    poseRef.current?.close();
  }, []);

  const start = useCallback(async () => {
    setError(""); setStatus("loading");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can’t use the camera here (it needs HTTPS or localhost).");
      if (!landmarkerRef.current) {
        const { FaceLandmarker, PoseLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const files = await FilesetResolver.forVisionTasks(WASM_BASE);
        landmarkerRef.current = await FaceLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
          runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
        });
        // Arms are optional: if the pose model fails, face tracking still works.
        poseRef.current = await PoseLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" }, runningMode: "VIDEO", numPoses: 1,
        }).catch(() => null);
      }
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      const video = document.createElement("video");
      video.playsInline = true; video.muted = true; video.srcObject = streamRef.current;
      await video.play();
      setStatus("live");

      let frame = 0;
      const loop = () => {
        const lm = landmarkerRef.current;
        if (lm && video.readyState >= 2) {
          const now = performance.now();
          const pose = poseRef.current;
          if (pose && frame++ % 2 === 0) { // arms every other frame keeps it light on phones
            const res = pose.detectForVideo(video, now);
            const img = res.landmarks?.[0], world = res.worldLandmarks?.[0];
            // Mirrored: your right arm (12/14/16) drives the wing on the left of the screen.
            armsRef.current = img && world
              ? { l: armPose(world, img, 12, 14, 16), r: armPose(world, img, 11, 13, 15) }
              : { l: REST, r: REST };
          }
          const face = toFace(lm.detectForVideo(video, now));
          if (face) {
            const { l, r } = armsRef.current;
            Object.assign(face, { wingL: l.raise, wingR: r.raise, swingL: l.swing, swingR: r.swing, bendL: l.bend, bendR: r.bend });
            faceRef.current = face;
          }
          const rec = recordingRef.current;
          if (rec) { // always ends on time, even if the face is lost mid-recording
            const elapsed = (performance.now() - rec.start) / 1000;
            if (face && elapsed >= rec.rows.length / CLIP_FPS) rec.rows.push(toRow(face));
            if (elapsed >= CLIP_SECONDS) {
              recordingRef.current = null; setStatus("live");
              if (rec.rows.length < 5) setError("No face detected. Face the camera in good light and try again.");
              rec.done({ fps: CLIP_FPS, frames: rec.rows });
            }
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      stop();
      setStatus("error");
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Camera permission was denied. Allow it in the browser’s site settings to try again."
        : e instanceof Error ? e.message : "Couldn’t start face tracking.");
    }
  }, [stop]);

  const record = useCallback(() => new Promise<Clip>((done) => {
    setError("");
    recordingRef.current = { start: performance.now(), rows: [], done };
    setStatus("recording");
  }), []);

  return { status, error, start, stop, record, faceRef, clipSeconds: CLIP_SECONDS };
}
