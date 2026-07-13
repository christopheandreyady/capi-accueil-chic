// Pure Contrée game engine: types, legal moves, trick resolution, scoring, AI.
import type { Card, Rank, Suit } from "./deck";

export type Position = "bottom" | "left" | "top" | "right";
export type Team = "A" | "B";

export const CLOCKWISE: Position[] = ["bottom", "left", "top", "right"];
export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

export const TEAM_OF: Record<Position, Team> = {
  bottom: "A",
  top: "A",
  left: "B",
  right: "B",
};

export function nextSeat(p: Position): Position {
  return CLOCKWISE[(CLOCKWISE.indexOf(p) + 1) % 4];
}
export function prevSeat(p: Position): Position {
  return CLOCKWISE[(CLOCKWISE.indexOf(p) + 3) % 4];
}
export function partnerOf(p: Position): Position {
  return CLOCKWISE[(CLOCKWISE.indexOf(p) + 2) % 4];
}

// Trump order (weakest → strongest): 7 8 D R 10 A 9 V
const TRUMP_ORDER: Rank[] = ["7", "8", "D", "R", "10", "A", "9", "V"];
// Plain order: 7 8 9 V D R 10 A
const PLAIN_ORDER: Rank[] = ["7", "8", "9", "V", "D", "R", "10", "A"];

const TRUMP_POINTS: Record<Rank, number> = {
  V: 20, "9": 14, A: 11, "10": 10, R: 4, D: 3, "8": 0, "7": 0,
};
const PLAIN_POINTS: Record<Rank, number> = {
  A: 11, "10": 10, R: 4, D: 3, V: 2, "9": 0, "8": 0, "7": 0,
};

export function cardPower(card: Card, trump: Suit): number {
  return (card.suit === trump ? TRUMP_ORDER : PLAIN_ORDER).indexOf(card.rank);
}
export function cardPoints(card: Card, trump: Suit): number {
  return card.suit === trump ? TRUMP_POINTS[card.rank] : PLAIN_POINTS[card.rank];
}

// --- Trick resolution ------------------------------------------------------

export type TrickPlay = { seat: Position; card: Card };
export type Trick = { plays: TrickPlay[]; leader: Position };

export function trickWinner(trick: Trick, trump: Suit): Position {
  if (trick.plays.length === 0) return trick.leader;
  const leadSuit = trick.plays[0].card.suit;
  let best = trick.plays[0];
  for (let i = 1; i < trick.plays.length; i++) {
    const p = trick.plays[i];
    const bestT = best.card.suit === trump;
    const pT = p.card.suit === trump;
    if (pT && !bestT) best = p;
    else if (pT && bestT) {
      if (cardPower(p.card, trump) > cardPower(best.card, trump)) best = p;
    } else if (!pT && !bestT && p.card.suit === leadSuit) {
      if (cardPower(p.card, trump) > cardPower(best.card, trump)) best = p;
    }
  }
  return best.seat;
}

// --- Legal moves -----------------------------------------------------------

export function legalMoves(
  hand: Card[],
  trick: Trick | null,
  trump: Suit,
  seat: Position,
): Card[] {
  if (!trick || trick.plays.length === 0) return hand.slice();
  const leadSuit = trick.plays[0].card.suit;
  const hasLead = hand.some((c) => c.suit === leadSuit);
  const trumps = hand.filter((c) => c.suit === trump);
  const trumpsOnTrick = trick.plays.filter((p) => p.card.suit === trump);
  const highestTrump = trumpsOnTrick.length
    ? Math.max(...trumpsOnTrick.map((p) => cardPower(p.card, trump)))
    : -1;

  if (hasLead) {
    if (leadSuit === trump) {
      // Must overtrump if possible (monter à l'atout)
      const higher = trumps.filter((c) => cardPower(c, trump) > highestTrump);
      if (higher.length) return higher;
      return trumps;
    }
    return hand.filter((c) => c.suit === leadSuit);
  }

  // Void in led suit
  const winnerSeat = trickWinner(trick, trump);
  const partnerWinning = partnerOf(seat) === winnerSeat;
  if (trumps.length > 0 && !partnerWinning) {
    const higher = trumps.filter((c) => cardPower(c, trump) > highestTrump);
    if (higher.length) return higher;
    return trumps;
  }
  return hand.slice();
}

// --- Bidding ---------------------------------------------------------------

export type Bid =
  | { kind: "pass"; seat: Position }
  | { kind: "bid"; seat: Position; points: number; suit: Suit }
  | { kind: "capot"; seat: Position; suit: Suit };

export type Contract = {
  bidder: Position;
  suit: Suit;
  points: number; // 80..160, or 250 for capot
  isCapot: boolean;
};

export function currentBidLevel(bids: Bid[]): number {
  let max = 0;
  for (const b of bids) {
    if (b.kind === "bid") max = Math.max(max, b.points);
    else if (b.kind === "capot") max = Math.max(max, 250);
  }
  return max;
}

