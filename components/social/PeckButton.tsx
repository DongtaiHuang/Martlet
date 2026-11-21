"use client";

import { UsersRound } from "lucide-react";
import { peck, unpeck } from "@/lib/social";
import { ReactionButton, type ReactionButtonProps } from "./ReactionButton";

/** Join/leave a meetup. `count` is attendee_count (host included). Disable for the host. */
export function PeckButton(props: ReactionButtonProps) {
  return <ReactionButton {...props} label="Peck to join" activeLabel="Going" noun={() => "going"} icon={UsersRound} on={peck} off={unpeck} />;
}
