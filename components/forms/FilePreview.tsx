"use client";

import { useEffect, useRef } from "react";

/**
 * Preview a chosen image file by drawing it on a canvas, scaled to fit `maxSide`.
 * A canvas instead of an `<img src={blob:}>` keeps user-picked data out of a URL
 * attribute (CodeQL js/xss-through-dom) and needs no object URL to revoke.
 */
export function FilePreview({ file, label, maxSide = 640, className = "" }: { file: File; label: string; maxSide?: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    createImageBitmap(file, { imageOrientation: "from-image" }).then((bitmap) => {
      const c = canvas.current;
      if (cancelled || !c) return bitmap.close();
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      c.width = Math.round(bitmap.width * scale);
      c.height = Math.round(bitmap.height * scale);
      c.getContext("2d")?.drawImage(bitmap, 0, 0, c.width, c.height);
      bitmap.close();
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [file, maxSide]);
  return <canvas ref={canvas} width={0} height={0} role="img" aria-label={label} className={`h-auto w-auto max-w-full ${className}`} />;
}
