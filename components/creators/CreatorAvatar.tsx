import { birdColor, birdSvg } from "@/components/map/popup-bird";

/**
 * A creator's profile photo (ADR 0045), or, without one, the map's pixel chick in a colour of
 * their own (from their id), so every profile has a face in the site's pixel style.
 */
export function CreatorAvatar({ userId, photoUrl, name, className = "size-12" }: { userId: string; photoUrl: string | null; name: string; className?: string }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket
    return <img src={photoUrl} alt={`${name}’s photo`} className={`shrink-0 rounded-full bg-surface-muted object-cover ring-2 ring-surface ${className}`} />;
  }
  const svg = birdSvg(birdColor(userId), 64).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-surface-muted ring-2 ring-surface ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated pixel SVG */}
      <img src={`data:image/svg+xml,${encodeURIComponent(svg)}`} alt="" className="size-3/4 [image-rendering:pixelated]" />
    </span>
  );
}
