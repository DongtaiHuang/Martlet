"use client";

// Camera → MediaPipe Face Landmarker → Face values (prototype). Runs fully in the browser.
// The video never leaves the device and is never stored; only expression numbers are read.
import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker, FaceLandmarkerResult, NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";
import { NEUTRAL, toRow, type Clip, type Face } from "./face";

// All served from our own origin by scripts/copy-mediapipe-wasm.mjs.
const WASM_BASE = "/mediapipe";
const FACE_MODEL = "/mediapipe/face_landmarker.task";
const POSE_MODEL = "/mediapipe/pose_landmarker_lite.task";
const CLIP_SECONDS = 3, CLIP_FPS = 15;

export type TrackerStatus = "idle" | "loading" | "live" | "recording" | "error";

/** How far an arm is raised: 0 hanging down, 1 straight up. Uses shoulder→elbow in image space. */
function armRaise(lm: NormalizedLandmark[], shoulder: number, elbow: number): number {
  const a = lm[shoulder], b = lm[elbow];
  if (!a || !b || (a.visibility ?? 1) < 0.5 || (b.visibility ?? 1) < 0.5) return 0;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const angle = Math.acos(Math.max(-1, Math.min(1, dy / len))); // 0 = pointing down
  return Math.max(0, Math.min(1, angle / (Math.PI * 0.85)));
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
    yaw: 0, pitch: 0, roll: 0, wingL: 0, wingR: 0,
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
  const wingsRef = useRef({ l: 0, r: 0 });
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
            const p = pose.detectForVideo(video, now).landmarks?.[0];
            // Mirrored: your right arm (12/14) lifts the wing on the left of the screen.
            wingsRef.current = p ? { l: armRaise(p, 12, 14), r: armRaise(p, 11, 13) } : { l: 0, r: 0 };
          }
          const face = toFace(lm.detectForVideo(video, now));
          if (face) { face.wingL = wingsRef.current.l; face.wingR = wingsRef.current.r; faceRef.current = face; }
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
