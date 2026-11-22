/**
 * Marty, the pixel-art martlet mascot (34x20 pixels, facing right). A round, chubby take on
 * the heraldic martlet: swallow silhouette with no legs, forked swept-back tail, burgundy cap
 * and wings, cream chest, coral beak. The wing is its own group so it can flap while dragged,
 * and the eye can close while Marty naps in the nest. Its size comes from --martlet-w.
 */
export function FlyingMartletSprite() {
  return (
    <svg aria-hidden="true" viewBox="0 0 34 20" shapeRendering="crispEdges" className="martlet-hop-body h-auto w-(--martlet-w) shrink-0 overflow-visible">
      {/* Outline, cap, face and chest, back, forked tail, belly. */}
      <path fill="#39131d" d="M24 0h2v1h-2zM22 1h2v1h-2zM26 1h3v1h-3zM21 2h1v1h-1zM29 2h1v1h-1zM20 3h1v1h-1zM30 3h1v1h-1zM19 4h1v1h-1zM30 4h1v1h-1zM19 5h1v1h-1zM31 5h2v1h-2zM15 6h5v1h-5zM33 6h1v1h-1zM13 7h2v1h-2zM32 7h1v1h-1zM2 8h5v1h-5zM11 8h2v1h-2zM30 8h2v1h-2zM1 9h1v1h-1zM7 9h4v1h-4zM30 9h1v1h-1zM0 10h1v1h-1zM29 10h1v1h-1zM1 11h2v1h-2zM28 11h1v1h-1zM3 12h6v1h-6zM28 12h1v1h-1zM2 13h2v1h-2zM28 13h1v1h-1zM1 14h1v1h-1zM27 14h1v1h-1zM2 15h1v1h-1zM7 15h4v1h-4zM26 15h1v1h-1zM3 16h4v1h-4zM11 16h1v1h-1zM25 16h1v1h-1zM12 17h3v1h-3zM22 17h3v1h-3zM15 18h7v1h-7z" />
      <path fill="#b23a4a" d="M24 1h2v1h-2zM23 2h4v1h-4z" />
      <path fill="#8c2635" d="M22 2h1v1h-1zM27 2h2v1h-2zM21 3h9v1h-9zM20 4h10v1h-10zM20 5h3v1h-3zM20 6h3v1h-3zM20 7h3v1h-3zM20 8h3v1h-3zM21 9h1v1h-1z" />
      <path fill="#fce8d5" d="M23 5h8v1h-8zM23 6h8v1h-8zM23 7h7v1h-7zM23 8h3v1h-3zM28 8h2v1h-2zM22 9h8v1h-8zM23 10h6v1h-6zM24 11h3v1h-3zM15 13h13v1h-13zM15 14h12v1h-12zM15 15h11v1h-11z" />
      <path fill="#9c2334" d="M15 7h5v1h-5zM13 8h7v1h-7zM11 9h10v1h-10zM10 10h13v1h-13z" />
      <path fill="#751e2c" d="M2 9h5v1h-5zM8 10h2v1h-2zM3 11h6v1h-6zM4 13h5v1h-5zM2 14h8v1h-8zM3 15h4v1h-4z" />
      <path fill="#ba3746" d="M1 10h7v1h-7z" />
      <path fill="#e7b89c" d="M9 11h15v1h-15zM27 11h1v1h-1zM9 12h19v1h-19zM9 13h6v1h-6zM10 14h5v1h-5zM11 15h4v1h-4z" />
      <path fill="#d29a7d" d="M12 16h13v1h-13zM15 17h7v1h-7z" />

      {/* Small coral beak and a blush. */}
      <path fill="#ee654e" d="M31 6h2v1h-2z" />
      <path fill="#c94a36" d="M30 7h2v1h-2z" />
      <path fill="#f4a3a0" d="M26 8h2v1h-2z" />

      {/* Round dot eye; a closed one while asleep in the nest. */}
      <path className="martlet-eye-open" fill="#2a0f16" d="M27 5h2v2h-2z" />
      <path className="martlet-eye-closed" fill="#2a0f16" d="M27 6h2v1h-2z" />

      <g className="martlet-drag-wing">
        <path fill="#ed6570" d="M15 10h8v1h-8z" />
        <path fill="#b02d3f" d="M12 11h3v1h-3zM10 12h9v1h-9zM20 12h4v1h-4z" />
        <path fill="#ce3f50" d="M15 11h5v1h-5zM21 11h3v1h-3z" />
        <path fill="#ffe9de" d="M20 11h1v1h-1zM19 12h1v1h-1z" />
        <path fill="#9c2334" d="M12 13h11v1h-11zM15 14h6v1h-6z" />
      </g>
    </svg>
  );
}
