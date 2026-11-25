// Blackjack rules (ADR 0034), shared by the table UI and preview-mode practice. Pure functions.
// The database (migration 019) deals and pays real hands; this mirrors its rules exactly:
// one deck, dealer stands on all 17s, dealer peeks for blackjack, blackjack pays 3:2 (rounded
// down), double on the first two cards, no splits or insurance.
// Cards are 0–51: rank = card % 13 (0 = ace, 1–8 = 2–9, 9 = 10, 10–12 = J Q K), suit = card / 13.

export type Result = "blackjack" | "win" | "push" | "lose" | "bust";
export interface HandState {
  id: string; bet: number; status: "playing" | "done"; result: Result | null; payout: number; doubled: boolean;
  player: number[]; player_value: number;
  /** While playing, only the dealer's up card. */
  dealer: number[]; dealer_value: number;
  can_double: boolean; balance: number;
}

export const MIN_BET = 1;
export const MAX_BET = 100;

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
const RANK_NAMES = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King"] as const;
const SUITS = [
  { symbol: "♠", name: "spades", red: false },
  { symbol: "♥", name: "hearts", red: true },
  { symbol: "♦", name: "diamonds", red: true },
  { symbol: "♣", name: "clubs", red: false },
] as const;

export function cardInfo(card: number) {
  const rank = card % 13, suit = SUITS[Math.floor(card / 13) % 4];
  return { rank: RANKS[rank], suit: suit.symbol, red: suit.red, name: `${RANK_NAMES[rank]} of ${suit.name}` };
}

/** Best total: aces count 11 unless that busts. */
export function handValue(cards: readonly number[]): number {
  let total = 0, aces = 0;
  for (const c of cards) {
    const r = c % 13;
    if (r === 0) { total += 11; aces++; } else total += r <= 8 ? r + 1 : 10;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

/** True when an ace still counts as 11 ("soft 17"). */
export function isSoft(cards: readonly number[]): boolean {
  const hard = cards.reduce((t, c) => t + (c % 13 === 0 ? 1 : c % 13 <= 8 ? (c % 13) + 1 : 10), 0);
  return cards.some((c) => c % 13 === 0) && hard + 10 <= 21;
}

export const isBlackjack = (cards: readonly number[]) => cards.length === 2 && handValue(cards) === 21;

export function payoutFor(result: Result, bet: number): number {
  return result === "blackjack" ? Math.floor(bet * 2.5) : result === "win" ? bet * 2 : result === "push" ? bet : 0;
}

export const RESULT_TEXT: Record<Result, string> = {
  blackjack: "Blackjack!", win: "You win", push: "Push", lose: "Dealer wins", bust: "Bust",
};

// Practice engine (preview mode, no points at stake) ------------------------------------------
export interface PracticeHand { deck: number[]; player: number[]; dealer: number[]; bet: number; doubled: boolean; result: Result | null }

export function shuffledDeck(random: () => number = Math.random): number[] {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function settle(h: PracticeHand): PracticeHand {
  const pv = handValue(h.player);
  if (pv > 21) return { ...h, result: "bust" };
  if (isBlackjack(h.player) && handValue(h.dealer) !== 21) return { ...h, result: "blackjack" };
  const dealer = [...h.dealer], deck = [...h.deck];
  while (handValue(dealer) < 17) dealer.push(deck.shift()!);
  const dv = handValue(dealer);
  return { ...h, dealer, deck, result: dv > 21 || pv > dv ? "win" : pv === dv ? "push" : "lose" };
}

export function practiceDeal(bet: number, deck: number[]): PracticeHand {
  const [p1, d1, p2, d2, ...rest] = deck;
  const h: PracticeHand = { deck: rest, player: [p1, p2], dealer: [d1, d2], bet, doubled: false, result: null };
  return handValue(h.player) === 21 || handValue(h.dealer) === 21 ? settle(h) : h;
}

export function practiceAction(h: PracticeHand, action: "hit" | "stand" | "double"): PracticeHand {
  if (h.result) return h;
  if (action === "stand") return settle(h);
  if (action === "double" && (h.player.length !== 2 || h.doubled)) return h;
  const [card, ...deck] = h.deck;
  const next = { ...h, deck, player: [...h.player, card], ...(action === "double" ? { bet: h.bet * 2, doubled: true } : {}) };
  return action === "double" || handValue(next.player) >= 21 ? settle(next) : next;
}

/** The practice hand as the table shows it (hole card hidden while playing). */
export function practiceView(h: PracticeHand, id: string, balance: number): HandState {
  const done = h.result !== null;
  const dealer = done ? h.dealer : h.dealer.slice(0, 1);
  return {
    id, bet: h.bet, status: done ? "done" : "playing", result: h.result, payout: h.result ? payoutFor(h.result, h.bet) : 0,
    doubled: h.doubled, player: h.player, player_value: handValue(h.player), dealer, dealer_value: handValue(dealer),
    can_double: !done && h.player.length === 2 && !h.doubled, balance,
  };
}
