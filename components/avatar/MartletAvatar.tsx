// Flat 2D martlet: fallback for devices without WebGL (see ADR 0010). Layered SVG: base bird +
// unlockable accessories. An original swallow-style character, not the McGill crest artwork.
import type { ItemId, Plumage } from "./items";

const RED = "#a6192e";

export function MartletAvatar({ plumage, wearing, pins = 0, size = 360, title = "Martlet avatar" }: {
  plumage: Plumage; wearing: Set<ItemId>; pins?: number; size?: number; title?: string;
}) {
  const { body, wing } = plumage;
  const W = 420;
  return (
    <svg viewBox={`0 0 ${W} 380`} width={size} height={(size * 380) / W} role="img" aria-label={title} className="max-w-full">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fdf6ec" /><stop offset="1" stopColor="#f3e6d6" /></linearGradient>
        <radialGradient id="sheen" cx="0.35" cy="0.3" r="0.7"><stop offset="0" stopColor="#fff" stopOpacity="0.28" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width={W} height="380" rx="28" fill="url(#sky)" />

      {/* Branch */}
      <path d={`M10 312 C 110 300, 220 318, ${W - 10} 296`} stroke="#5b4031" strokeWidth="14" strokeLinecap="round" fill="none" />
      <path d="M330 300 C 350 280, 372 276, 390 280" stroke="#5b4031" strokeWidth="7" strokeLinecap="round" fill="none" />
      <ellipse cx="392" cy="276" rx="16" ry="8" fill="#6b8f4e" transform="rotate(-20 392 276)" />
      <ellipse cx="60" cy="300" rx="18" ry="8" fill="#7aa35a" transform="rotate(15 60 300)" />

      {/* Forked tail */}
      <path d="M150 228 C 110 252, 70 282, 34 330 C 78 300, 112 282, 160 258 Z" fill={wing} />
      <path d="M160 240 C 128 270, 104 300, 86 344 C 118 308, 144 286, 176 262 Z" fill={body} />

      {/* Backpack (behind the body) */}
      {wearing.has("backpack") && (
        <g transform="rotate(-14 165 205)">
          <rect x="128" y="168" width="62" height="78" rx="16" fill="#2f6b3a" />
          <rect x="136" y="210" width="46" height="26" rx="8" fill="#245a30" />
          <rect x="152" y="160" width="14" height="14" rx="4" fill="#1f4d29" />
        </g>
      )}

      {/* Body */}
      <path d="M150 236 C 138 176, 188 132, 248 142 C 300 150, 314 208, 282 246 C 250 282, 172 284, 150 236 Z" fill={body} />
      <path d="M196 268 C 240 274, 280 252, 292 214 C 298 192, 292 176, 284 168 C 280 210, 250 246, 196 268 Z" fill="#f7f3ea" />
      <path d="M150 236 C 138 176, 188 132, 248 142 C 300 150, 314 208, 282 246 C 250 282, 172 284, 150 236 Z" fill="url(#sheen)" />

      {/* Wing with feather lines */}
      <path d="M162 196 C 196 164, 252 170, 262 204 C 252 238, 206 252, 146 262 C 156 238, 154 214, 162 196 Z" fill={wing} />
      <path d="M176 226 C 200 222, 226 214, 246 204 M168 242 C 196 238, 222 230, 244 220" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Landmark pins on the wing */}
      {Array.from({ length: pins }, (_, i) => (
        <circle key={i} cx={186 + i * 14} cy={206 - (i % 2) * 6} r="5.5" fill={["#f2c14e", "#e67e22", "#4fb3bf", "#c0392b", "#8e7cc3"][i]} stroke="#fff" strokeWidth="1.5" />
      ))}

      {/* Feet */}
      <path d="M216 276 L212 304 M240 274 L240 302" stroke="#3a2a20" strokeWidth="5" strokeLinecap="round" />

      {/* Head */}
      <circle cx="270" cy="134" r="44" fill={body} />
      <circle cx="270" cy="134" r="44" fill="url(#sheen)" />
      <path d="M262 164 C 276 184, 304 182, 310 160 C 300 170, 278 172, 262 164 Z" fill={RED} />
      <ellipse cx="262" cy="152" rx="10" ry="6" fill="#f4a3a8" opacity="0.55" />
      <circle cx="286" cy="124" r="12" fill="#fff" />
      <circle cx="289" cy="125" r="7" fill="#111" />
      <circle cx="292" cy="121" r="2.5" fill="#fff" />
      <path d="M308 128 L340 138 L308 148 Z" fill="#e3a835" />
      <path d="M308 138 L340 138" stroke="#b9821f" strokeWidth="1.5" />

      {/* Camera on a strap */}
      {wearing.has("camera") && (
        <g>
          <path d="M236 168 C 230 200, 238 226, 262 236" stroke="#2b2b2b" strokeWidth="4" fill="none" />
          <rect x="244" y="222" width="42" height="28" rx="6" fill="#2b2b2b" />
          <rect x="252" y="217" width="12" height="7" rx="2" fill="#2b2b2b" />
          <circle cx="268" cy="236" r="9" fill="#4a5568" stroke="#cbd5e0" strokeWidth="2" />
          <circle cx="280" cy="227" r="2.5" fill="#f6e05e" />
        </g>
      )}

      {/* Scarf */}
      {wearing.has("scarf") && (
        <g>
          <path d="M232 160 C 252 182, 296 186, 314 164 L318 178 C 300 202, 250 200, 228 176 Z" fill={RED} />
          <path d="M236 168 C 256 186, 292 190, 314 170" stroke="#fff" strokeWidth="4" fill="none" />
          <path d="M240 178 L226 232 L246 228 L252 182 Z" fill={RED} />
          <path d="M228 222 L247 218" stroke="#fff" strokeWidth="4" />
        </g>
      )}

      {/* Hats */}
      {wearing.has("beanie") && (
        <g>
          <path d="M228 120 C 228 76, 312 76, 312 120 Z" fill={RED} />
          <rect x="224" y="112" width="92" height="16" rx="8" fill="#f7f3ea" />
          <circle cx="270" cy="76" r="11" fill="#f7f3ea" />
        </g>
      )}
      {wearing.has("gradcap") && (
        <g>
          <path d="M238 108 L238 92 C 256 86, 284 86, 302 92 L302 108 Z" fill="#1a1a1a" />
          <path d="M210 88 L270 66 L330 88 L270 110 Z" fill="#222" />
          <circle cx="270" cy="88" r="3.5" fill="#e3a835" />
          <path d="M270 88 L322 100 L322 124" stroke="#e3a835" strokeWidth="3" fill="none" />
          <rect x="317" y="122" width="10" height="16" rx="3" fill="#e3a835" />
        </g>
      )}
    </svg>
  );
}
