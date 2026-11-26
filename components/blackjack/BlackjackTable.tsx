"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Coins, Split } from "lucide-react";
import { dealAction, handAction, type BlackjackResponse } from "@/app/play/blackjack/actions";
import { PlayingCard } from "./PlayingCard";
import {
  cardInfo, HAND_RESULT, handValue, MAX_BET, MIN_BET, practiceAction, practiceDeal, practiceView, RESULT_TEXT, shuffledDeck,
  type Action, type HandState, type PracticeHand, type Result,
} from "@/lib/blackjack-engine";

const CHIPS = [5, 10, 25, 50, 100];

/** How much of the hand is on the table so far. The server's answer arrives at once; the table
 *  plays it out card by card, flips the hole card, and lets the dealer draw one at a time. */
interface Shown { p: number; s: number; d: number; hole: boolean; result: boolean; dealerTurn: boolean }

const fullyShown = (h: HandState | null): Shown => ({
  p: h?.player.length ?? 0,
  s: h?.split_cards?.length ?? 0,
  d: h ? (h.status === "playing" ? 2 : h.dealer.length) : 0,
  hole: h?.status === "done",
  result: h?.status === "done",
  dealerTurn: false,
});

/** The balance counts up or down to its new value. */
export function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now(), duration = reduce ? 0 : 700;
    let frame = requestAnimationFrame(function tick(now) {
      const k = duration ? Math.min(1, (now - t0) / duration) : 1;
      const v = Math.round(start + (value - start) * (1 - (1 - k) ** 3));
      from.current = v;
      setShown(v);
      if (k < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className="tabular-nums">{shown.toLocaleString("en-CA")}</span>;
}

/** What happened, for screen readers, once the table has played it out. */
function describe(prev: HandState | null, next: HandState): string {
  const name = (c: number) => cardInfo(c).name;
  if (!prev || prev.id !== next.id) {
    const start = `You have ${next.player.map(name).join(" and ")}, ${next.player_value}. Dealer shows ${name(next.dealer[0])}.`;
    return next.result ? `${start} Dealer has ${next.dealer.map(name).join(" and ")}. ${RESULT_TEXT[next.result]}.` : start;
  }
  const second = next.split_cards ?? [];
  let text = "";
  if (next.split && !prev.split) {
    text = `You split. Hand 1 has ${next.player.map(name).join(" and ")}, ${next.player_value}. Hand 2 has ${second.map(name).join(" and ")}, ${next.split_value}.`;
  } else {
    const drawn1 = next.player.slice(prev.player.length), drawn2 = second.slice(prev.split_cards?.length ?? 0);
    if (drawn1.length) text += `You drew ${drawn1.map(name).join(", ")}. ${next.split ? "Hand 1 has" : "You have"} ${next.player_value}.`;
    if (drawn2.length) text += ` You drew ${drawn2.map(name).join(", ")}. Hand 2 has ${next.split_value}.`;
  }
  if (next.status === "playing" && next.active === 2 && prev.active !== 2) text += ` Now playing hand 2, ${next.split_value}.`;
  if (next.result) {
    text += ` Dealer has ${next.dealer.map(name).join(", ")}, ${next.dealer_value}.`;
    text += next.split && next.split_result
      ? ` Hand 1: ${HAND_RESULT[next.result]}. Hand 2: ${HAND_RESULT[next.split_result]}.`
      : ` ${RESULT_TEXT[next.result]}.`;
  }
  return text.trim();
}

/**
 * The blackjack table (ADR 0034). With an account, the server deals and pays real Martlet points.
 * Without one (signed out or preview mode), it's a practice table with chips that aren't saved.
 */
export function BlackjackTable({ initial, balance: initialBalance, practice }: { initial: HandState | null; balance: number; practice: boolean }) {
  const [hand, setHand] = useState<HandState | null>(initial);
  const [shown, setShownState] = useState<Shown>(() => fullyShown(initial));
  const shownRef = useRef(shown);
  const [balance, setBalance] = useState(initial?.balance ?? initialBalance);
  const [bet, setBet] = useState(10);
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");
  const [animating, setAnimating] = useState(false);
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<PracticeHand | null>(null);
  const run = useRef(0);

  const setShown = (s: Shown) => { shownRef.current = s; setShownState(s); };

  /** Plays the server's answer out on the table. A newer answer cancels an older run. */
  async function animate(prev: HandState | null, next: HandState) {
    const me = ++run.current;
    const fast = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = (ms: number) => new Promise<boolean>((r) => setTimeout(() => r(run.current === me), fast ? 0 : ms));
    const fresh = !prev || prev.id !== next.id;
    let s: Shown = fresh ? { p: 0, s: 0, d: 0, hole: false, result: false, dealerTurn: false } : { ...shownRef.current, result: false };
    const push = (patch: Partial<Shown>) => { s = { ...s, ...patch }; setShown(s); };

    setAnimating(true);
    setError("");
    setHand(next);
    setShown(s);
    // Bets come off now; winnings land with the result.
    setBalance(next.balance - next.payout);

    if (fresh) {
      for (const who of ["p", "d", "p", "d"] as const) {
        if (!(await wait(s.p + s.d === 0 ? 80 : 360))) return;
        push(who === "p" ? { p: s.p + 1 } : { d: s.d + 1 });
      }
    }
    // A split pulls the pair apart first; then each hand gets its second card.
    if (!fresh && next.split && !prev?.split) {
      push({ p: 1, s: 1 });
      if (!(await wait(450))) return;
    }
    while (s.p < next.player.length) {
      if (!(await wait(420))) return;
      push({ p: s.p + 1 });
    }
    while (s.s < (next.split_cards?.length ?? 0)) {
      if (!(await wait(420))) return;
      push({ s: s.s + 1 });
    }

    if (next.status === "done") {
      const bust = next.result === "bust";
      if (!(await wait(bust ? 450 : 600))) return;
      push({ dealerTurn: !bust });
      if (!(await wait(bust ? 150 : 500))) return;
      push({ hole: true }); // the flip
      if (!(await wait(750))) return;
      // The dealer draws one at a time, slower as the total creeps toward 17.
      while (s.d < next.dealer.length) {
        const v = handValue(next.dealer.slice(0, s.d));
        if (!(await wait(v >= 14 ? 1150 : v >= 11 ? 900 : 700))) return;
        push({ d: s.d + 1 });
      }
      if (!(await wait(s.d > 2 ? 650 : 350))) return;
      push({ dealerTurn: false, result: true });
      setBalance(next.balance);
    }
    setAnnounce(describe(prev, next));
    setAnimating(false);
  }

  const call = (fn: () => Promise<BlackjackResponse>) => start(async () => {
    const r = await fn();
    if (r.error) { setError(r.error); setAnnounce(r.error); return; }
    if (r.hand) void animate(hand, r.hand);
  });

  // Practice mode: same rules, local chips.
  const practiceDealHand = () => {
    if (bet > balance) { setError("Not enough practice chips."); return; }
    const h = practiceDeal(bet, shuffledDeck());
    const view = practiceView(h, crypto.randomUUID(), 0);
    setLocal(h);
    void animate(hand, { ...view, balance: balance - bet + view.payout });
  };
  const practicePlay = (action: Action) => {
    if (!local || !hand) return;
    const spent = action === "double" ? (local.active === 2 ? local.splitBet : local.bet) : action === "split" ? local.bet : 0;
    if (spent > balance) { setError(`Not enough practice chips to ${action}.`); return; }
    const h = practiceAction(local, action);
    const view = practiceView(h, hand.id, 0);
    setLocal(h);
    void animate(hand, { ...view, balance: balance - spent + view.payout });
  };

  const deal = () => (practice ? practiceDealHand() : call(() => dealAction(bet)));
  const play = (action: Action) => (practice ? practicePlay(action) : hand && call(() => handAction(hand.id, action)));

  const busy = pending || animating;
  const playing = hand?.status === "playing";
  const btn = "inline-flex min-h-12 flex-1 items-center justify-center rounded-xl px-4 text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 sm:flex-none sm:min-w-28";
  const net = hand?.result ? hand.payout - hand.total_bet : 0;
  const activeBet = hand?.active === 2 ? hand.split_bet : hand?.bet ?? 0;

  const playerCards = hand ? hand.player.slice(0, shown.p) : [];
  const splitCards = hand?.split_cards ? hand.split_cards.slice(0, shown.s) : [];
  const dealerSlots = hand ? Array.from({ length: shown.d }, (_, i) => hand.dealer[i] ?? null) : [];
  const dealerUp = dealerSlots.filter((c, i) => c !== null && (i !== 1 || shown.hole)) as number[];
  const dealerValue = handValue(dealerUp);
  const result = shown.result ? hand?.result ?? null : null;
  const splitResult = shown.result ? hand?.split_result ?? null : null;
  const good = hand?.split ? net > 0 : result === "win" || result === "blackjack";
  const hands: { label: string; cards: number[]; result: Result | null; bet: number; doubled: boolean; active: boolean }[] = hand?.split
    ? [
        { label: "Hand 1", cards: playerCards, result, bet: hand.bet, doubled: hand.doubled, active: playing && hand.active === 1 },
        { label: "Hand 2", cards: splitCards, result: splitResult, bet: hand.split_bet, doubled: hand.split_doubled, active: playing && hand.active === 2 },
      ]
    : [{ label: "You", cards: playerCards, result, bet: hand?.bet ?? 0, doubled: false, active: false }];

  return (
    <div className="overflow-hidden rounded-3xl border border-emerald-950 bg-emerald-800 p-4 text-white shadow-lg sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1 font-bold">
          <Coins aria-hidden="true" size={16} className="text-amber-300" />
          <AnimatedNumber value={balance} /> {practice ? "practice chips" : "points"}
        </p>
        <p className="text-white/80">Dealer stands on 17 · Blackjack pays 3:2</p>
      </div>

      <div className="mt-5 space-y-6">
        {hand ? (
          <>
            <section aria-label="Dealer">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white/90">
                Dealer
                {dealerSlots.length > 0 && (
                  <span key={`${dealerValue}-${shown.hole}`} className="bj-land rounded-full bg-black/25 px-2 py-0.5 tabular-nums">
                    {shown.hole ? dealerValue : `${dealerValue} showing`}
                  </span>
                )}
                {shown.dealerTurn && (
                  <span className="text-xs font-semibold text-amber-200" aria-hidden="true">
                    {shown.hole ? "drawing" : "revealing"}<span className="bj-dot">.</span><span className="bj-dot [animation-delay:150ms]">.</span><span className="bj-dot [animation-delay:300ms]">.</span>
                  </span>
                )}
              </h2>
              <ul className="mt-2 flex min-h-24 flex-wrap gap-2 sm:min-h-28">
                {dealerSlots.map((card, i) => <li key={`d${i}`}><PlayingCard card={card} down={i === 1 && !shown.hole} from="dealer" /></li>)}
              </ul>
            </section>
            <div className={hand.split ? "grid gap-4 sm:grid-cols-2" : undefined}>
              {hands.map((h, n) => {
                const value = handValue(h.cards);
                return (
                  <section key={h.label} aria-label={h.label} aria-current={h.active ? "true" : undefined}
                    className={`${h.result === "bust" ? "bj-shake" : ""} ${hand.split ? `rounded-2xl p-2 transition ${h.active ? "bg-black/25 ring-2 ring-amber-300" : ""}` : ""}`}>
                    <h2 className="flex flex-wrap items-center gap-1 text-sm font-bold text-white/90">
                      {h.label}
                      {h.cards.length > 0 && <span key={value} className={`bj-land ml-1 inline-block rounded-full px-2 py-0.5 tabular-nums ${value > 21 ? "bg-red-900/70" : "bg-black/25"}`}>{value}</span>}
                      {hand.split && <span className="ml-1 text-xs font-semibold text-white/75">Bet {h.bet}{h.doubled ? " (doubled)" : ""}</span>}
                      {hand.split && h.result && <span className="bj-land ml-auto rounded-full bg-black/30 px-2 py-0.5 text-xs">{HAND_RESULT[h.result]}</span>}
                    </h2>
                    <ul className={`mt-2 flex min-h-24 flex-wrap gap-2 transition-opacity duration-500 sm:min-h-28 ${h.result === "lose" || h.result === "bust" ? "opacity-70" : ""}`}>
                      {h.cards.map((card, i) => <li key={`${n}-${i}`}><PlayingCard card={card} down={false} from="player" /></li>)}
                    </ul>
                  </section>
                );
              })}
            </div>
          </>
        ) : (
          <p className="py-10 text-center text-white/85">Place a bet and deal to start.</p>
        )}
      </div>

      {result && (
        <p className={`bj-land mt-5 rounded-xl px-4 py-3 text-center text-lg font-extrabold ${good ? "bj-glow bg-amber-300 text-neutral-900" : "bg-black/30"}`}>
          {hand?.split && splitResult ? `Hand 1: ${HAND_RESULT[result]} · Hand 2: ${HAND_RESULT[splitResult]}` : RESULT_TEXT[result]}
          <span className={`ml-2 text-base font-semibold ${good ? "text-neutral-800" : "text-white/90"}`}>{net > 0 ? `+${net}` : net < 0 ? `−${-net}` : "±0"}{!hand?.split && hand?.doubled ? " (doubled)" : ""}</span>
        </p>
      )}

      <div className="mt-5 min-h-12">
        {animating ? (
          <p className="flex min-h-12 items-center text-sm font-semibold text-white/80" aria-hidden="true">
            {shown.dealerTurn ? "Dealer’s turn…" : hand?.status === "done" && !shown.result ? "…" : "Dealing…"}
          </p>
        ) : playing ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => play("hit")} disabled={busy} className={`${btn} bg-white text-emerald-900 hover:bg-emerald-50`}>Hit</button>
            <button type="button" onClick={() => play("stand")} disabled={busy} className={`${btn} bg-amber-300 text-neutral-900 hover:bg-amber-200`}>Stand</button>
            {hand.can_double && (
              <button type="button" onClick={() => play("double")} disabled={busy || balance < activeBet} className={`${btn} border-2 border-white/80 hover:bg-white/10`}>
                Double <span className="ml-1 text-sm font-semibold text-white/80">+{activeBet}</span>
              </button>
            )}
            {hand.can_split && (
              <button type="button" onClick={() => play("split")} disabled={busy || balance < hand.bet} className={`${btn} border-2 border-white/80 hover:bg-white/10`}>
                <Split aria-hidden="true" size={17} className="mr-1.5" />Split <span className="ml-1 text-sm font-semibold text-white/80">+{hand.bet}</span>
              </button>
            )}
            {hand.split && <p className="w-full text-sm font-semibold text-amber-200">Playing hand {hand.active}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <fieldset>
              <legend className="text-sm font-bold">Bet</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {CHIPS.map((c) => (
                  <label key={c} className={`inline-flex size-12 cursor-pointer items-center justify-center rounded-full border-4 border-dashed text-sm font-extrabold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-white ${bet === c ? "border-amber-200 bg-amber-300 text-neutral-900" : "border-white/60 bg-black/20 text-white hover:bg-black/30"} ${c > balance ? "opacity-40" : ""}`}>
                    <input type="radio" name="bet" value={c} checked={bet === c} onChange={() => setBet(c)} disabled={c > balance} className="sr-only" />{c}
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="button" onClick={deal} disabled={busy || bet > balance || bet < MIN_BET || bet > MAX_BET} className={`${btn} w-full bg-amber-300 text-neutral-900 hover:bg-amber-200 sm:w-auto`}>
              {pending ? "Dealing…" : `Deal · ${bet}`}
            </button>
          </div>
        )}
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg bg-black/30 px-3 py-2 text-sm font-semibold">{error}</p>}
      <p role="status" className="sr-only">{announce}</p>
    </div>
  );
}
