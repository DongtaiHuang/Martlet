"use client";

import { Heart } from "lucide-react";
import { flap, unflap } from "@/lib/social";
import { ReactionButton, type ReactionButtonProps } from "./ReactionButton";

/** Like/unlike a meetup. `count` is flap_count. */
export function FlapButton(props: ReactionButtonProps) {
  return <ReactionButton {...props} label="Flap" activeLabel="Flapped" noun={(n) => (n === 1 ? "flap" : "flaps")} icon={Heart} on={flap} off={unflap} />;
}
