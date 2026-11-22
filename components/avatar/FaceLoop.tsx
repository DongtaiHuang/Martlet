"use client";

// Face loop capture (prototype). Three frames ~0.4 s apart from the front camera, square-cropped,
// optionally cartoon-filtered. Frames stay in browser memory only: nothing is uploaded or saved.
import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Trash2, X } from "lucide-react";

const SIZE = 256;
const GAP_MS = 400;

function cartoonize(ctx: CanvasRenderingContext2D) {
  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  const d = img.data, levels = 6, step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    // Saturation boost, then posterize: a flat, illustrated look that matches the martlet.
    const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
    for (let c = 0; c < 3; c++) {
      const v = Math.min(255, Math.max(0, avg + (d[i + c] - avg) * 1.35));
      d[i + c] = Math.round(v / step) * step;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function FaceLoop({ frames, onFrames }: { frames: string[]; onFrames: (frames: string[]) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [cartoon, setCartoon] = useState(true);

  const stop = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => stop, []);

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) { setError("This browser can’t use the camera here (it needs HTTPS or localhost)."); return; }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      setOpen(true);
      requestAnimationFrame(() => { if (video.current && stream.current) { video.current.srcObject = stream.current; void video.current.play(); } });
    } catch (e) {
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Camera permission was denied. Allow it in the browser’s site settings to try again." : "Couldn’t start the camera.");
    }
  }

  function grab(): string {
    const v = video.current!;
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const side = Math.min(v.videoWidth, v.videoHeight);
    ctx.translate(SIZE, 0); ctx.scale(-1, 1); // mirror, like the preview
    ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (cartoon) cartoonize(ctx);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  async function capture() {
    const v = video.current;
    // Wait until the camera is actually delivering frames (otherwise captures come out black).
    for (let i = 0; v && (v.readyState < 2 || !v.videoWidth) && i < 50; i++) await new Promise((r) => setTimeout(r, 100));
    if (!v?.videoWidth) { setError("The camera isn’t sending video yet. Try again."); return; }
    for (const n of [3, 2, 1]) { setCount(n); await new Promise((r) => setTimeout(r, 700)); }
    setCount(0);
    const shots: string[] = [];
    for (let i = 0; i < 3; i++) { shots.push(grab()); if (i < 2) await new Promise((r) => setTimeout(r, GAP_MS)); }
    setCount(null);
    stop(); setOpen(false);
    onFrames(shots);
  }

  const btn = "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60";
  return (
    <div>
      {open ? (
        <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-stone-900">
          <video ref={video} playsInline muted className="aspect-square w-full -scale-x-100 object-cover" aria-label="Camera preview" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="size-3/4 rounded-full border-4 border-dashed border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
          </div>
          {count !== null && <p role="status" className="absolute inset-0 grid place-items-center text-7xl font-black text-white drop-shadow">{count || "📸"}</p>}
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-2 bg-gradient-to-t from-black/70 p-3">
            <button type="button" disabled={count !== null} onClick={() => void capture()} className={`${btn} bg-red-800 text-white hover:bg-red-900`}><Camera aria-hidden="true" size={16} /> Capture 3 frames</button>
            <button type="button" disabled={count !== null} onClick={() => { stop(); setOpen(false); }} className={`${btn} bg-white/90 text-stone-900`}><X aria-hidden="true" size={16} /> Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void start()} className={`${btn} bg-red-800 text-white hover:bg-red-900`}>
            {frames.length ? <RefreshCw aria-hidden="true" size={16} /> : <Camera aria-hidden="true" size={16} />} {frames.length ? "Retake face loop" : "Make my face loop"}
          </button>
          {frames.length > 0 && (
            <button type="button" onClick={() => onFrames([])} className={`${btn} border border-stone-300 bg-white text-stone-800 hover:border-red-700`}><Trash2 aria-hidden="true" size={16} /> Remove</button>
          )}
          <label className="inline-flex min-h-11 items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={cartoon} onChange={(e) => setCartoon(e.target.checked)} className="size-4 accent-red-800" /> Cartoon filter
          </label>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
      <p className="mt-2 text-xs text-stone-500">Prototype: frames stay in this browser tab only. Nothing is uploaded or saved.</p>
    </div>
  );
}
