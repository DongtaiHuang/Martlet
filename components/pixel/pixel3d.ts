import * as THREE from "three";

// Pixel look for the 3D scenes (ADR 0044): render at a third of the CSS size and upscale with
// smoothing off, no anti-aliasing, and three-tone toon shading so light falls in flat bands like
// the site's pixel art. Tracking and game logic are untouched.

/** CSS pixels per art pixel, close to Martlet Flight's. */
export const PIXEL_SIZE = 3;

/** Spread onto <Canvas>: a low-resolution drawing buffer, scaled up crisply. */
export const PIXEL_CANVAS = {
  dpr: 1 / PIXEL_SIZE,
  gl: { antialias: false },
  // image-rendering is inherited, so setting it on R3F's wrapper reaches its <canvas>.
  style: { imageRendering: "pixelated" },
} as const;

let gradient: THREE.DataTexture | null = null;

/** The toon ramp shared by every material: shadow, mid and lit. */
export function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([110, 180, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}
