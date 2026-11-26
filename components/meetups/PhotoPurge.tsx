"use client";

import { useEffect } from "react";
import { purgePhotosAction } from "@/app/meetups/[id]/photo-actions";
import { purgeListingPhotosAction } from "@/app/marketplace/actions";

const KEY = "martlet-photo-purge";
const EVERY_MS = 6 * 3_600_000;

/**
 * Deletes the signed-in student's dead album and listing photos from Storage in the background,
 * at most every 6 hours per browser (ADRs 0039 and 0040). Renders nothing.
 */
export function PhotoPurge() {
  useEffect(() => {
    try {
      const last = Number(localStorage.getItem(KEY) ?? 0);
      if (Date.now() - last < EVERY_MS) return;
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      return; // storage blocked: skip rather than purge on every page
    }
    void purgePhotosAction();
    void purgeListingPhotosAction();
  }, []);
  return null;
}
