// Synchronisation de la partie en ligne.
//
// L'hôte est la seule source de vérité : il fait tourner le moteur de jeu et
// publie un instantané complet de l'état. Les invités affichent cet instantané
// et envoient leurs actions (annonce, carte jouée) à l'hôte.
//
// L'instantané est exprimé en sièges ABSOLUS (0..3, sens horaire à partir de
// l'hôte). Chaque client le convertit ensuite en positions locales pour que son
// propre siège soit toujours en bas de l'écran.

import type { Card, Suit } from "@/lib/deck";
import { CLOCKWISE, type Bid, type Contract, type Position, type RoundScore, type Team, type Trick } from "@/lib/contree";

export function localToAbs(pos: Position, mySeat: number): number {
  return (CLOCKWISE.indexOf(pos) + mySeat) % 4;
}

export function absToLocal(seat: number, mySeat: number): Position {
  return CLOCKWISE[(seat - mySeat + 4) % 4];
}

/** Les équipes sont relatives à l'écran : elles s'inversent pour un siège impair. */
export function flipTeam(team: Team, mySeat: number): Team {
  if (mySeat % 2 === 0) return team;
  return team === "A" ? "B" : "A";
}

type AbsBid =
  | { kind: "pass"; seat: number }
  | { kind: "bid"; seat: number; points: number; suit: Suit }
  | { kind: "capot"; seat: number; suit: Suit }
  | { kind: "contre"; seat: number }
  | { kind: "surcontre"; seat: number };

type AbsTrick = { leader: number; plays: { seat: number; card: Card }[] };

export type GameSnapshot = {
  v: 1;
  phase: string;
  dealer: number;
  dealSeed: number;
  dealtCount: number;
  dealMode: string | null;
  cutStep: 0 | 1 | 2;
  deckHolder: number | null;
  seated: boolean[];
  hands: Card[][];
  bids: AbsBid[];
  contract: { bidder: number; suit: Suit; points: number; isCapot: boolean; multiplier: 1 | 2 | 4 } | null;
  currentTurn: number;
  currentTrick: AbsTrick | null;
  tricks: AbsTrick[];
  roundScore: (Omit<RoundScore, "bidTeam" | "beloteTeam"> & { bidTeam: Team; beloteTeam: Team | null }) | null;
  cumulative: { A: number; B: number };
  liveRound: { A: number; B: number };
};

export type LocalGameState = {
  phase: string;
  dealer: Position;
  dealSeed: number;
  dealtCount: number;
  dealMode: string | null;
  cutStep: 0 | 1 | 2;
  deckHolder: Position | null;
  seated: Record<Position, boolean>;
  hands: Record<Position, Card[]>;
  bids: Bid[];
  contract: Contract | null;
  currentTurn: Position;
  currentTrick: Trick | null;
  tricks: Trick[];
  roundScore: RoundScore | null;
  cumulative: { A: number; B: number };
  liveRound: { A: number; B: number };
};

function teamScores(s: { A: number; B: number }, mySeat: number) {
  return mySeat % 2 === 0 ? { A: s.A, B: s.B } : { A: s.B, B: s.A };
}

export function serializeState(state: LocalGameState, mySeat: number): GameSnapshot {
  const seatIdx = (p: Position) => localToAbs(p, mySeat);
  const trick = (t: Trick): AbsTrick => ({
    leader: seatIdx(t.leader),
    plays: t.plays.map((p) => ({ seat: seatIdx(p.seat), card: p.card })),
  });
  const hands: Card[][] = [[], [], [], []];
  for (const pos of CLOCKWISE) hands[seatIdx(pos)] = state.hands[pos];
  const seated: boolean[] = [false, false, false, false];
  for (const pos of CLOCKWISE) seated[seatIdx(pos)] = state.seated[pos];

  return {
    v: 1,
    phase: state.phase,
    dealer: seatIdx(state.dealer),
    dealSeed: state.dealSeed,
    dealtCount: state.dealtCount,
    dealMode: state.dealMode,
    cutStep: state.cutStep,
    deckHolder: state.deckHolder ? seatIdx(state.deckHolder) : null,
    seated,
    hands,
    bids: state.bids.map((b) => ({ ...b, seat: seatIdx(b.seat) }) as AbsBid),
    contract: state.contract
      ? { ...state.contract, bidder: seatIdx(state.contract.bidder) }
      : null,
    currentTurn: seatIdx(state.currentTurn),
    currentTrick: state.currentTrick ? trick(state.currentTrick) : null,
    tricks: state.tricks.map(trick),
    roundScore: state.roundScore
      ? {
          ...state.roundScore,
          ...teamScores({ A: state.roundScore.A, B: state.roundScore.B }, mySeat),
          bidTeam: flipTeam(state.roundScore.bidTeam, mySeat),
          beloteTeam: state.roundScore.beloteTeam
            ? flipTeam(state.roundScore.beloteTeam, mySeat)
            : null,
        }
      : null,
    cumulative: teamScores(state.cumulative, mySeat),
    liveRound: teamScores(state.liveRound, mySeat),
  };
}

export function deserializeState(snap: GameSnapshot, mySeat: number): LocalGameState {
  const pos = (seat: number) => absToLocal(seat, mySeat);
  const trick = (t: AbsTrick): Trick => ({
    leader: pos(t.leader),
    plays: t.plays.map((p) => ({ seat: pos(p.seat), card: p.card })),
  });
  const hands = { bottom: [], left: [], top: [], right: [] } as Record<Position, Card[]>;
  snap.hands.forEach((cards, seat) => {
    hands[pos(seat)] = cards ?? [];
  });
  const seated = { bottom: true, left: true, top: true, right: true } as Record<Position, boolean>;
  snap.seated?.forEach((v, seat) => {
    seated[pos(seat)] = v;
  });

  return {
    phase: snap.phase,
    dealer: pos(snap.dealer),
    dealSeed: snap.dealSeed,
    dealtCount: snap.dealtCount,
    dealMode: snap.dealMode,
    cutStep: snap.cutStep,
    deckHolder: snap.deckHolder === null ? null : pos(snap.deckHolder),
    seated,
    hands,
    bids: snap.bids.map((b) => ({ ...b, seat: pos(b.seat) }) as Bid),
    contract: snap.contract ? { ...snap.contract, bidder: pos(snap.contract.bidder) } : null,
    currentTurn: pos(snap.currentTurn),
    currentTrick: snap.currentTrick ? trick(snap.currentTrick) : null,
    tricks: (snap.tricks ?? []).map(trick),
    roundScore: snap.roundScore
      ? {
          ...snap.roundScore,
          ...teamScores({ A: snap.roundScore.A, B: snap.roundScore.B }, mySeat),
          bidTeam: flipTeam(snap.roundScore.bidTeam, mySeat),
          beloteTeam: snap.roundScore.beloteTeam
            ? flipTeam(snap.roundScore.beloteTeam, mySeat)
            : null,
        }
      : null,
    cumulative: teamScores(snap.cumulative, mySeat),
    liveRound: teamScores(snap.liveRound, mySeat),
  };
}
