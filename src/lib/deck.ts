export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "7" | "8" | "9" | "10" | "V" | "D" | "R" | "A";

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
};

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["7", "8", "9", "10", "V", "D", "R", "A"];

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({ id: `${r}${s}`, suit: s, rank: r });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isRedSuit(s: Suit): boolean {
  return s === "♥" || s === "♦";
}