export function currentContract(bids: Bid[]): Contract | null {
  let contract: Contract | null = null;
  for (const b of bids) {
    if (b.kind === "bid") {
      contract = { bidder: b.seat, suit: b.suit, points: b.points, isCapot: false };
    } else if (b.kind === "capot") {
      contract = { bidder: b.seat, suit: b.suit, points: 250, isCapot: true };
    }
  }
  return contract;
}

// Bidding closes after 3 consecutive passes following a bid,
// or after 4 passes with no bid.
export function biddingClosed(bids: Bid[]): boolean {
  if (bids.length === 0) return false;
  const contract = currentContract(bids);
  if (!contract && bids.length >= 4) return true;
  if (!contract) return false;
  let tail = 0;
  for (let i = bids.length - 1; i >= 0; i--) {
    if (bids[i].kind === "pass") tail++;
    else break;
  }
  return tail >= 3;
}

// --- Scoring ---------------------------------------------------------------

export type RoundScore = {
  A: number;
  B: number;
  bidTeam: Team;
  bidTeamCardPoints: number;
  contractMet: boolean;
};

export function scoreRound(contract: Contract, tricks: Trick[]): RoundScore {
  const trump = contract.suit;
  const bidTeam: Team = TEAM_OF[contract.bidder];
  const defTeam: Team = bidTeam === "A" ? "B" : "A";
  const cardPts: Record<Team, number> = { A: 0, B: 0 };
  const trickWonBy: Record<Team, number> = { A: 0, B: 0 };

  tricks.forEach((t, idx) => {
    const w = trickWinner(t, trump);
    const team = TEAM_OF[w];
    trickWonBy[team]++;
    for (const p of t.plays) cardPts[team] += cardPoints(p.card, trump);
    if (idx === tricks.length - 1 && tricks.length === 8) cardPts[team] += 10; // dix de der
  });

  const contractPts = contract.points;
  let contractMet: boolean;
  if (contract.isCapot) {
    contractMet = trickWonBy[bidTeam] === 8;
  } else {
    contractMet = cardPts[bidTeam] >= contractPts;
  }

  const finalScore: Record<Team, number> = { A: 0, B: 0 };
  if (contractMet) {
    finalScore[bidTeam] = contractPts + cardPts[bidTeam];
    finalScore[defTeam] = cardPts[defTeam];
  } else {
    finalScore[bidTeam] = 0;
    finalScore[defTeam] = 160 + contractPts;
  }

  return {
    A: finalScore.A,
    B: finalScore.B,
    bidTeam,
    bidTeamCardPoints: cardPts[bidTeam],
    contractMet,
  };
}

// --- AI --------------------------------------------------------------------

function handStrength(hand: Card[], suit: Suit): number {
  let s = 0;
  for (const c of hand) {
    if (c.suit === suit) s += TRUMP_POINTS[c.rank] + 3;
    else if (c.rank === "A") s += 6;
    else if (c.rank === "10") s += 3;
  }
  return s;
}

export function aiBid(hand: Card[], bids: Bid[], seat: Position): Bid {
  const level = currentBidLevel(bids);
  const contract = currentContract(bids);
  // Score each suit as trump
  let bestSuit: Suit = "♠";
  let bestScore = -1;
  for (const s of SUITS) {
    const sc = handStrength(hand, s);
    if (sc > bestScore) {
      bestScore = sc;
      bestSuit = s;
    }
  }

  // No bid yet: bid 80 if strong enough
  if (!contract) {
    if (bestScore >= 34) return { kind: "bid", seat, points: 80, suit: bestSuit };
    return { kind: "pass", seat };
  }

  // Partner already holds the bid → pass to let them play it.
  if (partnerOf(seat) === contract.bidder) return { kind: "pass", seat };

  // Try to raise if hand is much stronger AND under 160.
  if (level < 160 && bestScore >= level - 40) {
    const next = Math.min(160, level + 10);
    return { kind: "bid", seat, points: next, suit: bestSuit };
  }
  return { kind: "pass", seat };
}

export function aiPlay(
  hand: Card[],
  trick: Trick | null,
  trump: Suit,
  seat: Position,
): Card {
  const legal = legalMoves(hand, trick, trump, seat);
  if (legal.length === 1) return legal[0];

  const lowest = (cards: Card[]) =>
    cards.reduce((low, c) =>
      cardPoints(c, trump) < cardPoints(low, trump) ||
      (cardPoints(c, trump) === cardPoints(low, trump) &&
        cardPower(c, trump) < cardPower(low, trump))
        ? c
        : low,
    );
  const highest = (cards: Card[]) =>
    cards.reduce((hi, c) =>
      cardPower(c, trump) > cardPower(hi, trump) ? c : hi,
    );

  if (!trick || trick.plays.length === 0) {
    // Leading: play a high non-trump if possible, else low trump
    const nonTrump = legal.filter((c) => c.suit !== trump);
    if (nonTrump.length) {
      const highs = nonTrump.filter((c) => c.rank === "A");
      if (highs.length) return highs[0];
      return lowest(nonTrump);
    }
    return lowest(legal);
  }

  const winner = trickWinner(trick, trump);
  const partnerWinning = partnerOf(seat) === winner;
  if (partnerWinning) return lowest(legal);
  // Try to win with highest legal
  return highest(legal);
}
