"use server";

import { revalidatePath } from "next/cache";
import { markNotificationsRead } from "@/lib/notifications";

export async function markAllRead(): Promise<void> {
  await markNotificationsRead();
  revalidatePath("/notifications");
}
