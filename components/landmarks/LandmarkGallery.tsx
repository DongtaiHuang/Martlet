import { ImageOff } from "lucide-react";
import type { LandmarkPhoto } from "@/types/landmark";

const EDIT_THRESHOLD_MS = 60_000;

/** Photos from everyone who unlocked a landmark. Only rendered once the viewer has unlocked it. */
export function LandmarkGallery({ photos, landmarkName }: { photos: LandmarkPhoto[]; landmarkName: string }) {
  if (photos.length === 0) {
    return <p className="text-sm text-stone-600">No photos yet.</p>;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {photos.map((photo) => {
        const edited = Date.parse(photo.updated_at) - Date.parse(photo.created_at) > EDIT_THRESHOLD_MS;
        return (
          <li key={photo.user_id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            {photo.photo_url ? (
              // Short-lived signed Supabase URLs; next/image would need remote config and re-optimize each token.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.photo_url}
                alt={`${photo.display_name} at ${landmarkName}`}
                loading="lazy"
                className="aspect-[4/3] w-full bg-stone-100 object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-stone-100 text-sm text-stone-500">
                <ImageOff aria-hidden="true" size={24} />
                Photo unavailable
              </div>
            )}
            <div className="p-4">
              <p className="text-sm font-bold text-stone-900">
                {photo.display_name}
                {photo.is_mine && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">You</span>}
              </p>
              {photo.caption && <p className="mt-1 text-sm text-stone-700 [overflow-wrap:anywhere]">{photo.caption}</p>}
              <p className="mt-1 text-xs text-stone-500">
                <time dateTime={photo.created_at}>{new Date(photo.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}</time>
                {edited && " · edited"}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
