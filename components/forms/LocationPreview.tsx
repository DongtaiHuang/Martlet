"use client";

import { useState } from "react";
import Image from "next/image";
import { Building2 } from "lucide-react";
import { MeetupLocationMap } from "@/components/map/MeetupLocationMap";
import { LOCATION_PHOTOS } from "@/lib/location-photos";
import type { CampusLocation } from "@/lib/locations";

function LocationPhoto({ location }: { location: CampusLocation }) {
  const photo = LOCATION_PHOTOS[location.id];
  const [failed, setFailed] = useState(false);

  if (!photo || failed) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl bg-surface-muted px-4 text-center text-ink-2 sm:h-72">
        <Building2 aria-hidden="true" className="size-8 text-brand-ink" />
        <p className="font-semibold">{location.name}</p>
        <p className="text-sm">Photo unavailable</p>
      </div>
    );
  }

  return (
    <figure className="min-w-0">
      <div className="relative h-56 overflow-hidden rounded-xl bg-surface-muted sm:h-72">
        <Image
          src={photo.src}
          alt={`View of ${location.name}`}
          fill
          sizes="(min-width: 768px) 380px, (min-width: 640px) 568px, calc(100vw - 80px)"
          className="object-contain"
          onError={() => setFailed(true)}
        />
      </div>
      <figcaption className="px-1 text-xs text-ink-2">
        <a href={photo.source} className="inline-flex min-h-11 items-center py-1 pr-2 underline">{photo.photographer}</a>
        <a href={photo.licenseUrl} className="inline-flex min-h-11 items-center py-1 pr-2 underline">{photo.license}</a>
        <span>Resized and converted to WebP</span>
      </figcaption>
    </figure>
  );
}

export function LocationPreview({ location }: { location: CampusLocation & { address?: string } }) {
  return (
    <section aria-label="Location preview" className="min-w-0 space-y-3 rounded-2xl border border-line bg-canvas p-3">
      <div className="px-1">
        <h2 className="font-semibold">{location.name}</h2>
        {location.address && <p className="text-sm text-ink-muted">{location.address}</p>}
      </div>
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <LocationPhoto key={location.id} location={location} />
        <MeetupLocationMap locationName={location.name} latitude={location.latitude} longitude={location.longitude} />
      </div>
    </section>
  );
}
