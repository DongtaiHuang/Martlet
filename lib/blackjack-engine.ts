// Blackjack rules (ADRs 0034 and 0041), shared by the table UI and preview-mode practice. Pure
// functions. The database (migrations 019 and 027) deals and pays real hands; this mirrors its
// rules exactly: one deck, dealer stands on all 17s, dealer peeks for blackjack, blackjack pays
// 3:2 (rounded down), double on the first two cards, split a pair of the same rank once (double
// after a split allowed, split aces get one card each, 21 after a split pays 1:1), no insurance.
// Cards are 0–51: rank = card % 13 (0 = ace, 1–8 = 2–9, 9 = 10, 10–12 = J Q K), suit = card / 13.

export type Result = "blackjack" | "win" | "push" | "lose" | "bust";
export type Action = "hit" | "stand" | "double" | "split";
export const ACTIONS: readonly Action[] = ["hit", "stand", "double", "split"];
export const isAction = (a: string): a is Action => (ACTIONS as readonly string[]).includes(a);

export interface HandState {
  id: string; status: "playing" | "done"; payout: number;
  /** Hand 1 (the only hand unless split). */
  bet: number; result: Result | null; doubled: boolean; player: number[]; player_value: number;
  /** Hand 2 after a split. */
  split: boolean; split_cards: number[] | null; split_value: number; split_bet: number; split_doubled: boolean; split_result: Result | null;
  /** The hand in play, and both bets together. */
  active: 1 | 2; total_bet: number;
  /** While playing, only the dealer's up card. */
  dealer: number[]; dealer_value: number;
  can_double: boolean; can_split: boolean; balance: number;
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

/** Two first cards of the same rank (two 8s, two kings; a king and a queen don't count). */
export const isPair = (cards: readonly number[]) => cards.length === 2 && cards[0] % 13 === cards[1] % 13;

/** One hand against the dealer's final cards. `natural`: a two-card 21 is a blackjack (not after a split). */
export function outcome(cards: readonly number[], dealer: readonly number[], natural: boolean): Result {
  const pv = handValue(cards), dv = handValue(dealer);
  if (pv > 21) return "bust";
  if (natural && isBlackjack(cards) && !isBlackjack(dealer)) return "blackjack";
  return dv > 21 || pv > dv ? "win" : pv === dv ? "push" : "lose";
}

export function payoutFor(result: Result, bet: number): number {
  return result === "blackjack" ? Math.floor(bet * 2.5) : result === "win" ? bet * 2 : result === "push" ? bet : 0;
}

export const RESULT_TEXT: Record<Result, string> = {
  blackjack: "Blackjack!", win: "You win", push: "Push", lose: "Dealer wins", bust: "Bust",
};
/** Short result for one of two split hands. */
export const HAND_RESULT: Record<Result, string> = { blackjack: "Blackjack", win: "Win", push: "Push", lose: "Lose", bust: "Bust" };

// Practice engine (preview mode, no points at stake) ------------------------------------------
export interface PracticeHand {
  deck: number[]; player: number[]; dealer: number[]; bet: number; doubled: boolean; result: Result | null;
  split: number[] | null; splitBet: number; splitDoubled: boolean; splitResult: Result | null; active: 1 | 2;
}

export function shuffledDeck(random: () => number = Math.random): number[] {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function settle(h: PracticeHand): PracticeHand {
  const split = h.split !== null;
  const dealer = [...h.dealer], deck = [...h.deck];
  // The dealer draws unless every hand is bust or the only hand is a blackjack.
  const live = (handValue(h.player) <= 21 && (split || !isBlackjack(h.player))) || (split && handValue(h.split!) <= 21);
  if (live) while (handValue(dealer) < 17) dealer.push(deck.shift()!);
  return { ...h, dealer, deck, result: outcome(h.player, dealer, !split), splitResult: split ? outcome(h.split!, dealer, false) : null };
}

/** The hand in play is finished: move to hand 2 after a split (unless it's already 21), or settle. */
function nextHand(h: PracticeHand): PracticeHand {
  if (h.split && h.active === 1) {
    const next: PracticeHand = { ...h, active: 2 };
    return handValue(h.split) < 21 ? next : settle(next);
  }
  return settle(h);
}

export function practiceDeal(bet: number, deck: number[]): PracticeHand {
  const [p1, d1, p2, d2, ...rest] = deck;
  const h: PracticeHand = {
    deck: rest, player: [p1, p2], dealer: [d1, d2], bet, doubled: false, result: null,
    split: null, splitBet: 0, splitDoubled: false, splitResult: null, active: 1,
  };
  return handValue(h.player) === 21 || handValue(h.dealer) === 21 ? settle(h) : h;
}

export function practiceAction(h: PracticeHand, action: Action): PracticeHand {
  if (h.result) return h;
  if (action === "stand") return nextHand(h);
  if (action === "split") {
    if (h.split || !isPair(h.player)) return h;
    const [a, b, ...deck] = h.deck;
    const next: PracticeHand = { ...h, deck, player: [h.player[0], a], split: [h.player[1], b], splitBet: h.bet, active: 1 };
    if (h.player[0] % 13 === 0) return settle(next); // split aces: one card each
    return handValue(next.player) === 21 ? nextHand(next) : next;
  }
  const two = h.active === 2;
  const cards = two ? h.split! : h.player;
  if (action === "double" && (cards.length !== 2 || (two ? h.splitDoubled : h.doubled))) return h;
  const [card, ...deck] = h.deck;
  const drawn = [...cards, card];
  let next: PracticeHand = two ? { ...h, deck, split: drawn } : { ...h, deck, player: drawn };
  if (action === "double") next = two ? { ...next, splitBet: h.splitBet * 2, splitDoubled: true } : { ...next, bet: h.bet * 2, doubled: true };
  return action === "double" || handValue(drawn) >= 21 ? nextHand(next) : next;
}

/** The practice hand as the table shows it (hole card hidden while playing). */
export function practiceView(h: PracticeHand, id: string, balance: number): HandState {
  const done = h.result !== null;
  const dealer = done ? h.dealer : h.dealer.slice(0, 1);
  const activeCards = h.active === 2 && h.split ? h.split : h.player;
  const payout = (h.result ? payoutFor(h.result, h.bet) : 0) + (h.splitResult ? payoutFor(h.splitResult, h.splitBet) : 0);
  return {
    id, status: done ? "done" : "playing", payout,
    bet: h.bet, result: h.result, doubled: h.doubled, player: h.player, player_value: handValue(h.player),
    split: h.split !== null, split_cards: h.split, split_value: h.split ? handValue(h.split) : 0, split_bet: h.splitBet,
    split_doubled: h.splitDoubled, split_result: h.splitResult, active: h.active, total_bet: h.bet + h.splitBet,
    dealer, dealer_value: handValue(dealer),
    can_double: !done && activeCards.length === 2 && !(h.active === 2 ? h.splitDoubled : h.doubled),
    can_split: !done && h.split === null && isPair(h.player), balance,
  };
}
