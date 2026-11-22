"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function FooterVisibility({ children }: { children: ReactNode }) {
  const segment = usePathname().split("/")[1];
  return ["login", "signup", "auth", "play"].includes(segment) ? null : children;
}
