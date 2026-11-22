"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleLocationMap } from "@/components/map/GoogleLocationMap";
import { loadGoogleLibrary } from "@/lib/google-maps";

type Preview = { name: string; address: string; latitude: number; longitude: number };

export function GooglePlaceSearch() {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading place search…");
  const [place, setPlace] = useState<Preview>();

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const controller = new AbortController();
    const { signal } = controller;
    let selection = 0;
    loadGoogleLibrary("places").then(({ PlaceAutocompleteElement }) => {
      if (signal.aborted) return;
      const search = new PlaceAutocompleteElement({
        locationBias: { center: { lat: 45.5019, lng: -73.5674 }, radius: 25_000 },
        includedRegionCodes: ["ca"],
      });
      search.setAttribute("aria-label", "Search for a public place near Montréal");
      search.style.width = "100%";
      search.addEventListener("input", () => {
        selection++;
        setPlace(undefined);
        setStatus("");
      }, { signal });
      search.addEventListener("gmp-error", () => setStatus("Google Places search is unavailable."), { signal });
      search.addEventListener("gmp-select", async (event) => {
        const prediction = (event as google.maps.places.PlacePredictionSelectEvent).placePrediction;
        const request = ++selection;
        setPlace(undefined);
        setStatus("Loading place details…");
        try {
          const result = prediction.toPlace();
          await result.fetchFields({ fields: ["displayName", "formattedAddress", "location", "types"] });
          if (signal.aborted || request !== selection) return;
          if (!result.location || !result.displayName || !result.formattedAddress) {
            setStatus("Choose a place with a name, address, and map location.");
            return;
          }
          if (result.types?.some((type) => ["street_address", "subpremise", "apartment_building", "housing_complex"].includes(type))) {
            setStatus("Choose a public gathering place.");
            return;
          }
          setPlace({
            name: result.displayName, address: result.formattedAddress,
            latitude: result.location.lat(), longitude: result.location.lng(),
          });
          setStatus("");
        } catch {
          if (!signal.aborted && request === selection) setStatus("Place details are unavailable. Choose a suggestion to retry.");
        }
      }, { signal });
      container.append(search);
      setStatus("");
    }).catch(() => {
      if (!signal.aborted) setStatus("Google Places search could not load.");
    });
    return () => {
      controller.abort();
      container.replaceChildren();
    };
  }, []);

  return (
    <section aria-label="Google Places search" className="min-w-0 space-y-2">
      <p className="font-semibold">Search for a public place</p>
      <div ref={host} />
      {status && <p role="status" className="text-sm text-ink-muted">{status}</p>}
      <p className="text-sm text-ink-muted">Use this lookup to check a place. The meetup publishes the meeting instructions you type.</p>
      {place && <div className="space-y-2">
        <p className="font-semibold">{place.name}</p>
        <p className="text-sm text-ink-muted">{place.address}</p>
        <GoogleLocationMap locationName={place.name} latitude={place.latitude} longitude={place.longitude} />
      </div>}
    </section>
  );
}
