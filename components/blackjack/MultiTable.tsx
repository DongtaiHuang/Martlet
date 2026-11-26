"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { earn } from "@/components/achievements/earn";
import { FELT_CLASS, PixelChip, PixelCoin, RoomWall, feltStyleFor } from "./PixelTable";
import { useRouter } from "next/navigation";
import { LogOut, Radio, Split, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { HAND_RESULT, handValue, isPair, RESULT_TEXT, type Action } from "@/lib/blackjack-engine";
import { SEATS, type TableSeat, type TableState } from "@/lib/blackjack-tables-types";
import { actTableAction, betTableAction, joinTableAction, leaveTableAction, syncTableAction, type TableResponse } from "@/app/play/blackjack/tables/actions";
import { PlayingCard } from "./PlayingCard";
import { AnimatedNumber } from "./BlackjackTable";
import { announceSeatChange, ChatToggle } from "./TableChat";

/** Points won or lost this round, across both hands after a split. */
const seatNet = (s: TableSeat) => s.payout - s.bet - s.split_bet;

const CHIPS = [5, 10, 25, 50, 100];
const btn = "inline-flex min-h-12 flex-1 items-center justify-center rounded-xl px-4 text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 sm:flex-none sm:min-w-28";

/** Our clock against the server's `now` (called from events and effects, never during render). */
function clockFrom(serverNow: string) {
  const now = Date.now();
  return { offset: Date.parse(serverNow) - now, now };
}

/** After a round ends, the dealer's hand plays out one card at a time before results show. */
interface Reveal { dealer: number; holeDown: boolean; results: boolean }
const settled = (s: TableState): Reveal => ({ dealer: s.dealer.length, holeDown: false, results: true });

function SeatView({ seat, n, active, secondsLeft, showResult }: { seat: TableSeat | undefined; n: number; active: boolean; secondsLeft: number | null; showResult: boolean }) {
  if (!seat) {
    return (
      <li className="flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 border-dashed sm:min-h-40 border-white/25 p-2 text-xs text-white/60">
        <UserRound aria-hidden="true" size={18} /> Seat {n}<span className="sr-only">, empty</span>
      </li>
    );
  }
  const result = showResult ? seat.result : null;
  const net = result ? seatNet(seat) : 0;
  const split = seat.split_cards !== null;
  const status =
    result ? `${split ? "Total" : RESULT_TEXT[result]} ${net > 0 ? `+${net}` : net < 0 ? `−${-net}` : "±0"}`
    : active ? `Thinking${secondsLeft !== null ? ` · ${secondsLeft}s` : ""}`
    : { seated: "No bet yet", bet: "Bet placed", playing: "Waiting", stood: "Stands", bust: "Bust", blackjack: "Blackjack!", out: "Sitting out" }[seat.status];
  const good = split ? net > 0 : result === "win" || result === "blackjack";
  const hands = split
    ? [
        { n: 1, cards: seat.cards, value: seat.value, result: showResult ? seat.result : null, current: active && seat.active === 1 },
        { n: 2, cards: seat.split_cards ?? [], value: seat.split_value, result: showResult ? seat.split_result : null, current: active && seat.active === 2 },
      ]
    : null;
  return (
    <li
      aria-current={active ? "true" : undefined}
      className={`relative flex flex-col rounded-2xl p-2 transition ${seat.cards.length ? "min-h-40" : "min-h-16 sm:min-h-40"} ${active ? "bg-black/30 ring-2 ring-amber-300" : "bg-black/15"} ${seat.me ? "outline-2 outline-offset-2 outline-white/70" : ""} ${result === "bust" ? "bj-shake" : ""}`}
    >
      <p className="truncate text-xs font-bold">{seat.me ? "You" : seat.name}<span className="sr-only">, seat {n}</span></p>
      <p className="text-[11px] text-white/75">{seat.bet > 0 ? (split ? `Bets ${seat.bet} + ${seat.split_bet}` : `Bet ${seat.bet}${seat.doubled ? " (doubled)" : ""}`) : " "}</p>
      {hands ? (
        hands.map((h) => (
          <div key={h.n} className={`mt-1 rounded-lg p-0.5 ${h.current ? "ring-2 ring-amber-300" : ""}`}>
            <p className="flex items-center gap-1 text-[11px] font-semibold text-white/85">
              Hand {h.n}<span className="rounded-full bg-black/30 px-1.5 tabular-nums">{h.value}</span>{h.result && <span>{HAND_RESULT[h.result]}</span>}
            </p>
            <ul className="mt-0.5 flex flex-wrap gap-1" aria-label={`${seat.me ? "Your" : `${seat.name}'s`} hand ${h.n}`}>
              {h.cards.map((c, i) => <li key={i}><PlayingCard card={c} size="sm" from="player" /></li>)}
            </ul>
          </div>
        ))
      ) : (
        <ul className="mt-1 flex flex-wrap gap-1" aria-label={`${seat.me ? "Your" : `${seat.name}'s`} cards`}>
          {seat.cards.map((c, i) => <li key={i}><PlayingCard card={c} size="sm" from="player" /></li>)}
        </ul>
      )}
      <div className="mt-auto pt-1.5 text-[11px] font-semibold">
        {seat.cards.length > 0 && !split && <span key={seat.value} className="bj-land mr-1 inline-block rounded-full bg-black/30 px-1.5 tabular-nums">{seat.value}</span>}
        <span key={status} className={`bj-land inline-block rounded-full px-1.5 ${good ? "bj-glow bg-amber-300 text-neutral-900" : active ? "text-amber-200" : "text-white/85"}`}>{status}</span>
      </div>
      {active && secondsLeft !== null && (
        <div aria-hidden="true" className="absolute inset-x-2 bottom-1 h-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-amber-300 transition-[width] duration-300 ease-linear" style={{ width: `${Math.max(0, Math.min(100, (secondsLeft / 20) * 100))}%` }} />
        </div>
      )}
    </li>
  );
}

/**
 * A shared blackjack table (issue #146, ADR 0035). Supabase Realtime tells us when the table
 * changes; we then fetch what we may see through bj_sync. We also sync when a visible deadline
 * runs out (that's what moves a table on when someone walks away) and every 20 s as a heartbeat.
 */
export function MultiTable({ initial }: { initial: TableState }) {
  const router = useRouter();
  const [table, setTable] = useState(initial);
  const tableRef = useRef(initial);
  const [reveal, setRevealState] = useState<Reveal>(() => settled(initial));
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");
  const [live, setLive] = useState(false);
  const [bet, setBet] = useState(10);
  const [pending, start] = useTransition();
  // Starts at the server's time; the real offset is measured after mount.
  const [clock, setClock] = useState({ offset: 0, now: Date.parse(initial.now) });
  const revealRun = useRef(0);
  const syncing = useRef(false);
  const again = useRef(false);
  const syncedDeadline = useRef<string | null>(null);
  const offsetRef = useRef(0); // server clock minus ours
  const liveRef = useRef(false);

  /** Takes the newest table state; when a round just ended, plays the dealer's hand out. */
  function apply(next: TableState) {
    const prev = tableRef.current;
    if (next.version < prev.version) return;
    tableRef.current = next;
    setTable(next);
    const c = clockFrom(next.now);
    offsetRef.current = c.offset;
    setClock(c);
    const me = next.seats.find((s) => s.me);
    const roundEnded = prev.dealer_hidden && !next.dealer_hidden && next.round === prev.round;
    if (roundEnded) void playOutDealer(next);
    else { revealRun.current++; setRevealState(settled(next)); }
    const before = prev.seats.find((s) => s.me);
    if (me && next.turn_seat === me.seat && prev.turn_seat !== me.seat) setAnnounce(`Your turn. You have ${me.value}.`);
    else if (me?.split_cards && me.status === "playing" && me.active === 2 && before?.active !== 2) setAnnounce(`Now playing hand 2, ${me.split_value}.`);
  }

  async function playOutDealer(next: TableState) {
    const run = ++revealRun.current;
    const fast = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = (ms: number) => new Promise<boolean>((r) => setTimeout(() => r(revealRun.current === run), fast ? 0 : ms));
    let r: Reveal = { dealer: 2, holeDown: true, results: false };
    setRevealState(r);
    if (!(await wait(700))) return;
    r = { ...r, holeDown: false }; setRevealState(r);
    if (!(await wait(800))) return;
    while (r.dealer < next.dealer.length) {
      if (!(await wait(r.dealer >= 3 ? 1000 : 800))) return;
      r = { ...r, dealer: r.dealer + 1 }; setRevealState(r);
    }
    if (!(await wait(500))) return;
    setRevealState({ ...r, results: true });
    const me = next.seats.find((s) => s.me);
    const mine = !me?.result ? ""
      : me.split_result ? ` Hand 1: ${HAND_RESULT[me.result]}. Hand 2: ${HAND_RESULT[me.split_result]}.`
      : ` ${RESULT_TEXT[me.result]}.`;
    setAnnounce(`Dealer has ${next.dealer_value}.${mine}${me?.result && seatNet(me) > 0 ? ` Plus ${seatNet(me)}.` : ""}`);
    if (me?.result === "blackjack") void earn("natural");
  }

  /** One sync at a time; a change that arrives mid-sync queues one more. */
  async function refresh() {
    if (syncing.current) { again.current = true; return; }
    syncing.current = true;
    try {
      do {
        again.current = false;
        const r = await syncTableAction(tableRef.current.id);
        if (r.state) apply(r.state);
      } while (again.current);
    } finally {
      syncing.current = false;
    }
  }

  const act = (fn: () => Promise<TableResponse>) => start(async () => {
    const r = await fn();
    if (r.error) { setError(r.error); setAnnounce(r.error); return; }
    setError("");
    if (r.state) apply(r.state);
  });
  const play = (action: Action) => act(() => actTableAction(table.id, action));

  // Realtime: bj_tables changes → refetch. Falls back to polling while not connected.
  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try { supabase = createClient(); } catch { return; } // not configured: the poll below still works
    const channel = supabase
      .channel(`bj-table-${initial.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bj_tables", filter: `id=eq.${initial.id}` }, (payload) => {
        const version = Number((payload.new as { version?: number }).version ?? 0);
        if (version > tableRef.current.version) void refresh();
      })
      .subscribe((status) => { liveRef.current = status === "SUBSCRIBED"; setLive(liveRef.current); });
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one subscription per table
  }, [initial.id]);

  // Clock for countdowns; sync when a deadline passes, as a heartbeat, or as a fallback poll.
  useEffect(() => {
    offsetRef.current = clockFrom(initial.now).offset;
    let lastBeat = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      setClock((c) => ({ ...c, now }));
      const t = tableRef.current;
      const deadline = t.deadline ? Date.parse(t.deadline) : null;
      if (deadline !== null && now + offsetRef.current > deadline + 300 && syncedDeadline.current !== t.deadline) {
        syncedDeadline.current = t.deadline;
        lastBeat = now;
        void refresh();
      } else if (now - lastBeat > (liveRef.current ? 20_000 : 3_000)) {
        lastBeat = now;
        void refresh();
      }
    }, 250);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads refs only
  }, []);

  const mySeat = table.seats.find((s) => s.me) ?? null;
  const bySeat = new Map(table.seats.map((s) => [s.seat, s]));
  const serverNow = clock.now + clock.offset;
  const secondsLeft = table.deadline ? Math.max(0, Math.ceil((Date.parse(table.deadline) - serverNow) / 1000)) : null;
  const myTurn = table.phase === "playing" && mySeat !== null && table.turn_seat === mySeat.seat && mySeat.status === "playing";
  const onTwo = mySeat?.active === 2 && mySeat.split_cards !== null;
  const activeCards = (onTwo ? mySeat?.split_cards : mySeat?.cards) ?? [];
  const activeBet = (onTwo ? mySeat?.split_bet : mySeat?.bet) ?? 0;
  const canDouble = activeCards.length === 2 && !(onTwo ? mySeat?.split_doubled : mySeat?.doubled);
  const canSplit = mySeat !== null && mySeat.split_cards === null && isPair(mySeat.cards);
  const canBet = mySeat !== null && table.phase !== "playing" && mySeat.status !== "bet" && reveal.results;
  const turnName = table.turn_seat !== null ? (bySeat.get(table.turn_seat)?.me ? "you" : bySeat.get(table.turn_seat)?.name) : null;
  const balance = (table.balance ?? 0) - (!reveal.results && mySeat ? mySeat.payout : 0);

  const dealerCards: (number | null)[] = table.dealer_hidden
    ? [table.dealer[0] ?? null, null]
    : table.dealer.slice(0, reveal.dealer);
  const dealerTotal = table.dealer_hidden ? `${table.dealer_value} showing`
    : reveal.holeDown ? "…"
    : String(handValue(table.dealer.slice(0, reveal.dealer)));

  return (
    <div className={FELT_CLASS} style={feltStyleFor(table.id)}>
      <RoomWall tableId={table.id} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1 font-bold">
          <PixelCoin /><AnimatedNumber value={balance} /> points
        </p>
        <p className={`inline-flex items-center gap-1.5 text-xs font-semibold ${live ? "text-emerald-200" : "text-amber-200"}`}>
          <Radio aria-hidden="true" size={14} /> {live ? "Live" : "Connecting…"}
        </p>
      </div>

      <section aria-label="Dealer" className="mt-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white/90">
          Dealer
          {dealerCards.length > 0 && <span key={dealerTotal} className="bj-land rounded-full bg-black/25 px-2 py-0.5 tabular-nums">{dealerTotal}</span>}
          {!reveal.results && !table.dealer_hidden && <span aria-hidden="true" className="text-xs font-semibold text-amber-200">drawing<span className="bj-dot">.</span><span className="bj-dot [animation-delay:150ms]">.</span><span className="bj-dot [animation-delay:300ms]">.</span></span>}
        </h2>
        <ul className="mt-2 flex min-h-24 flex-wrap gap-2 sm:min-h-28">
          {dealerCards.map((c, i) => <li key={`d${i}`}><PlayingCard card={c} down={c === null || (i === 1 && reveal.holeDown)} /></li>)}
          {dealerCards.length === 0 && <li className="self-center text-sm text-white/75">{table.phase === "betting" ? `Betting closes in ${secondsLeft ?? 0}s` : "Waiting for the first bet"}</li>}
        </ul>
      </section>

      <ol aria-label="Seats" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Array.from({ length: SEATS }, (_, i) => i + 1).map((n) => (
          <SeatView key={n} n={n} seat={bySeat.get(n)} active={table.phase === "playing" && table.turn_seat === n} secondsLeft={table.turn_seat === n ? secondsLeft : null} showResult={reveal.results} />
        ))}
      </ol>

      <div className="mt-5 min-h-12">
        {!mySeat ? (
          <button type="button" onClick={() => act(async () => { const r = await joinTableAction(table.id); announceSeatChange(); return r; })} disabled={pending || table.seats.length >= SEATS} className={`${btn} w-full bg-amber-300 text-neutral-900 hover:bg-amber-200 sm:w-auto`}>
            {table.seats.length >= SEATS ? "Table full" : "Sit down"}
          </button>
        ) : myTurn ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => play("hit")} disabled={pending} className={`${btn} bg-white text-emerald-900 hover:bg-emerald-50`}>Hit</button>
            <button type="button" onClick={() => play("stand")} disabled={pending} className={`${btn} bg-amber-300 text-neutral-900 hover:bg-amber-200`}>Stand</button>
            {canDouble && (
              <button type="button" onClick={() => play("double")} disabled={pending || balance < activeBet} className={`${btn} border-2 border-white/80 hover:bg-white/10`}>
                Double <span className="ml-1 text-sm font-semibold text-white/80">+{activeBet}</span>
              </button>
            )}
            {canSplit && (
              <button type="button" onClick={() => play("split")} disabled={pending || balance < mySeat.bet} className={`${btn} border-2 border-white/80 hover:bg-white/10`}>
                <Split aria-hidden="true" size={17} className="mr-1.5" />Split <span className="ml-1 text-sm font-semibold text-white/80">+{mySeat.bet}</span>
              </button>
            )}
            <p className="w-full text-sm font-semibold text-amber-200 sm:ml-2 sm:w-auto">Your turn{mySeat.split_cards ? ` · hand ${mySeat.active}` : ""} · {secondsLeft ?? 0}s</p>
          </div>
        ) : canBet ? (
          <div className="space-y-3">
            <fieldset>
              <legend className="text-sm font-bold">{table.phase === "betting" ? `Bet for this hand · ${secondsLeft ?? 0}s left` : "Bet to start the next hand"}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {CHIPS.map((c) => (
                  <PixelChip key={c} value={c} selected={bet === c} disabled={c > balance}>
                    <input type="radio" name="bet" value={c} checked={bet === c} onChange={() => setBet(c)} disabled={c > balance} className="sr-only" />{c}
                  </PixelChip>
                ))}
              </div>
            </fieldset>
            <button type="button" onClick={() => act(() => betTableAction(table.id, bet))} disabled={pending || bet > balance} className={`${btn} w-full bg-amber-300 text-neutral-900 hover:bg-amber-200 sm:w-auto`}>Bet {bet}</button>
          </div>
        ) : (
          <p className="flex min-h-12 items-center text-sm font-semibold text-white/85">
            {!reveal.results ? "Dealer’s turn…"
              : table.phase === "betting" ? `Waiting for other bets · dealing in ${secondsLeft ?? 0}s`
              : table.phase === "playing" ? (mySeat.status === "out" ? `You’re sitting this hand out. Waiting for ${turnName ?? "the dealer"}…` : `Waiting for ${turnName ?? "the dealer"}${secondsLeft !== null ? ` · ${secondsLeft}s` : ""}…`)
              : "…"}
          </p>
        )}
      </div>

      {mySeat && <ChatToggle />}
      {mySeat && (
        <button
          type="button"
          onClick={() => act(async () => { const r = await leaveTableAction(table.id); announceSeatChange(); if (!r.error) router.push("/play/blackjack/tables"); return r; })}
          disabled={pending || mySeat.status === "playing"}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-white/80 hover:text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-white"
        >
          <LogOut aria-hidden="true" size={15} /> Leave table
        </button>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg bg-black/30 px-3 py-2 text-sm font-semibold">{error}</p>}
      <p role="status" className="sr-only">{announce}</p>
    </div>
  );
}
