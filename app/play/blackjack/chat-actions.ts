"use server";

import { getTableChat, sendTableChat, TableError, type TableChat } from "@/lib/blackjack-tables";
import { CHAT_MAX } from "@/lib/blackjack-tables-types";
import { AuthRequiredError } from "@/lib/supabase/auth";

/** The chat at the table you're seated at, or null. */
export async function tableChatAction(): Promise<TableChat | null> {
  try { return await getTableChat(); } catch (error) { console.error("Table chat failed", error); return null; }
}

export async function sendTableChatAction(body: string): Promise<{ chat?: TableChat | null; error?: string }> {
  const text = typeof body === "string" ? body.trim() : "";
  if (!text || text.length > CHAT_MAX) return { error: `Messages are 1 to ${CHAT_MAX} characters.` };
  try {
    await sendTableChat(text);
    return { chat: await getTableChat() };
  } catch (error) {
    if (error instanceof TableError) return { error: error.message };
    if (error instanceof AuthRequiredError) return { error: "Sign in to chat." };
    console.error("Table chat send failed", error);
    return { error: "Couldn't send that. Try again." };
  }
}
