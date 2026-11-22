"use client";

import { useEffect, useState } from "react";
import { nextLocalMinute } from "@/lib/local-date-time";

export function useFutureLocalTime() {
  const [minimum, setMinimum] = useState<string>();
  function refreshMinimum() {
    setMinimum(nextLocalMinute());
  }

  useEffect(() => {
    const tick = window.setInterval(refreshMinimum, 1000);
    const initial = window.setTimeout(refreshMinimum, 0);
    window.addEventListener("focus", refreshMinimum);
    document.addEventListener("visibilitychange", refreshMinimum);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(initial);
      window.removeEventListener("focus", refreshMinimum);
      document.removeEventListener("visibilitychange", refreshMinimum);
    };
  }, []);

  return { minimum, refreshMinimum };
}