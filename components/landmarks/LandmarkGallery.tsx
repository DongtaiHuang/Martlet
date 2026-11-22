import { ImageOff } from "lucide-react";
import type { LandmarkPhoto } from "@/types/landmark";
import { LandmarkPhotoZoom } from "./LandmarkPhotoZoom";

const EDIT_THRESHOLD_MS = 60_000;

/** Photos from everyone who unlocked a landmark. Only rendered once the viewer has unlocked it. */
export function LandmarkGallery({ photos, landmarkName }: { photos: LandmarkPhoto[]; landmarkName: string }) {
  if (photos.length === 0) {
    return <p className="text-sm text-ink-muted">No photos yet.</p>;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {photos.map((photo) => {
        const edited = Date.parse(photo.updated_at) - Date.parse(photo.created_at) > EDIT_THRESHOLD_MS;
        return (
          <li
            key={photo.user_id}
            // The progress tree's fruit links here (/landmarks/<id>#my-photo); highlight it when targeted.
            id={photo.is_mine ? "my-photo" : undefined}
            className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm target:ring-4 target:ring-red-500"
          >
            {photo.photo_url ? (
              <LandmarkPhotoZoom
                src={photo.photo_url}
                alt={`${photo.display_name} at ${landmarkName}`}
                photographer={photo.display_name}
                landmarkName={landmarkName}
              />
            ) : (
              <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-surface-muted text-sm text-ink-subtle">
                <ImageOff aria-hidden="true" size={24} />
                Photo unavailable
              </div>
            )}
            <div className="p-4">
              <p className="text-sm font-bold text-ink-soft">
                {photo.display_name}
                {photo.is_mine && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink">You</span>}
              </p>
              {photo.caption && <p className="mt-1 text-sm text-ink-2 [overflow-wrap:anywhere]">{photo.caption}</p>}
              <p className="mt-1 text-xs text-ink-subtle">
                <time dateTime={photo.created_at}>{new Date(photo.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}</time>
                {edited && " · edited"}
              </p>

              {/* Only the owner can replace their photo */}
              {photo.is_mine && (
                <a
                  href="#edit-my-photo"
                  className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand bg-brand-soft px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand hover:text-on-brand"
                >
                  Replace Photo
                </a>
              )}

            </div>
          </li>
        );
      })}
    </ul>
  );
}
