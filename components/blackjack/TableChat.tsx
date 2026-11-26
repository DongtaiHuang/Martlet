"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Minus, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ReportButton } from "@/components/board/BoardControls";
import { sendTableChatAction, tableChatAction } from "@/app/play/blackjack/chat-actions";
import { CHAT_MAX, type TableChat as Chat } from "@/lib/blackjack-tables-types";

// Chat is opt-in per browser. The switch lives on the table; the window follows you across the
// blackjack pages (it's rendered by app/play/blackjack/layout.tsx, which stays mounted).
const PREF = "martlet-bj-chat";
const PREF_EVENT = "martlet:bj-chat-pref";
const SEAT_EVENT = "martlet:bj-seat";

function subscribe(onChange: () => void) {
  window.addEventListener(PREF_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(PREF_EVENT, onChange); window.removeEventListener("storage", onChange); };
}
function readPref() {
  try { return localStorage.getItem(PREF) === "on"; } catch { return false; }
}
export function useChatEnabled() {
  return useSyncExternalStore(subscribe, readPref, () => false);
}
export function setChatEnabled(on: boolean) {
  try { localStorage.setItem(PREF, on ? "on" : "off"); } catch { /* private mode: this page only */ }
  window.dispatchEvent(new Event(PREF_EVENT));
}
/** Call after sitting down or leaving, so the chat window looks again. */
export function announceSeatChange() {
  window.dispatchEvent(new Event(SEAT_EVENT));
}

/** The on/off switch shown at the table. */
export function ChatToggle() {
  const on = useChatEnabled();
  return (
    <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-white/90">
      <input type="checkbox" role="switch" checked={on} onChange={(e) => setChatEnabled(e.target.checked)} className="size-5 accent-amber-300" />
      Table chat
      <span className="font-normal text-white/75">Text the table while you play, from any blackjack page</span>
    </label>
  );
}

const time = (at: string) => new Date(at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * Floating chat for the table you're seated at (ADR 0041). Supabase Realtime tells us when a
 * message arrives; we then fetch the chat through bj_chat_recent (RLS limits Realtime to people
 * seated there). A 30 s poll covers dropped connections and keeps your seat while you're on
 * another blackjack page.
 */
export function TableChatDock() {
  const enabled = useChatEnabled();
  const pathname = usePathname();
  const [chat, setChat] = useState<Chat | null>(null);
  const [open, setOpenState] = useState(true);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const openRef = useRef(true);
  const seen = useRef<{ table: string | null; ids: Set<string> }>({ table: null, ids: new Set() });
  const listRef = useRef<HTMLOListElement>(null);

  const setOpen = (o: boolean) => { openRef.current = o; setOpenState(o); if (o) setUnread(0); };

  const take = useCallback((next: Chat | null) => {
    setChat(next);
    if (!next) return;
    const s = seen.current;
    const firstLook = s.table !== next.table_id;
    if (firstLook) { s.table = next.table_id; s.ids = new Set(); }
    const fresh = next.messages.filter((m) => !m.mine && !s.ids.has(m.id)).length;
    next.messages.forEach((m) => s.ids.add(m.id));
    if (!firstLook && fresh && !openRef.current) setUnread((u) => u + fresh);
  }, []);

  const load = useCallback(async () => take(await tableChatAction()), [take]);

  // Look again when chat is switched on, on every blackjack page, and after sitting or leaving.
  useEffect(() => {
    if (!enabled) return;
    const again = () => void load();
    const now = setTimeout(again, 0);
    window.addEventListener(SEAT_EVENT, again);
    const poll = setInterval(again, 30_000);
    return () => { clearTimeout(now); window.removeEventListener(SEAT_EVENT, again); clearInterval(poll); };
  }, [enabled, pathname, load]);

  const tableId = enabled ? chat?.table_id ?? null : null;
  useEffect(() => {
    if (!tableId) return;
    let supabase: ReturnType<typeof createClient>;
    try { supabase = createClient(); } catch { return; } // not configured: the poll still works
    const channel = supabase
      .channel(`bj-chat-${tableId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bj_chat_messages", filter: `table_id=eq.${tableId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [tableId, load]);

  const count = chat?.messages.length ?? 0;
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [count, open]);

  if (!enabled || !chat) return null;

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    start(async () => {
      const r = await sendTableChatAction(text);
      if (r.error) { setError(r.error); return; }
      setError("");
      setDraft("");
      take(r.chat ?? null);
    });
  };

  const anchor = "fixed right-3 bottom-20 z-40 sm:right-6 sm:bottom-6";
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${anchor} inline-flex min-h-12 items-center gap-2 rounded-full bg-emerald-800 px-4 font-bold text-white shadow-lg hover:bg-emerald-700 ${focus}`}>
        <MessageCircle aria-hidden="true" size={18} /> Chat
        {unread > 0 && <span className="rounded-full bg-amber-300 px-2 text-sm text-neutral-900">{unread}<span className="sr-only"> new</span></span>}
      </button>
    );
  }

  return (
    <section aria-label={`${chat.table_name} chat`} className={`${anchor} flex h-[min(26rem,60vh)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-2xl`}>
      <header className="flex items-center gap-1 bg-emerald-800 py-1 pr-1 pl-3 text-white">
        <h2 className="flex-1 truncate text-sm font-bold"><MessageCircle aria-hidden="true" size={15} className="mr-1.5 inline" />{chat.table_name} chat</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Minimize chat" className="grid size-10 place-items-center rounded-lg hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"><Minus aria-hidden="true" size={18} /></button>
        <button type="button" onClick={() => setChatEnabled(false)} aria-label="Turn chat off" className="grid size-10 place-items-center rounded-lg hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"><X aria-hidden="true" size={18} /></button>
      </header>
      <ol ref={listRef} role="log" aria-live="polite" className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {chat.messages.length === 0 && <li className="py-6 text-center text-ink-muted">No messages yet. Say hi to the table.</li>}
        {chat.messages.map((m) => (
          <li key={m.id} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
            <p className="text-xs text-ink-muted"><span className="font-semibold text-ink-2">{m.mine ? "You" : m.name}</span> · {time(m.at)}</p>
            <div className="flex max-w-full items-center gap-1">
              <p className={`rounded-2xl px-3 py-1.5 break-words ${m.mine ? "bg-emerald-700 text-white" : "bg-surface-muted"}`}>{m.body}</p>
              {!m.mine && <ReportButton type="table_chat" id={m.id} />}
            </div>
          </li>
        ))}
      </ol>
      <form onSubmit={send} className="border-t border-line p-2">
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="bj-chat-input">Message the table</label>
          <input id="bj-chat-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={CHAT_MAX} autoComplete="off" placeholder="Message the table"
            className={`min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 ${focus}`} />
          <button type="submit" disabled={pending || !draft.trim()} aria-label="Send" className={`grid size-11 place-items-center rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 ${focus}`}>
            <Send aria-hidden="true" size={18} />
          </button>
        </div>
        {error && <p role="alert" className="mt-1 text-xs font-semibold text-brand-ink">{error}</p>}
        <p className="mt-1 text-[11px] text-ink-muted">Only people at this table see it. Messages disappear after a day; reported ones are hidden.</p>
      </form>
    </section>
  );
}
