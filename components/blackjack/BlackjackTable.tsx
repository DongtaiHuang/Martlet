"use client";

import { useState, useTransition } from "react";
import { Coins } from "lucide-react";
import { dealAction, handAction, type BlackjackResponse } from "@/app/play/blackjack/actions";
import {
  cardInfo, MAX_BET, MIN_BET, practiceAction, practiceDeal, practiceView, RESULT_TEXT, shuffledDeck,
  type HandState, type PracticeHand,
} from "@/lib/blackjack-engine";

const CHIPS = [5, 10, 25, 50, 100];

function Card({ card }: { card: number | null }) {
  if (card === null) {
    return (
      <div role="img" aria-label="Face-down card" className="h-24 w-16 shrink-0 rounded-lg border-2 border-white/80 bg-brand bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgb(255_255_255/0.18)_6px_8px)] shadow-md sm:h-28 sm:w-20" />
    );
  }
  const c = cardInfo(card);
  const tone = c.red ? "text-red-700" : "text-neutral-900";
  return (
    <div role="img" aria-label={c.name} className={`relative h-24 w-16 shrink-0 rounded-lg border border-neutral-300 bg-white shadow-md sm:h-28 sm:w-20 ${tone}`}>
      <span aria-hidden="true" className="absolute top-1 left-1.5 text-sm leading-none font-bold sm:text-base">{c.rank}<br />{c.suit}</span>
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl">{c.suit}</span>
      <span aria-hidden="true" className="absolute right-1.5 bottom-1 rotate-180 text-sm leading-none font-bold sm:text-base">{c.rank}<br />{c.suit}</span>
    </div>
  );
}

function Hand({ label, cards, value, hidden }: { label: string; cards: number[]; value: number; hidden: boolean }) {
  return (
    <section aria-label={label}>
      <h2 className="text-sm font-bold text-white/90">{label} <span className="ml-1 rounded-full bg-black/25 px-2 py-0.5 tabular-nums">{hidden ? `${value} showing` : value}</span></h2>
      <ul className="mt-2 flex min-h-24 flex-wrap gap-2 sm:min-h-28">
        {cards.map((card, i) => <li key={`${card}-${i}`}><Card card={card} /></li>)}
        {hidden && <li><Card card={null} /></li>}
      </ul>
    </section>
  );
}

/** What changed, for screen readers: new cards and the result. */
function describe(prev: HandState | null, next: HandState): string {
  const name = (c: number) => cardInfo(c).name;
  if (!prev || prev.id !== next.id) {
    const start = `You have ${next.player.map(name).join(" and ")}, ${next.player_value}. Dealer shows ${name(next.dealer[0])}.`;
    return next.result ? `${start} Dealer has ${next.dealer.map(name).join(" and ")}. ${RESULT_TEXT[next.result]}.` : start;
  }
  const drawn = next.player.slice(prev.player.length);
  let text = drawn.length ? `You drew ${drawn.map(name).join(", ")}. You have ${next.player_value}.` : "";
  if (next.result) text += ` Dealer has ${next.dealer.map(name).join(", ")}, ${next.dealer_value}. ${RESULT_TEXT[next.result]}.`;
  return text.trim();
}

/**
 * The blackjack table (ADR 0034). With an account, the server deals and pays real Martlet points.
 * Without one (signed out or preview mode), it's a practice table with chips that aren't saved.
 */
export function BlackjackTable({ initial, balance: initialBalance, practice }: { initial: HandState | null; balance: number; practice: boolean }) {
  const [hand, setHand] = useState<HandState | null>(initial);
  const [balance, setBalance] = useState(initial?.balance ?? initialBalance);
  const [bet, setBet] = useState(10);
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<PracticeHand | null>(null);

  const apply = (next: HandState, prev: HandState | null) => {
    setHand(next);
    setBalance(next.balance);
    setAnnounce(describe(prev, next));
    setError("");
  };
  const run = (call: () => Promise<BlackjackResponse>) => start(async () => {
    const r = await call();
    if (r.error) { setError(r.error); setAnnounce(r.error); return; }
    if (r.hand) apply(r.hand, hand);
  });

  // Practice mode: same rules, local chips.
  const practiceDealHand = () => {
    if (bet > balance) { setError("Not enough practice chips."); return; }
    const h = practiceDeal(bet, shuffledDeck());
    const view = practiceView(h, crypto.randomUUID(), 0);
    setLocal(h);
    apply({ ...view, balance: balance - bet + view.payout }, hand);
  };
  const practicePlay = (action: "hit" | "stand" | "double") => {
    if (!local || !hand) return;
    if (action === "double" && balance < local.bet) { setError("Not enough practice chips to double."); return; }
    const spent = action === "double" ? local.bet : 0;
    const h = practiceAction(local, action);
    const view = practiceView(h, hand.id, balance - spent);
    setLocal(h);
    apply({ ...view, balance: balance - spent + view.payout }, hand);
  };

  const deal = () => (practice ? practiceDealHand() : run(() => dealAction(bet)));
  const play = (action: "hit" | "stand" | "double") => (practice ? practicePlay(action) : hand && run(() => handAction(hand.id, action)));

  const playing = hand?.status === "playing";
  const btn = "inline-flex min-h-12 flex-1 items-center justify-center rounded-xl px-4 text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 sm:flex-none sm:min-w-28";
  const net = hand?.result ? hand.payout - hand.bet : 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-emerald-950 bg-emerald-800 p-4 text-white shadow-lg sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1 font-bold">
          <Coins aria-hidden="true" size={16} className="text-amber-300" />
          <span className="tabular-nums">{balance.toLocaleString("en-CA")}</span> {practice ? "practice chips" : "points"}
        </p>
        <p className="text-white/80">Dealer stands on 17 · Blackjack pays 3:2</p>
      </div>

      <div className="mt-5 space-y-6">
        {hand ? (
          <>
            <Hand label="Dealer" cards={hand.dealer} value={hand.dealer_value} hidden={playing} />
            <Hand label="You" cards={hand.player} value={hand.player_value} hidden={false} />
          </>
        ) : (
          <p className="py-10 text-center text-white/85">Place a bet and deal to start.</p>
        )}
      </div>

      {hand?.result && (
        <p className="mt-5 rounded-xl bg-black/30 px-4 py-3 text-center text-lg font-extrabold">
          {RESULT_TEXT[hand.result]}
          <span className="ml-2 text-base font-semibold text-white/90">{net > 0 ? `+${net}` : net < 0 ? `−${-net}` : "±0"}{hand.doubled ? " (doubled)" : ""}</span>
        </p>
      )}

      <div className="mt-5">
        {playing ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => play("hit")} disabled={pending} className={`${btn} bg-white text-emerald-900 hover:bg-emerald-50`}>Hit</button>
            <button type="button" onClick={() => play("stand")} disabled={pending} className={`${btn} bg-amber-300 text-neutral-900 hover:bg-amber-200`}>Stand</button>
            {hand.can_double && (
              <button type="button" onClick={() => play("double")} disabled={pending || balance < hand.bet} className={`${btn} border-2 border-white/80 hover:bg-white/10`}>
                Double <span className="ml-1 text-sm font-semibold text-white/80">+{hand.bet}</span>
              </button>
            )}
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
            <button type="button" onClick={deal} disabled={pending || bet > balance || bet < MIN_BET || bet > MAX_BET} className={`${btn} w-full bg-amber-300 text-neutral-900 hover:bg-amber-200 sm:w-auto`}>
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
