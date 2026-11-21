// Kept free of maplibre-gl so Server Components can import it.

/** Explore-map URL that opens centred on one meetup with its popup showing. */
export function exploreMeetupHref(meetupId: string): string {
  return `/explore?meetup=${encodeURIComponent(meetupId)}`;
}
