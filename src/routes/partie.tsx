import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Shuffle, Check } from "lucide-react";
import bistrotTable from "@/assets/capi-bistrot-table.jpg";
import { buildDeck, isRedSuit, shuffle, type Card, type Rank, type Suit } from "@/lib/deck";
import {
  CLOCKWISE,
  SUITS,
  TEAM_OF,
  aiBid,
  aiPlay,
  biddingClosed,
  currentBidLevel,
  currentContract,
  legalMoves,
  nextSeat,
  partnerOf,
  prevSeat,
  scoreRound,
  trickWinner,
  type Bid,
  type Contract,
  type Position,
  type RoundScore,
  type Team,
  type Trick,
  type TrickPlay,
} from "@/lib/contree";

export const Route = createFileRoute("/partie")({
  head: () => ({
    meta: [
      { title: "Partie — CAPI" },
      { name: "description", content: "Table de Contrée en cours : annonces et jeu des cartes." },
      { property: "og:title", content: "Partie — CAPI" },
      { property: "og:description", content: "Partie de Contrée en direct." },
    ],
  }),
  component: GameTable,
});

const POSITIONS: Position[] = CLOCKWISE;

// Fixed display suit order (alternating colors for readability).
const SUIT_DISPLAY_ORDER: Suit[] = ["♠", "♥", "♣", "♦"];
// Trump order strongest → weakest for display.
const TRUMP_DISPLAY_ORDER: Rank[] = ["V", "9", "A", "10", "R", "D", "8", "7"];
// Plain order strongest → weakest for display.
const PLAIN_DISPLAY_ORDER: Rank[] = ["A", "10", "R", "D", "V", "9", "8", "7"];

function sortHand(cards: Card[], trump: Suit | null): Card[] {
  return [...cards].sort((a, b) => {
    const sa = SUIT_DISPLAY_ORDER.indexOf(a.suit);
    const sb = SUIT_DISPLAY_ORDER.indexOf(b.suit);
    if (sa !== sb) return sa - sb;
    const order = trump && a.suit === trump ? TRUMP_DISPLAY_ORDER : PLAIN_DISPLAY_ORDER;
    return order.indexOf(a.rank) - order.indexOf(b.rank);
  });
}

type PlayerInfo = { name: string; level: number; photo: string };

const PLAYERS: Record<Position, PlayerInfo> = {
  bottom: { name: "Vous", level: 22, photo: "https://i.pravatar.cc/200?img=12" },
  left: { name: "Bot Margaux", level: 15, photo: "https://i.pravatar.cc/200?img=47" },
  top: { name: "Bot Jean-Luc", level: 18, photo: "https://i.pravatar.cc/200?img=68" },
  right: { name: "Bot Alex", level: 12, photo: "https://i.pravatar.cc/200?img=15" },
};

// Card sizes — camera pulled closer, hand + trick more imposing.
const CARD_W_BIG = 108;
const CARD_H_BIG = 158;
const CARD_W_SMALL = 46;
const CARD_H_SMALL = 68;
const CARD_W_TRICK = 74;
const CARD_H_TRICK = 110;

const FLIGHT_MS = 460;
const CUT_MS = 2900;
const SHUFFLE_MS = 2700;
const AI_THINK_MS = 1400;
const TRICK_HOLD_MS = 1100;

type DealMode = "3-2-3" | "2-3-3" | "3-3-2";
type Phase =
  | "shuffle"
  | "shuffling"
  | "cut"
  | "mode"
  | "dealing"
  | "bidding"
  | "playing"
  | "scoring";

type Dealt = {
  card: Card;
  seat: Position;
  indexInHand: number;
  batchIndex: number;
};

// --- Audio -----------------------------------------------------------------

function getCtx(): AudioContext | null {
  try {
    const w = window as unknown as {
      __capiAudioCtx?: AudioContext;
      AudioContext: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    if (!w.__capiAudioCtx) w.__capiAudioCtx = new Ctor();
    return w.__capiAudioCtx!;
  } catch {
    return null;
  }
}

function playCardSound() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const dur = 0.16 + Math.random() * 0.05;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    const env = Math.pow(Math.sin(Math.PI * t), 1.4) * Math.pow(1 - t, 0.6);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2400 + Math.random() * 600;
  bp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.11 + Math.random() * 0.03, now);
  g.gain.exponentialRampToValueAtTime(0.0005, now + dur);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(now);
  src.stop(now + dur);
}

function playRiffleBurst() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const dur = 0.55;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    const tickPhase = (t * 30) % 1;
    const tick = tickPhase < 0.08 ? 1 - tickPhase / 0.08 : 0;
    const env = Math.pow(Math.sin(Math.PI * t), 0.8);
    data[i] = (Math.random() * 2 - 1) * env * (0.4 + tick * 0.6);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 3200;
  bp.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.14, now);
  g.gain.exponentialRampToValueAtTime(0.0005, now + dur);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(now);
  src.stop(now + dur);
}

function playCutSound() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const dur = 0.22;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    const env = Math.pow(Math.sin(Math.PI * t), 0.9) * Math.pow(1 - t, 0.4);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1600;
  bp.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.22, now);
  g.gain.exponentialRampToValueAtTime(0.0005, now + dur);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(now);
  src.stop(now + dur);
}

// --- Component -------------------------------------------------------------

function GameTable() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Setup phase state
  const [dealtCount, setDealtCount] = useState(0);
  const [dealSeed, setDealSeed] = useState(0);
  const [dealer, setDealer] = useState<Position>("bottom");
  const [phase, setPhase] = useState<Phase>("shuffle");
  const [cutStep, setCutStep] = useState<0 | 1 | 2>(0);
  const [deckHolder, setDeckHolder] = useState<Position | null>(null);
  const [dealMode, setDealMode] = useState<DealMode | null>(null);

  // Game state
  const [hands, setHands] = useState<Record<Position, Card[]>>({
    bottom: [], left: [], top: [], right: [],
  });
  const [bids, setBids] = useState<Bid[]>([]);
  const [contract, setContract] = useState<Contract | null>(null);
  const [currentTurn, setCurrentTurn] = useState<Position>("bottom");
  const [currentTrick, setCurrentTrick] = useState<Trick | null>(null);
  const [tricks, setTricks] = useState<Trick[]>([]);
  const [roundScore, setRoundScore] = useState<RoundScore | null>(null);
  const [cumulative, setCumulative] = useState<{ A: number; B: number }>({ A: 0, B: 0 });
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [displayScores, setDisplayScores] = useState<{ A: number; B: number }>({ A: 0, B: 0 });
  const [chipsSlideTo, setChipsSlideTo] = useState<Team | null>(null);
  const [chipsVisible, setChipsVisible] = useState(true);
  const [stashes, setStashes] = useState<{ A: ChipBreakdown[]; B: ChipBreakdown[] }>({ A: [], B: [] });
  // Last announcement stays visible above its author until a newer one arrives
  // or the bidding phase ends.
  const lastBidRef = bids.length > 0 ? bids[bids.length - 1] : null;
  const recentBid = phase === "bidding" && lastBidRef
    ? { seat: lastBidRef.seat, bid: lastBidRef }
    : null;

  const cutter = prevSeat(dealer);

  const dealOrder = useMemo<Dealt[]>(() => {
    if (!dealMode) return [];
    const deck = shuffle(buildDeck());
    const order: Dealt[] = [];
    const start = (POSITIONS.indexOf(dealer) + 1) % 4;
    const handIdx: Record<Position, number> = { bottom: 0, left: 0, top: 0, right: 0 };
    const pattern =
      dealMode === "3-2-3" ? [3, 2, 3] : dealMode === "3-3-2" ? [3, 3, 2] : [2, 3, 3];
    let k = 0;
    let batchIndex = 0;
    for (const sz of pattern) {
      for (let seatOffset = 0; seatOffset < 4; seatOffset++) {
        const seat = POSITIONS[(start + seatOffset) % 4];
        for (let c = 0; c < sz; c++) {
          order.push({ card: deck[k++], seat, indexInHand: handIdx[seat]++, batchIndex });
        }
        batchIndex++;
      }
    }
    return order;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealSeed, dealer, dealMode]);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset round when dealer/seed changes
  useEffect(() => {
    setPhase("shuffle");
    setCutStep(0);
    setDeckHolder(null);
    setDealtCount(0);
    setDealMode(null);
    setSelectedCardId(null);
    setHands({ bottom: [], left: [], top: [], right: [] });
    setBids([]);
    setContract(null);
    setCurrentTrick(null);
    setTricks([]);
    setRoundScore(null);
  }, [dealSeed, dealer]);

  // Dealing loop
  useEffect(() => {
    if (size.w === 0 || phase !== "dealing" || !dealMode) return;
    const timers: number[] = [];
    let cumulativeT = 0;
    for (let k = 0; k < dealOrder.length; k++) {
      const prev = dealOrder[k - 1];
      const cur = dealOrder[k];
      const batchChanged = !prev || prev.batchIndex !== cur.batchIndex;
      const step = k === 0 ? 320 : batchChanged ? 460 + Math.random() * 110 : 155 + Math.random() * 70;
      cumulativeT += step;
      const stepIdx = k + 1;
      timers.push(
        window.setTimeout(() => {
          setDealtCount(stepIdx);
          playCardSound();
        }, cumulativeT),
      );
    }
    // After last card, populate hands and open bidding
    timers.push(
      window.setTimeout(() => {
        const h: Record<Position, Card[]> = { bottom: [], left: [], top: [], right: [] };
        for (const d of dealOrder) h[d.seat].push(d.card);
        for (const p of POSITIONS) h[p] = sortHand(h[p], null);
        setHands(h);
        setBids([]);
        setContract(null);
        setCurrentTurn(nextSeat(dealer));
        setPhase("bidding");
      }, cumulativeT + FLIGHT_MS + 250),
    );
    return () => timers.forEach(clearTimeout);
  }, [phase, dealMode, dealOrder, size.w, dealer]);

  // --- Bidding loop --------------------------------------------------------
  useEffect(() => {
    if (phase !== "bidding") return;
    if (biddingClosed(bids)) {
      const c = currentContract(bids);
      const t = window.setTimeout(() => {
        if (!c) {
          // Everyone passed → redeal with next dealer
          nextRound();
        } else {
          setContract(c);
          setHands((h) => ({
            bottom: sortHand(h.bottom, c.suit),
            left: sortHand(h.left, c.suit),
            top: sortHand(h.top, c.suit),
            right: sortHand(h.right, c.suit),
          }));
          setCurrentTrick({ leader: nextSeat(dealer), plays: [] });
          setCurrentTurn(nextSeat(dealer));
          setPhase("playing");
        }
      }, 900);
      return () => clearTimeout(t);
    }
    if (currentTurn === "bottom") return; // wait for human
    const timer = window.setTimeout(() => {
      const decision = aiBid(hands[currentTurn], bids, currentTurn);
      submitBid(decision);
    }, AI_THINK_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bids, currentTurn, hands]);

  const submitBid = (b: Bid) => {
    setBids((prev) => [...prev, b]);
    setCurrentTurn((t) => nextSeat(t));
  };

  // --- Playing loop --------------------------------------------------------
  useEffect(() => {
    if (phase !== "playing" || !contract || !currentTrick) return;

    // Trick complete → resolve after a hold
    if (currentTrick.plays.length === 4) {
      const t = window.setTimeout(() => {
        const winner = trickWinner(currentTrick, contract.suit);
        const done = tricks.length + 1;
        setTricks((prev) => [...prev, currentTrick]);
        if (done >= 8) {
          // Finalize round — cumulative gets updated later, via animated counter
          const allTricks = [...tricks, currentTrick];
          const rs = scoreRound(contract, allTricks);
          setRoundScore(rs);
          setCurrentTrick(null);
          setPhase("scoring");
        } else {
          setCurrentTrick({ leader: winner, plays: [] });
          setCurrentTurn(winner);
        }
      }, TRICK_HOLD_MS);
      return () => clearTimeout(t);
    }

    if (currentTurn === "bottom") return; // human plays
    const timer = window.setTimeout(() => {
      const card = aiPlay(hands[currentTurn], currentTrick, contract.suit, currentTurn);
      playCardBy(currentTurn, card);
    }, AI_THINK_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, contract, currentTrick, currentTurn, hands, tricks]);

  // --- Scoring animation: slide chips → winning team, then count up ------
  useEffect(() => {
    if (phase !== "scoring" || !roundScore) return;
    setChipsVisible(true);
    setChipsSlideTo(null);
    const winner: Team =
      roundScore.A > roundScore.B
        ? "A"
        : roundScore.B > roundScore.A
          ? "B"
          : roundScore.bidTeam;
    const from = { A: cumulative.A, B: cumulative.B };
    const to = { A: cumulative.A + roundScore.A, B: cumulative.B + roundScore.B };
    setDisplayScores(from);

    const t1 = window.setTimeout(() => setChipsSlideTo(winner), 700);
    let raf = 0;
    const t2 = window.setTimeout(() => {
      const start = performance.now();
      const dur = 1500;
      const tick = () => {
        const p = Math.min(1, (performance.now() - start) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        setDisplayScores({
          A: Math.round(from.A + (to.A - from.A) * e),
          B: Math.round(from.B + (to.B - from.B) * e),
        });
        if (p < 1) raf = requestAnimationFrame(tick);
        else setCumulative(to);
      };
      raf = requestAnimationFrame(tick);
    }, 1900);
    const t3 = window.setTimeout(() => {
      const winnerPts = winner === "A" ? roundScore.A : roundScore.B;
      const rounded = Math.round(winnerPts / 10) * 10;
      if (rounded > 0) {
        setStashes((s) => ({ ...s, [winner]: [...s[winner], breakdownFromScore(rounded)] }));
      }
      setChipsVisible(false);
    }, 3900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roundScore]);

  // Keep displayScores synced outside scoring
  useEffect(() => {
    if (phase !== "scoring") setDisplayScores(cumulative);
  }, [cumulative, phase]);



  const playCardBy = (seat: Position, card: Card) => {
    setHands((h) => ({ ...h, [seat]: sortHand(h[seat].filter((c) => c.id !== card.id), contract?.suit ?? null) }));
    setCurrentTrick((t) =>
      t ? { ...t, plays: [...t.plays, { seat, card } as TrickPlay] } : t,
    );
    setCurrentTurn((c) => nextSeat(c));
    setSelectedCardId(null);
    playCardSound();
  };

  const handleLocalPlay = (card: Card) => {
    if (phase !== "playing" || !contract || !currentTrick) return;
    if (currentTurn !== "bottom") return;
    const legal = legalMoves(hands.bottom, currentTrick, contract.suit, "bottom");
    if (!legal.some((c) => c.id === card.id)) return;
    playCardBy("bottom", card);
  };

  // --- Positioning ---------------------------------------------------------

  const anchors = useMemo(() => {
    const w = size.w || 1;
    const h = size.h || 1;
    return {
      bottom: { x: w * 0.5, y: h - 6, angle: 0 },
      top: { x: w * 0.5, y: 34, angle: 180 },
      left: { x: 26, y: h * 0.5, angle: 90 },
      right: { x: w - 26, y: h * 0.5, angle: -90 },
    } as const;
  }, [size]);

  const deckBase = useMemo(() => {
    const holder = deckHolder ?? dealer;
    const a = anchors[holder];
    const cx = (size.w || 0) / 2;
    const cy = (size.h || 0) / 2;
    const dx = cx - a.x;
    const dy = cy - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const inset = holder === "bottom" || holder === "top" ? 128 : 112;
    return { x: a.x + (dx / len) * inset, y: a.y + (dy / len) * inset, angle: a.angle };
  }, [anchors, dealer, deckHolder, size]);

  const deckPos = useMemo(() => {
    if (phase !== "dealing" || dealtCount === 0 || dealtCount > dealOrder.length) return deckBase;
    const cur = dealOrder[Math.min(dealtCount, dealOrder.length - 1)] ?? dealOrder[dealtCount - 1];
    const rec = anchors[cur.seat];
    const dx = rec.x - deckBase.x;
    const dy = rec.y - deckBase.y;
    const targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const diff = ((targetAngle - deckBase.angle + 540) % 360) - 180;
    return { ...deckBase, angle: deckBase.angle + diff * 0.2 };
  }, [phase, dealtCount, dealOrder, deckBase, anchors]);

  const dealingTarget = (d: Dealt) => {
    // Used during "dealing" phase only.
    return handTarget(d.seat, d.indexInHand, 8, anchors);
  };

  // Cache targets for the dealing animation (stable jitter)
  const dealingTargetsRef = useRef<Record<string, ReturnType<typeof handTarget>>>({});
  useEffect(() => {
    dealingTargetsRef.current = {};
  }, [dealSeed, dealer, size.w, dealMode]);

  const nextRound = () => {
    setDealer((d) => nextSeat(d));
    setDealSeed((s) => s + 1);
  };

  const runCutSequence = () => {
    setPhase("cut");
    setCutStep(0);
    setDeckHolder(cutter);
    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => {
        setCutStep(1);
        playCutSound();
      }, 650),
    );
    timers.push(window.setTimeout(() => setCutStep(2), 650 + 750));
    timers.push(window.setTimeout(() => setDeckHolder(null), 650 + 750 + 400));
    timers.push(window.setTimeout(() => setPhase("mode"), CUT_MS));
    return () => timers.forEach(clearTimeout);
  };

  const doShuffle = (really: boolean) => {
    if (!really) {
      runCutSequence();
      return;
    }
    setPhase("shuffling");
    playRiffleBurst();
    const s1 = window.setTimeout(() => playRiffleBurst(), 850);
    const s2 = window.setTimeout(() => playRiffleBurst(), 1700);
    const s3 = window.setTimeout(() => runCutSequence(), SHUFFLE_MS);
    return () => [s1, s2, s3].forEach(clearTimeout);
  };

  const chooseMode = (m: DealMode) => {
    setDealMode(m);
    setDealtCount(0);
    setPhase("dealing");
  };

  const phaseTitle =
    phase === "shuffle" || phase === "shuffling"
      ? "Mélange"
      : phase === "cut"
        ? "Coupe"
        : phase === "mode"
          ? `${PLAYERS[dealer].name} distribue`
          : phase === "dealing"
            ? "Distribution"
            : phase === "bidding"
              ? "Annonces"
              : phase === "playing"
                ? contract ? `${contract.points} ${contract.suit}` : "En jeu"
                : "Fin de manche";

  // --- Render --------------------------------------------------------------

  const showDealtCards = phase === "dealing" || (phase === "cut" && dealtCount > 0);
  const showHands = phase === "bidding" || phase === "playing" || phase === "scoring";

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background">
      <style>{`
        @keyframes capi-riffle { 0%{transform:translate(-42px,0) rotate(-6deg);} 18%{transform:translate(-42px,-8px) rotate(-6deg);} 32%{transform:translate(-6px,-2px) rotate(-1deg);} 50%{transform:translate(2px,0);} 62%{transform:translate(-38px,-6px) rotate(-4deg);} 78%{transform:translate(-4px,-1px);} 100%{transform:translate(0,0);} }
        @keyframes capi-riffle-r { 0%{transform:translate(42px,0) rotate(6deg);} 18%{transform:translate(42px,-8px) rotate(6deg);} 32%{transform:translate(6px,-2px) rotate(1deg);} 50%{transform:translate(-2px,0);} 62%{transform:translate(38px,-6px) rotate(4deg);} 78%{transform:translate(4px,-1px);} 100%{transform:translate(0,0);} }
        @keyframes capi-riffle-tick { 0%,30%,60%{transform:translateY(0);} 10%,40%,70%{transform:translateY(-4px) rotate(-1.5deg);} 20%,50%,80%{transform:translateY(0);} }
        @keyframes capi-turn-pulse { 0%,100%{box-shadow:0 0 0 0 oklch(0.85 0.14 82 / 60%), 0 6px 14px -6px oklch(0 0 0 / 75%);} 50%{box-shadow:0 0 0 8px oklch(0.85 0.14 82 / 0%), 0 6px 14px -6px oklch(0 0 0 / 75%);} }
        @keyframes capi-think-dots { 0%,20%{opacity:.2;} 50%{opacity:1;} 80%,100%{opacity:.2;} }
      `}</style>

      {/* Deep bistro room background — kept dark so the wooden table becomes
          the actual UI object rather than a wallpaper. */}
      <div className="pointer-events-none absolute inset-0" style={{ background:"radial-gradient(120% 90% at 50% 40%, oklch(0.14 0.03 40) 0%, oklch(0.07 0.02 40) 55%, oklch(0.03 0.01 40) 100%)" }} />
      {/* Subtle dark wooden floor at the bottom of the room — heavily blurred so it never competes with the table. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%]" style={{ background:"repeating-linear-gradient(92deg, oklch(0.16 0.04 40) 0 22px, oklch(0.12 0.03 38) 22px 44px, oklch(0.14 0.035 42) 44px 68px)", opacity:0.55, filter:"blur(6px)", maskImage:"linear-gradient(to top, black 0%, black 40%, transparent 100%)", WebkitMaskImage:"linear-gradient(to top, black 0%, black 40%, transparent 100%)" }} />
      {/* Warm ambient bounce from above */}
      <div className="pointer-events-none absolute inset-0" style={{ background:"radial-gradient(70% 40% at 50% -4%, oklch(0.92 0.17 76 / 40%) 0%, oklch(0.78 0.14 66 / 16%) 32%, transparent 62%)" }} />
      {/* Deep room vignette to frame the table */}
      <div className="pointer-events-none absolute inset-0" style={{ background:"radial-gradient(75% 65% at 50% 50%, transparent 45%, oklch(0 0 0 / 55%) 100%)" }} />


      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pt-4 pb-4">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link to="/salle-attente" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition active:scale-95" style={{ background:"oklch(0.2 0.03 40 / 60%)", borderColor:"oklch(0.82 0.14 82 / 30%)", backdropFilter:"blur(8px)", color:"oklch(0.9 0.1 85)" }} aria-label="Retour"><ArrowLeft className="h-4 w-4" /></Link>
            <div
              className="pointer-events-none flex items-center gap-2 rounded-full border px-2.5 py-1 font-serif"
              style={{
                background: "oklch(0.14 0.03 40 / 78%)",
                borderColor: "oklch(0.82 0.14 82 / 35%)",
                color: "oklch(0.94 0.1 85)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 6px 14px -6px oklch(0 0 0 / 75%), inset 0 1px 0 oklch(1 0 0 / 10%)",
              }}
            >
              <span className="flex items-center gap-1">
                <span className="uppercase tracking-[0.18em]" style={{ fontSize: 9, color: "oklch(0.85 0.08 82)" }}>Nous</span>
                <span className="font-semibold tabular-nums" style={{ fontSize: 12 }}>{displayScores.A}</span>
              </span>
              <span aria-hidden="true" style={{ color: "oklch(0.82 0.14 82 / 45%)", fontSize: 10 }}>|</span>
              <span className="flex items-center gap-1">
                <span className="uppercase tracking-[0.18em]" style={{ fontSize: 9, color: "oklch(0.75 0.06 240)" }}>Eux</span>
                <span className="font-semibold tabular-nums" style={{ fontSize: 12 }}>{displayScores.B}</span>
              </span>
            </div>
          </div>
          <h1 className="hidden font-serif text-base font-semibold tracking-wide sm:block" style={{ background:"linear-gradient(180deg, oklch(0.95 0.1 88), oklch(0.72 0.14 78))", WebkitBackgroundClip:"text", backgroundClip:"text", color:"transparent", textShadow:"0 1px 0 oklch(0 0 0 / 40%)" }}>{phaseTitle}</h1>
          <button type="button" onClick={nextRound} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition active:scale-95" style={{ background:"oklch(0.2 0.03 40 / 60%)", borderColor:"oklch(0.82 0.14 82 / 30%)", backdropFilter:"blur(8px)", color:"oklch(0.9 0.1 85)" }} aria-label="Manche suivante"><RotateCcw className="h-4 w-4" /></button>
        </header>


        <div ref={boxRef} className="relative mx-auto my-auto w-full max-w-[380px] px-2 py-3">
          <div className="relative mx-auto aspect-square w-full">
            {/* The wooden bistro table is the central UI object. The existing
                artwork fills this bounded square exactly — no fullscreen
                wallpaper. Everything else (avatars, decor) sits around it. */}
            <img
              src={bistrotTable}
              alt=""
              width={1024}
              height={1024}
              className="pointer-events-none absolute inset-0 h-full w-full rounded-[6%] object-cover"
              style={{ boxShadow: "0 30px 60px -20px oklch(0 0 0 / 85%), 0 12px 28px -12px oklch(0 0 0 / 70%)" }}
            />
            {/* Soft central halo + subtle edge vignette on the felt. */}
            <div className="pointer-events-none absolute inset-0 rounded-[6%]" style={{ background:"radial-gradient(38% 30% at 50% 50%, oklch(0.9 0.14 78 / 14%) 0%, oklch(0.85 0.12 72 / 6%) 45%, transparent 75%)" }} />
            <div className="pointer-events-none absolute inset-0 rounded-[6%]" style={{ background:"radial-gradient(60% 55% at 50% 50%, transparent 0%, transparent 55%, oklch(0 0 0 / 32%) 100%)" }} />




            {/* Player badges */}
            {POSITIONS.map((p) => {
              const isActive = (phase === "bidding" || phase === "playing") && currentTurn === p;
              const isThinking = isActive && p !== "bottom";
              const lastBid = [...bids].reverse().find((b) => b.seat === p);
              const isRecent = recentBid?.seat === p;
              let badgeAnnounce: Bid | null =
                phase === "bidding" && lastBid && isRecent ? lastBid : null;
              let badgeIsTaker = false;
              if ((phase === "playing" || phase === "scoring") && contract && contract.bidder === p) {
                badgeAnnounce = contract.isCapot
                  ? { kind: "capot", seat: p, suit: contract.suit }
                  : { kind: "bid", seat: p, points: contract.points, suit: contract.suit };
                badgeIsTaker = true;
              }
              return (
                <PlayerBadge
                  key={p}
                  position={p}
                  info={PLAYERS[p]}
                  isDealer={p === dealer}
                  isLocal={p === "bottom"}
                  isActive={isActive}
                  isThinking={isThinking}
                  announcement={badgeAnnounce}
                  announcementIsTaker={badgeIsTaker}
                />
              );
            })}

            {/* Cut label */}
            {phase === "cut" && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-4 py-2 text-[12px] font-medium animate-fade-in" style={{ background:"oklch(0.18 0.03 40 / 88%)", borderColor:"oklch(0.82 0.14 82 / 40%)", color:"oklch(0.94 0.1 85)", backdropFilter:"blur(8px)" }}>
                À {PLAYERS[cutter].name} de couper le paquet
              </div>
            )}

            <TeamStash team="A" stash={stashes.A} />
            <TeamStash team="B" stash={stashes.B} />

            {/* Contract chips at center of table */}
            {(phase === "bidding" || phase === "playing" || phase === "scoring") && currentContract(bids) && chipsVisible && (
              <ContractChips contract={currentContract(bids)!} slideTo={chipsSlideTo} />
            )}

            {phase === "shuffling" && size.w > 0 && <ShuffleAnimation deckPos={deckBase} />}

            {phase === "shuffle" && size.w > 0 && (
              <ChoicePanel
                title={`${PLAYERS[dealer].name} distribue`}
                subtitle="Mélanger les cartes ?"
                options={[
                  { key:"shuffle", label:"Mélanger", icon:<Shuffle className="h-4 w-4" />, onClick:()=>doShuffle(true), primary:true },
                  { key:"no", label:"Ne pas mélanger", icon:<Check className="h-4 w-4" />, onClick:()=>doShuffle(false) },
                ]}
              />
            )}

            {phase === "mode" && size.w > 0 && (
              <ChoicePanel
                title="Vous distribuez"
                subtitle="Choisissez la distribution"
                options={(["3-2-3","2-3-3","3-3-2"] as DealMode[]).map(m => ({ key:m, label:m, onClick:()=>chooseMode(m), primary:true }))}
              />
            )}

            {(phase === "cut" || phase === "dealing") && (
              <DeckStack deckPos={deckPos} cutStep={phase==="cut"?cutStep:2} remaining={32-dealtCount} />
            )}

            {/* Dealing animation cards */}
            {showDealtCards && dealOrder.map((d, i) => {
              const isDealt = i < dealtCount && phase !== "cut";
              if (!dealingTargetsRef.current[d.card.id]) {
                dealingTargetsRef.current[d.card.id] = handTarget(d.seat, d.indexInHand, 8, anchors);
              }
              const target = dealingTargetsRef.current[d.card.id];
              const x = isDealt ? target.x : deckPos.x;
              const y = isDealt ? target.y : deckPos.y;
              const rotate = isDealt ? target.rotate : deckPos.angle + (i%2===0?-1.5:1.5);
              const w = target.w, h = target.h;
              const showFace = isDealt && d.seat === "bottom";
              const z = isDealt ? 100 + d.indexInHand + (d.seat==="bottom"?50:0) : 20 + (32-i);
              return (
                <div key={d.card.id} className="absolute left-0 top-0" style={{ width:w, height:h, transform:`translate3d(${x-w/2}px, ${y-h/2}px, 0) rotate(${rotate}deg)`, transition:`transform ${FLIGHT_MS}ms cubic-bezier(0.22, 0.7, 0.25, 1)`, zIndex:z, willChange:"transform" }}>
                  {showFace ? <CardFace card={d.card} /> : <CardBack />}
                </div>
              );
            })}

            {/* Game-phase cards: hands + trick */}
            {showHands && size.w > 0 && (
              <GameCards
                hands={hands}
                trick={currentTrick}
                anchors={anchors}
                onLocalPlay={handleLocalPlay}
                selectedCardId={selectedCardId}
                setSelectedCardId={setSelectedCardId}
                phase={phase}
                contract={contract}
                currentTurn={currentTurn}
              />
            )}
          </div>
        </div>

        {/* Bottom panels */}
        {phase === "bidding" && currentTurn === "bottom" && !biddingClosed(bids) && (
          <BiddingPanel bids={bids} onBid={(b)=>submitBid(b)} />
        )}
        {phase === "scoring" && roundScore && contract && (
          <ScoringPanel score={roundScore} contract={contract} cumulative={cumulative} onNext={nextRound} />
        )}
      </div>
    </main>
  );
}

// --- Positioning helper ----------------------------------------------------

type Anchors = {
  bottom: { x: number; y: number; angle: number };
  top: { x: number; y: number; angle: number };
  left: { x: number; y: number; angle: number };
  right: { x: number; y: number; angle: number };
};

function handTarget(seat: Position, index: number, total: number, anchors: Anchors) {
  const isBottom = seat === "bottom";
  const cardW = isBottom ? CARD_W_BIG : CARD_W_SMALL;
  const cardH = isBottom ? CARD_H_BIG : CARD_H_SMALL;
  const a = anchors[seat];
  // Constant per-card angular step: the fan CLOSES as cards are played,
  // so the hand always stays visually compact with no gap where a card was.
  const stepDeg = isBottom ? 12.5 : 2.2;
  const localAngle = total > 1 ? -((total - 1) / 2) * stepDeg + stepDeg * index : 0;
  const radius = isBottom ? 82 : 70;
  const rad = (localAngle * Math.PI) / 180;
  const lx = Math.sin(rad) * radius;
  const ly = -Math.cos(rad) * radius;
  const seatRad = (a.angle * Math.PI) / 180;
  const rx = lx * Math.cos(seatRad) - ly * Math.sin(seatRad);
  const ry = lx * Math.sin(seatRad) + ly * Math.cos(seatRad);
  return {
    x: a.x + rx,
    y: a.y + ry,
    rotate: localAngle + a.angle,
    w: cardW,
    h: cardH,
    seatAngle: a.angle,
  };
}

// Deterministic pseudo-random in [-1, 1] from seat + play index.
function seatJitter(seat: Position, orderIndex: number, salt: number) {
  const seed = (seat.charCodeAt(0) * 131 + orderIndex * 977 + salt * 31) % 1000;
  return (seed / 1000) * 2 - 1;
}

function trickTarget(
  seat: Position,
  anchors: Anchors,
  size: { w: number; h: number },
  orderIndex: number,
) {
  const cx = (size.w || 1) / 2;
  const cy = (size.h || 1) / 2;
  const a = anchors[seat];
  const dx = a.x - cx;
  const dy = a.y - cy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const px = -ny;
  const py = nx;
  // Cards gather tightly in the middle, overlap each other, and never form
  // a clean cross. Each play sits a touch off-center on a different axis.
  const radialOffset = 14 + seatJitter(seat, orderIndex, 3) * 5;
  const tangentOffset = seatJitter(seat, orderIndex, 1) * 10 + (orderIndex - 1.5) * 3.5;
  const wobble = seatJitter(seat, orderIndex, 5) * 6;
  return {
    x: cx + nx * radialOffset + px * tangentOffset + seatJitter(seat, orderIndex, 7) * 3,
    y: cy + ny * radialOffset + py * tangentOffset + seatJitter(seat, orderIndex, 9) * 3,
    // Break the strict 0/90/180/270 seat rotation with a real per-play wobble.
    rotate: a.angle + wobble + (orderIndex % 2 === 0 ? -4 : 5) + seatJitter(seat, orderIndex, 11) * 3,
  };
}

// --- Game cards renderer ---------------------------------------------------

function GameCards({
  hands, trick, anchors, onLocalPlay, selectedCardId, setSelectedCardId,
  phase, contract, currentTurn,
}: {
  hands: Record<Position, Card[]>;
  trick: Trick | null;
  anchors: Anchors;
  onLocalPlay: (card: Card) => void;
  selectedCardId: string | null;
  setSelectedCardId: (id: string | null) => void;
  phase: Phase;
  contract: Contract | null;
  currentTurn: Position;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    // Read size from anchors indirectly — we already have anchors computed from parent's boxRef.
    // Use anchors.bottom.x*2 as w and anchors.bottom.y-30 as h for trick positioning.
    setSz({ w: anchors.bottom.x * 2, h: anchors.bottom.y - 30 });
  }, [anchors]);

  const trickTargets = useMemo(() => {
    const map: Record<string, ReturnType<typeof trickTarget>> = {};
    if (!trick) return map;
    trick.plays.forEach((p, i) => {
      map[p.card.id] = trickTarget(p.seat, anchors, sz, i);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trick, anchors, sz]);

  const legalIds = useMemo(() => {
    if (phase !== "playing" || !contract || !trick || currentTurn !== "bottom") return null;
    const legal = legalMoves(hands.bottom, trick, contract.suit, "bottom");
    return new Set(legal.map((c) => c.id));
  }, [phase, contract, trick, currentTurn, hands.bottom]);

  return (
    <div ref={boxRef} className="absolute inset-0">
      {POSITIONS.map((seat) => {
        const hand = hands[seat];
        return hand.map((card, index) => {
          const t = handTarget(seat, index, hand.length, anchors);
          const isBottom = seat === "bottom";
          const showFace = isBottom;
          const clickable = isBottom && phase === "playing" && currentTurn === "bottom" && (!legalIds || legalIds.has(card.id));
          return (
            <div
              key={card.id}
              onClick={clickable ? () => onLocalPlay(card) : undefined}
              className={`absolute left-0 top-0 ${clickable ? "cursor-pointer" : ""}`}
              style={{
                width: t.w, height: t.h,
                transform: `translate3d(${t.x - t.w/2}px, ${t.y - t.h/2}px, 0) rotate(${t.rotate}deg)`,
                transition: `transform 380ms cubic-bezier(0.22, 0.7, 0.25, 1)`,
                zIndex: 100 + index + (isBottom ? 50 : 0),
                opacity: 1,
              }}
            >
              {showFace ? <CardFace card={card} /> : <CardBack />}
            </div>
          );
        });
      })}

      {/* Trick */}
      {trick && trick.plays.map((p, i) => {
        const t = trickTargets[p.card.id] ?? trickTarget(p.seat, anchors, sz, i);
        return (
          <div key={"trick-" + p.card.id} className="absolute left-0 top-0" style={{
            width: CARD_W_TRICK, height: CARD_H_TRICK,
            transform: `translate3d(${t.x - CARD_W_TRICK/2}px, ${t.y - CARD_H_TRICK/2}px, 0) rotate(${t.rotate}deg)`,
            transition: `transform 340ms cubic-bezier(0.22, 0.7, 0.25, 1)`,
            zIndex: 300 + i,
          }}>
            <CardFace card={p.card} />
          </div>
        );
      })}
    </div>
  );
}

// --- Sub components --------------------------------------------------------

function ShuffleAnimation({ deckPos }: { deckPos: { x: number; y: number; angle: number } }) {
  const w = 46, h = 66, layers = 8;
  return (
    <div className="pointer-events-none absolute left-0 top-0" style={{ transform:`translate3d(${deckPos.x-w/2}px, ${deckPos.y-h/2}px, 0) rotate(${deckPos.angle}deg)`, zIndex:60, width:w, height:h }}>
      <div style={{ position:"absolute", inset:0, animation:"capi-riffle 900ms cubic-bezier(0.4, 0.1, 0.3, 1) 3" }}>
        {Array.from({ length: layers }).map((_, i) => (
          <div key={`L${i}`} style={{ position:"absolute", inset:0, transform:`translate(${-i*0.5}px, ${-i*0.9}px)`, animation:`capi-riffle-tick 900ms ease-in-out ${i*40}ms infinite` }}>
            <CardBack />
          </div>
        ))}
      </div>
      <div style={{ position:"absolute", inset:0, animation:"capi-riffle-r 900ms cubic-bezier(0.4, 0.1, 0.3, 1) 3" }}>
        {Array.from({ length: layers }).map((_, i) => (
          <div key={`R${i}`} style={{ position:"absolute", inset:0, transform:`translate(${i*0.5}px, ${-i*0.9}px)`, animation:`capi-riffle-tick 900ms ease-in-out ${i*40+20}ms infinite` }}>
            <CardBack />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChoicePanel({
  title, subtitle, options,
}: {
  title: string; subtitle: string;
  options: { key: string; label: string; icon?: React.ReactNode; onClick: () => void; primary?: boolean }[];
}) {
  return (
    <div className="absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 animate-fade-in">
      <div className="rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.22em]" style={{ background:"oklch(0.18 0.03 40 / 88%)", borderColor:"oklch(0.82 0.14 82 / 40%)", color:"oklch(0.94 0.1 85)", backdropFilter:"blur(8px)" }}>{title}</div>
      <div className="text-[12px]" style={{ color:"oklch(0.88 0.07 82 / 90%)", textShadow:"0 1px 2px oklch(0 0 0 / 65%)" }}>{subtitle}</div>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        {options.map((o) => (
          <button key={o.key} type="button" onClick={o.onClick} className="flex items-center gap-1.5 rounded-2xl border px-4 py-2.5 font-serif text-sm font-semibold tracking-wide transition active:scale-[0.97]" style={{ background: o.primary ? "linear-gradient(168deg, oklch(0.36 0.10 152) 0%, oklch(0.24 0.08 152) 100%)" : "linear-gradient(168deg, oklch(0.24 0.04 42) 0%, oklch(0.16 0.03 40) 100%)", borderColor:"oklch(0.82 0.14 82 / 45%)", boxShadow:"0 10px 22px -12px oklch(0 0 0 / 70%), inset 0 1px 0 oklch(1 0 0 / 12%), inset 0 -6px 12px oklch(0 0 0 / 35%)" }}>
            {o.icon ? <span style={{ color:"oklch(0.94 0.11 88)" }}>{o.icon}</span> : null}
            <span style={{ background:"linear-gradient(180deg, oklch(0.96 0.1 88), oklch(0.72 0.14 78))", WebkitBackgroundClip:"text", backgroundClip:"text", color:"transparent", textShadow:"0 1px 0 oklch(0 0 0 / 40%)" }}>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BiddingPanel({ bids, onBid }: { bids: Bid[]; onBid: (b: Bid) => void }) {
  const level = currentBidLevel(bids);
  const [selectedLevel, setSelectedLevel] = useState<number | "capot">(
    level < 80 ? 80 : Math.min(160, level + 10),
  );
  const min = level < 80 ? 80 : level + 10;
  const levels: number[] = [];
  for (let v = 80; v <= 160; v += 10) if (v >= min) levels.push(v);
  const currentIsValid = selectedLevel === "capot"
    ? true
    : (selectedLevel as number) >= min && (selectedLevel as number) <= 160;
  const effective: number | "capot" = currentIsValid ? selectedLevel : (levels[0] ?? "capot");

  return (
    <div className="mt-3 rounded-2xl border p-3 animate-fade-in" style={{ background:"oklch(0.16 0.03 40 / 90%)", borderColor:"oklch(0.82 0.14 82 / 40%)", backdropFilter:"blur(10px)" }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color:"oklch(0.88 0.08 82)" }}>À vous d'annoncer</span>
        <span className="text-[11px]" style={{ color:"oklch(0.88 0.08 82 / 80%)" }}>Palier {level === 0 ? "—" : level}</span>
      </div>
      <div className="mb-2 flex flex-wrap justify-center gap-1">
        {levels.map((v) => {
          const active = effective === v;
          return (
            <button key={v} type="button" onClick={() => setSelectedLevel(v)} className="rounded-lg border px-2.5 py-1 font-serif text-[13px] font-semibold tabular-nums transition active:scale-[0.95]"
              style={{
                background: active ? "linear-gradient(168deg, oklch(0.42 0.11 152) 0%, oklch(0.28 0.09 152) 100%)" : "linear-gradient(168deg, oklch(0.22 0.04 42) 0%, oklch(0.15 0.03 40) 100%)",
                borderColor: active ? "oklch(0.85 0.14 82 / 75%)" : "oklch(0.82 0.14 82 / 30%)",
                color: active ? "oklch(0.96 0.11 88)" : "oklch(0.88 0.08 82 / 85%)",
                boxShadow: active ? "0 6px 14px -6px oklch(0 0 0 / 65%), inset 0 1px 0 oklch(1 0 0 / 12%)" : "inset 0 1px 0 oklch(1 0 0 / 6%)",
              }}>
              {v}
            </button>
          );
        })}
        <button type="button" onClick={() => setSelectedLevel("capot")} className="rounded-lg border px-2.5 py-1 font-serif text-[13px] font-semibold uppercase tracking-wider transition active:scale-[0.95]"
          style={{
            background: effective === "capot" ? "linear-gradient(168deg, oklch(0.45 0.16 25) 0%, oklch(0.28 0.13 25) 100%)" : "linear-gradient(168deg, oklch(0.22 0.04 42) 0%, oklch(0.15 0.03 40) 100%)",
            borderColor: effective === "capot" ? "oklch(0.85 0.16 40 / 80%)" : "oklch(0.82 0.14 82 / 30%)",
            color: "oklch(0.95 0.1 85)",
          }}>
          Capot
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button type="button" onClick={() => onBid({ kind:"pass", seat:"bottom" })} className="rounded-xl border px-3 py-2 font-serif text-sm transition active:scale-[0.97]" style={{ background:"linear-gradient(168deg, oklch(0.24 0.04 42) 0%, oklch(0.16 0.03 40) 100%)", borderColor:"oklch(0.82 0.14 82 / 40%)", color:"oklch(0.94 0.1 85)" }}>Passer</button>
        {SUITS.map((s) => {
          const isCapot = effective === "capot";
          const bid: Bid = isCapot
            ? { kind: "capot", seat: "bottom", suit: s }
            : { kind: "bid", seat: "bottom", points: effective as number, suit: s };
          return (
            <button key={s} type="button" onClick={() => onBid(bid)} className="flex items-center gap-1.5 rounded-xl border px-3 py-2 font-serif text-sm font-semibold transition active:scale-[0.97]"
              style={{
                background: isCapot
                  ? "linear-gradient(168deg, oklch(0.38 0.14 25) 0%, oklch(0.24 0.11 25) 100%)"
                  : "linear-gradient(168deg, oklch(0.36 0.10 152) 0%, oklch(0.24 0.08 152) 100%)",
                borderColor:"oklch(0.82 0.14 82 / 45%)",
                color:"oklch(0.96 0.11 88)",
                boxShadow:"0 8px 18px -10px oklch(0 0 0 / 65%), inset 0 1px 0 oklch(1 0 0 / 10%)",
              }}>
              {isCapot ? "Capot" : (effective as number)} <SuitBadge suit={s} size={20} />
            </button>
          );
        })}
      </div>
    </div>
  );
}


function ScoringPanel({
  score, contract, cumulative, onNext,
}: {
  score: RoundScore;
  contract: Contract;
  cumulative: { A: number; B: number };
  onNext: () => void;
}) {
  const teamLabel = (t: Team) => (t === "A" ? "Nous" : "Eux");
  return (
    <div className="mt-3 rounded-2xl border p-4 animate-fade-in" style={{ background:"oklch(0.16 0.03 40 / 92%)", borderColor:"oklch(0.82 0.14 82 / 45%)", backdropFilter:"blur(10px)" }}>
      <div className="mb-2 text-center">
        <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color:"oklch(0.88 0.08 82)" }}>Contrat</div>
        <div className="mt-0.5 font-serif text-base" style={{ color:"oklch(0.95 0.1 85)" }}>
          {contract.isCapot ? "Capot" : contract.points} <span style={{ color: isRedSuit(contract.suit)?"oklch(0.85 0.16 25)":"oklch(0.94 0.1 85)" }}>{contract.suit}</span>
          {" — "}
          <span style={{ color: score.contractMet ? "oklch(0.75 0.18 145)" : "oklch(0.7 0.2 25)" }}>
            {score.contractMet ? "Réussi" : "Chuté"}
          </span>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-center">
        {(["A","B"] as Team[]).map((t) => (
          <div key={t} className="rounded-xl border px-3 py-2" style={{ background:"oklch(0.2 0.03 40 / 70%)", borderColor:"oklch(0.82 0.14 82 / 25%)" }}>
            <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color:"oklch(0.85 0.08 82)" }}>{teamLabel(t)}</div>
            <div className="font-serif text-lg" style={{ color:"oklch(0.96 0.1 88)" }}>+{score[t]}</div>
            <div className="text-[11px]" style={{ color:"oklch(0.85 0.08 82 / 80%)" }}>Total {cumulative[t]}</div>
          </div>
        ))}
      </div>
      <button type="button" onClick={onNext} className="w-full rounded-xl border px-4 py-2.5 font-serif text-sm transition active:scale-[0.97]" style={{ background:"linear-gradient(168deg, oklch(0.36 0.10 152) 0%, oklch(0.24 0.08 152) 100%)", borderColor:"oklch(0.82 0.14 82 / 45%)", color:"oklch(0.96 0.1 88)" }}>
        Manche suivante
      </button>
    </div>
  );
}

function ScorePill({ team, label, value, highlight }: { team: Team; label: string; value: number; highlight: boolean }) {
  const color = team === "A" ? "oklch(0.72 0.16 55)" : "oklch(0.62 0.16 240)";
  return (
    <div className="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5" style={{ background:"oklch(0.18 0.03 40 / 80%)", borderColor: highlight ? "oklch(0.85 0.14 82 / 70%)" : `${color} / 55%`, color:"oklch(0.94 0.1 85)" }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <span className="uppercase tracking-[0.18em]" style={{ fontSize: 9 }}>{label}</span>
      <span className="font-serif font-semibold">{value}</span>
    </div>
  );
}

function DeckStack({ deckPos, cutStep, remaining }: { deckPos: { x: number; y: number; angle: number }; cutStep: 0 | 1 | 2; remaining: number }) {
  if (remaining <= 0) return null;
  const w = 46, h = 66;
  const splitOffset = cutStep === 1 ? 52 : 0;
  const topZ = cutStep === 2 ? 1 : 3;
  const bottomZ = cutStep === 2 ? 3 : 1;
  const rad = (deckPos.angle * Math.PI) / 180;
  const ox = Math.cos(rad) * splitOffset;
  const oy = Math.sin(rad) * splitOffset;
  return (
    <>
      <div className="absolute left-0 top-0" style={{ width:w, height:h, transform:`translate3d(${deckPos.x-w/2-ox}px, ${deckPos.y-h/2-oy}px, 0) rotate(${deckPos.angle}deg)`, transition:"transform 650ms cubic-bezier(0.22, 0.7, 0.25, 1)", zIndex: bottomZ + 40 }}>
        <DeckSlab count={Math.min(remaining, 16)} />
      </div>
      <div className="absolute left-0 top-0" style={{ width:w, height:h, transform:`translate3d(${deckPos.x-w/2+ox}px, ${deckPos.y-h/2+oy}px, 0) rotate(${deckPos.angle}deg)`, transition:"transform 650ms cubic-bezier(0.22, 0.7, 0.25, 1)", zIndex: topZ + 40 }}>
        <DeckSlab count={Math.max(remaining - 16, 1)} />
      </div>
    </>
  );
}

function DeckSlab({ count }: { count: number }) {
  const layers = Math.max(1, Math.min(4, Math.ceil(count / 4)));
  return (
    <div className="relative h-full w-full">
      {Array.from({ length: layers }).map((_, i) => (
        <div key={i} className="absolute inset-0" style={{ transform:`translate(${i*0.6}px, ${-i*0.8}px)` }}>
          <CardBack />
        </div>
      ))}
    </div>
  );
}

function PlayerBadge({
  position, info, isDealer, isLocal, isActive, isThinking, announcement, announcementIsTaker,
}: {
  position: Position; info: PlayerInfo; isDealer: boolean; isLocal: boolean;
  isActive?: boolean; isThinking?: boolean; announcement?: Bid | null; announcementIsTaker?: boolean;
}) {
  const style: React.CSSProperties =
    position === "bottom" ? { left:"50%", bottom:"-104px", transform:"translate(-50%, 0)" }
    : position === "top" ? { left:"50%", top:"-82px", transform:"translate(-50%, 0)" }
    : position === "left" ? { left:"-64px", top:"50%", transform:"translate(0, -50%)" }
    : { right:"-64px", top:"50%", transform:"translate(0, -50%)" };



  const team = position === "bottom" || position === "top" ? "A" : "B";
  const ring = team === "A" ? "oklch(0.72 0.16 55 / 85%)" : "oklch(0.62 0.16 240 / 85%)";
  const avatarSize = isLocal ? 58 : 46;

  return (
    <div className="pointer-events-none absolute z-20 flex flex-col items-center gap-1" style={style}>
      <div className="relative">
        <div className="overflow-hidden rounded-full border-2" style={{
          width: avatarSize, height: avatarSize, borderColor: ring,
          background:"linear-gradient(160deg, oklch(0.38 0.05 40), oklch(0.24 0.04 40))",
          boxShadow: isActive
            ? `0 0 0 2px oklch(0 0 0 / 45%), 0 0 0 4px oklch(0.85 0.14 82 / 75%), 0 0 18px -2px oklch(0.85 0.14 82 / 70%)`
            : `0 6px 14px -6px oklch(0 0 0 / 75%), 0 0 0 2px oklch(0 0 0 / 45%), 0 0 10px -3px ${ring.replace("85%", "40%")}`,
          animation: isActive ? "capi-turn-pulse 1.4s ease-in-out infinite" : undefined,
        }}>
          <img src={info.photo} alt={info.name} width={200} height={200} className="h-full w-full object-cover" loading="lazy" />
        </div>
        {isDealer && (
          <span className="absolute -top-1 -right-1 flex h-[19px] w-[19px] items-center justify-center rounded-full font-serif text-[10px] font-bold" style={{ background:"radial-gradient(circle at 35% 30%, oklch(0.96 0.11 88), oklch(0.72 0.16 72) 65%, oklch(0.48 0.10 55))", color:"oklch(0.18 0.05 40)", boxShadow:"0 2px 4px oklch(0 0 0 / 65%), 0 0 0 1px oklch(0.35 0.08 55) inset, 0 0 0 2px oklch(0.10 0.02 40 / 80%)" }} aria-label="Donneur">D</span>
        )}
        {isThinking && (
          <div className="absolute -top-1 -left-1 rounded-full border px-1.5 py-0.5 text-[10px]" style={{ background:"oklch(0.18 0.03 40 / 90%)", borderColor:"oklch(0.82 0.14 82 / 40%)", color:"oklch(0.94 0.1 85)" }}>
            <span style={{ animation:"capi-think-dots 1.2s infinite 0ms" }}>•</span>
            <span style={{ animation:"capi-think-dots 1.2s infinite 200ms" }}>•</span>
            <span style={{ animation:"capi-think-dots 1.2s infinite 400ms" }}>•</span>
          </div>
        )}
        {announcement && (
          <AnnouncementBubble bid={announcement} position={position} isTaker={announcementIsTaker} />
        )}
      </div>
      <div className="flex flex-col items-center leading-tight">
        <span className="font-serif text-[11px] font-semibold tracking-wide" style={{ color:"oklch(0.95 0.08 85)", textShadow:"0 1px 2px oklch(0 0 0 / 80%)" }}>{info.name}</span>
        <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color:"oklch(0.82 0.08 82 / 85%)" }}>Niv. {info.level}</span>
      </div>
    </div>
  );
}

function AnnouncementBubble({ bid, position, isTaker }: { bid: Bid; position: Position; isTaker?: boolean }) {
  const isPass = bid.kind === "pass";
  const suit = bid.kind === "pass" ? null : bid.suit;
  const label =
    bid.kind === "pass" ? "Passe"
    : bid.kind === "capot" ? "Capot"
    : String(bid.points);
  // Small dark ribbon integrated just under the avatar — no white box.
  const placement: React.CSSProperties =
    position === "bottom"
      ? { bottom: "calc(100% + 6px)", left: "50%" }
      : { top: "calc(100% + 6px)", left: "50%" };
  const fontSize = isTaker ? 15 : 16;
  const tilt = position === "bottom" ? -1.4 : position === "top" ? 1.2 : position === "left" ? -2 : 2;
  return (
    <div
      className="absolute whitespace-nowrap animate-scale-in"
      style={{
        ...placement,
        transform: `translateX(-50%) rotate(${tilt}deg)`,
        zIndex: 40,
        padding: "3px 10px",
        borderRadius: 999,
        background: "linear-gradient(180deg, oklch(0.22 0.04 40 / 96%) 0%, oklch(0.10 0.03 40 / 98%) 100%)",
        border: isTaker
          ? "1px solid oklch(0.85 0.16 82 / 85%)"
          : "1px solid oklch(0.78 0.13 82 / 55%)",
        boxShadow:
          "0 6px 14px -6px oklch(0 0 0 / 85%), inset 0 1px 0 oklch(1 0 0 / 12%), inset 0 -1px 0 oklch(0 0 0 / 55%)",
        color: "oklch(0.97 0.09 85)",
      }}
    >
      <span className="inline-flex items-center gap-1 font-serif font-bold" style={{ fontSize, lineHeight: 1, letterSpacing: "0.01em", textShadow: "0 1px 0 oklch(0 0 0 / 70%)" }}>
        {isTaker && <span style={{ fontSize: fontSize - 3 }}>👑</span>}
        <span style={{ color: isPass ? "oklch(0.9 0.06 85)" : "oklch(0.98 0.12 85)" }}>{label}</span>
        {suit && (
          <span
            aria-hidden
            style={{
              fontSize: fontSize + 2,
              lineHeight: 1,
              color: isRedSuit(suit) ? "#ff5b5b" : "#0f0f0f",
              textShadow: isRedSuit(suit)
                ? "0 0 1px oklch(0 0 0 / 70%)"
                : "0 0 1px oklch(1 0 0 / 45%)",
              fontWeight: 900,
            }}
          >
            {suit}
          </span>
        )}
      </span>
    </div>
  );
}


function IntegratedSuit({ symbol, color, style }: { symbol: string; color: "black" | "red"; style?: React.CSSProperties }) {
  const isRed = color === "red";
  return (
    <span style={{ position:"absolute", fontFamily:"ui-serif, Georgia, serif", lineHeight:1, color: isRed?"oklch(0.42 0.18 25)":"oklch(0.12 0.02 40)", opacity:0.22, mixBlendMode:"multiply", filter:"blur(0.3px)", ...style }}>{symbol}</span>
  );
}

function CardFace({ card }: { card: Card }) {
  const red = isRedSuit(card.suit);
  const color = red ? "oklch(0.5 0.19 25)" : "oklch(0.2 0.03 260)";
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ borderRadius:9, background:"linear-gradient(180deg, oklch(0.985 0.012 88) 0%, oklch(0.94 0.018 82) 100%)", border:"1px solid oklch(0.7 0.03 82)", boxShadow:"0 10px 18px -6px oklch(0 0 0 / 75%), 0 3px 6px -1px oklch(0 0 0 / 55%), inset 0 1px 0 oklch(1 0 0 / 75%), inset 0 -1px 0 oklch(0 0 0 / 18%), inset 0 0 12px oklch(0.5 0.06 60 / 12%)" }}>
      {/* subtle paper wear — soft warm vignette on the edges */}
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow:"inset 0 0 10px oklch(0.35 0.05 60 / 22%)" }} />
      <div className="absolute left-1.5 top-1 flex flex-col items-center leading-none" style={{ color }}>
        <span className="font-serif text-[20px] font-bold">{card.rank}</span>
        <span className="text-[18px]">{card.suit}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center" style={{ color }}>
        <span className="text-[46px] leading-none">{card.suit}</span>
      </div>
      <div className="absolute bottom-1 right-1.5 flex rotate-180 flex-col items-center leading-none" style={{ color }}>
        <span className="font-serif text-[20px] font-bold">{card.rank}</span>
        <span className="text-[18px]">{card.suit}</span>
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ borderRadius:7, background:"linear-gradient(160deg, oklch(0.32 0.11 25) 0%, oklch(0.18 0.06 25) 100%)", border:"1px solid oklch(0.55 0.14 78 / 60%)", boxShadow:"0 8px 14px -5px oklch(0 0 0 / 75%), 0 2px 4px oklch(0 0 0 / 55%), inset 0 1px 0 oklch(1 0 0 / 18%), inset 0 0 22px oklch(0 0 0 / 55%)" }}>
      {/* diamond guilloché weave */}
      <div className="absolute inset-1 rounded-[4px]" style={{ border:"1px solid oklch(0.72 0.14 82 / 55%)", backgroundImage:"repeating-linear-gradient(45deg, oklch(0.72 0.14 82 / 20%) 0 2px, transparent 2px 7px), repeating-linear-gradient(-45deg, oklch(0.72 0.14 82 / 14%) 0 2px, transparent 2px 7px)" }} />
      {/* inner gold hairline frame */}
      <div className="pointer-events-none absolute inset-[6px] rounded-[3px]" style={{ border:"1px solid oklch(0.82 0.14 82 / 45%)", boxShadow:"inset 0 0 0 1px oklch(0 0 0 / 35%)" }} />
      {/* subtle vintage wear: soft light noise + edge darkening, never dirty */}
      <div className="pointer-events-none absolute inset-0 opacity-25 mix-blend-overlay" style={{ backgroundImage:"radial-gradient(oklch(1 0 0 / 22%) 0.5px, transparent 0.6px), radial-gradient(oklch(0 0 0 / 30%) 0.5px, transparent 0.6px)", backgroundSize:"3px 3px, 5px 5px", backgroundPosition:"0 0, 1px 2px" }} />
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow:"inset 0 0 14px oklch(0 0 0 / 55%)" }} />
      {/* CAPI monogram — larger, metallic gold */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif font-black tracking-[0.22em]" style={{
          fontSize: "clamp(15px, 22%, 26px)",
          background: "linear-gradient(180deg, oklch(0.98 0.11 88) 0%, oklch(0.82 0.14 82) 45%, oklch(0.58 0.12 62) 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          filter: "drop-shadow(0 1px 0 oklch(0 0 0 / 70%)) drop-shadow(0 0 6px oklch(0.82 0.14 82 / 45%))",
        }}>CAPI</span>
      </div>
    </div>
  );
}

// --- Contract chips visualization ------------------------------------------
type ChipBreakdown = { largeBar: number; smallBar: number; rounds: number; capot: boolean };

// Breakdown from an arbitrary rounded score (multiples of 10).
// 100 = grande barrette, 50 = petite barrette, 10 = jeton rond.
function breakdownFromScore(score: number): ChipBreakdown {
  const s = Math.max(0, Math.round(score / 10) * 10);
  const largeBar = Math.floor(s / 100);
  let rem = s - largeBar * 100;
  const smallBar = rem >= 50 ? 1 : 0;
  rem -= smallBar * 50;
  const rounds = Math.round(rem / 10);
  return { largeBar, smallBar, rounds, capot: false };
}

function contractChipBreakdown(contract: Contract): ChipBreakdown {
  if (contract.isCapot) return { largeBar: 0, smallBar: 0, rounds: 0, capot: true };
  const p = contract.points;
  const largeBar = p >= 100 ? 1 : 0;
  const smallBar = p === 150 || p === 160 ? 1 : 0;
  let rounds = 0;
  if (p < 100) rounds = (p - 70) / 10; // 80->1, 90->2
  else if (p <= 140) rounds = (p - 100) / 10; // 100->0..140->4
  else rounds = p - 150; // 150->0, 160->1
  return { largeBar, smallBar, rounds, capot: false };
}

function ContractChips({ contract, slideTo }: { contract: Contract; slideTo?: Team | null }) {
  const b = contractChipBreakdown(contract);
  const suitColor = isRedSuit(contract.suit) ? "oklch(0.72 0.2 25)" : "oklch(0.18 0.02 40)";

  // Slides toward the same side as the winning team's stash so the handoff
  // reads as one continuous motion (A → bottom-right, B → top-left).
  const slideStyle: React.CSSProperties = slideTo
    ? {
        top: slideTo === "A" ? "78%" : "22%",
        left: slideTo === "A" ? "82%" : "18%",
        transform: "translate(-50%, -50%) scale(0.66)",
        opacity: 0.85,
      }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  const wrapperStyle: React.CSSProperties = {
    position: "absolute",
    ...slideStyle,
    transition: "transform 1200ms cubic-bezier(0.32, 0.72, 0.28, 1), top 1200ms cubic-bezier(0.32, 0.72, 0.28, 1), left 1200ms cubic-bezier(0.32, 0.72, 0.28, 1), opacity 800ms ease",
    zIndex: 30,
    pointerEvents: "none",
  };

  if (b.capot) {
    return (
      <div className="animate-scale-in" style={wrapperStyle}>
        <CapotChip suit={contract.suit} suitColor={suitColor} />
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <div className="relative flex flex-col items-center" style={{ gap: 4 }}>
        {b.largeBar > 0 && (
          <div className="animate-scale-in" style={{ animationDelay: "40ms", transform: `translateX(${seatJitter("bottom", 0, 3) * 4}px)` }}>
            <ChipBar width={52} height={13} tone="large" value={100} tilt={-6 + seatJitter("bottom", 1, 4) * 3} />
          </div>
        )}
        {b.smallBar > 0 && (
          <div className="animate-scale-in" style={{ animationDelay: "120ms", transform: `translateX(${seatJitter("bottom", 2, 3) * 5}px)` }}>
            <ChipBar width={26} height={11} tone="small" value={50} tilt={7 + seatJitter("bottom", 3, 4) * 3} />
          </div>
        )}
        {b.rounds > 0 && (
          <div className="flex items-center" style={{ gap: 3 }}>
            {Array.from({ length: b.rounds }).map((_, i) => (
              <div
                key={i}
                className="animate-scale-in"
                style={{
                  animationDelay: `${180 + i * 70}ms`,
                  transform: `translate(${seatJitter("bottom", i, 6) * 3}px, ${seatJitter("bottom", i, 8) * 3}px) rotate(${((i * 37) % 17) - 8}deg)`,
                }}
              >
                <RoundChip index={i} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TableScoreBadge({ team, label, value, pulse }: { team: Team; label: string; value: number; pulse: boolean }) {
  const color = team === "A" ? "oklch(0.72 0.16 55)" : "oklch(0.62 0.16 240)";
  const style: React.CSSProperties =
    team === "A"
      ? { left: "50%", top: "88%", transform: "translate(-50%, -50%)" }
      : { left: "8%", top: "50%", transform: "translate(-50%, -50%)" };
  return (
    <div
      className="pointer-events-none absolute z-[25] flex items-center gap-1.5 rounded-full border px-2.5 py-1"
      style={{
        ...style,
        background: "oklch(0.14 0.03 40 / 85%)",
        borderColor: pulse ? "oklch(0.88 0.16 82 / 90%)" : "oklch(0.82 0.14 82 / 45%)",
        boxShadow: pulse
          ? "0 0 0 2px oklch(0.85 0.14 82 / 45%), 0 0 22px -2px oklch(0.85 0.14 82 / 75%), 0 6px 14px -6px oklch(0 0 0 / 75%)"
          : "0 6px 14px -6px oklch(0 0 0 / 75%), inset 0 1px 0 oklch(1 0 0 / 10%)",
        backdropFilter: "blur(8px)",
        color: "oklch(0.94 0.1 85)",
        transition: "box-shadow 400ms ease, border-color 400ms ease",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <span className="uppercase tracking-[0.18em]" style={{ fontSize: 9 }}>{label}</span>
      <span className="font-serif text-sm font-semibold" style={{ minWidth: 22, textAlign: "right" }}>{value}</span>
    </div>
  );
}


function ChipBar({ width, height, tone, value, tilt = 0 }: { width: number; height: number; tone: "large" | "small"; value: number; tilt?: number }) {
  const bg = tone === "large"
    ? "linear-gradient(180deg, oklch(0.58 0.19 28) 0%, oklch(0.44 0.17 28) 50%, oklch(0.3 0.13 28) 100%)"
    : "linear-gradient(180deg, oklch(0.72 0.16 240) 0%, oklch(0.55 0.15 240) 50%, oklch(0.38 0.13 240) 100%)";
  // Rectangular with tiny chamfered corners (bevel), flat top.
  const bevel = Math.max(2, Math.round(height * 0.18));
  const clip = `polygon(${bevel}px 0, calc(100% - ${bevel}px) 0, 100% ${bevel}px, 100% calc(100% - ${bevel}px), calc(100% - ${bevel}px) 100%, ${bevel}px 100%, 0 calc(100% - ${bevel}px), 0 ${bevel}px)`;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width, height,
        background: bg,
        clipPath: clip,
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        boxShadow: "0 4px 8px -3px oklch(0 0 0 / 55%), 0 1px 0 oklch(1 0 0 / 22%) inset, 0 -1px 0 oklch(0 0 0 / 40%) inset",
      }}
    >
      {/* engraved number */}
      <span
        className="font-serif font-bold select-none"
        style={{
          fontSize: Math.round(height * 0.62),
          lineHeight: 1,
          letterSpacing: "0.04em",
          color: "oklch(0.18 0.05 30 / 85%)",
          textShadow:
            "0 1px 0 oklch(1 0 0 / 22%), 0 -1px 0 oklch(0 0 0 / 55%)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function RoundChip({ index }: { index: number }) {
  const palette = [
    "linear-gradient(180deg, oklch(0.94 0.02 90) 0%, oklch(0.78 0.02 90) 100%)",
    "linear-gradient(180deg, oklch(0.55 0.18 28) 0%, oklch(0.35 0.14 28) 100%)",
    "linear-gradient(180deg, oklch(0.32 0.09 250) 0%, oklch(0.22 0.08 250) 100%)",
    "linear-gradient(180deg, oklch(0.45 0.16 150) 0%, oklch(0.3 0.12 150) 100%)",
  ];
  const bg = palette[index % palette.length];
  return (
    <div
      className="relative"
      style={{
        width: 15, height: 15, borderRadius: "50%",
        background: bg,
        border: "1.5px solid oklch(0.85 0.14 82 / 75%)",
        boxShadow: "0 3px 6px -2px oklch(0 0 0 / 55%), 0 1px 0 oklch(1 0 0 / 30%) inset",
      }}
    >
      <div className="absolute inset-1 rounded-full" style={{ border: "1px dashed oklch(0.9 0.14 82 / 55%)" }} />
    </div>
  );
}

function CapotChip({ suit, suitColor }: { suit: Suit; suitColor: string }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: 76, height: 76, borderRadius: "50%",
        background: "radial-gradient(circle at 35% 30%, oklch(0.55 0.2 25) 0%, oklch(0.35 0.17 25) 55%, oklch(0.22 0.13 25) 100%)",
        border: "2px solid oklch(0.82 0.16 82)",
        boxShadow: "0 8px 18px -5px oklch(0 0 0 / 70%), 0 2px 0 oklch(1 0 0 / 25%) inset, 0 -2px 0 oklch(0 0 0 / 45%) inset, 0 0 0 1px oklch(0.55 0.14 78 / 60%)",
      }}
    >
      <div
        className="absolute inset-1.5 rounded-full"
        style={{ border: "1.5px dashed oklch(0.88 0.15 82 / 70%)" }}
      />
      <div className="flex flex-col items-center leading-none">
        <span
          className="font-serif text-[16px] font-bold"
          style={{ color: "oklch(0.94 0.14 82)", textShadow: "0 1px 0 oklch(0 0 0 / 60%)" }}
        >
          CAPI
        </span>
        <span
          className="mt-0.5 text-[8px] font-bold tracking-[0.18em]"
          style={{ color: "oklch(0.94 0.14 82)" }}
        >
          CAPOT
        </span>
        <span className="mt-0.5 text-[11px]" style={{ color: suitColor }}>{suit}</span>
      </div>
    </div>
  );
}

function SuitBadge({ suit, size = 20 }: { suit: Suit; size?: number }) {
  const red = isRedSuit(suit);
  return (
    <span
      className="inline-flex items-center justify-center rounded-md"
      style={{
        width: size + 6,
        height: size + 6,
        background: "linear-gradient(180deg, oklch(0.99 0.01 90) 0%, oklch(0.92 0.01 85) 100%)",
        border: "1px solid oklch(0.72 0.02 85)",
        boxShadow: "0 1px 2px oklch(0 0 0 / 45%), inset 0 1px 0 oklch(1 0 0 / 60%)",
        color: red ? "#dc2626" : "#0a0a0a",
        fontSize: size,
        lineHeight: 1,
        fontWeight: 700,
        textShadow: red ? "0 0 1px oklch(0.45 0.2 25 / 30%)" : "none",
      }}
    >
      {suit}
    </span>
  );
}

function TeamStash({ team, stash }: { team: Team; stash: ChipBreakdown[] }) {
  if (stash.length === 0) return null;
  // Chips sit ON THE FELT to the side of each team — well clear of the
  // trick pile and the players' cards. Team A → bottom-right of the felt,
  // Team B → top-left. Each round adds a small scattered pile, slightly
  // rotated and offset like real chips pushed aside after a hand.
  const style: React.CSSProperties =
    team === "A"
      ? { right: "6%", bottom: "10%", width: "34%" }
      : { left: "6%", top: "10%", width: "34%" };
  return (
    <div
      className="pointer-events-none absolute z-[22] flex flex-wrap gap-1.5"
      style={{ ...style, justifyContent: team === "A" ? "flex-end" : "flex-start" }}
    >
      {stash.map((b, i) => {
        const tilt = ((i * 53) % 17) - 8;
        const dx = seatJitter(team === "A" ? "bottom" : "top", i, 21) * 5;
        const dy = seatJitter(team === "A" ? "bottom" : "top", i, 23) * 4 - (i % 3) * 2;
        return (
          <div
            key={i}
            className="flex flex-col items-center animate-scale-in"
            style={{
              gap: 2,
              transform: `translate(${dx}px, ${dy}px) rotate(${tilt}deg)`,
            }}
          >
            {b.capot && <CapotChip suit={"♠"} suitColor="oklch(0.94 0.14 82)" />}
            {!b.capot && b.largeBar > 0 && (
              <ChipBar width={42} height={11} tone="large" value={100} tilt={-4 + seatJitter("top", i, 31) * 3} />
            )}
            {!b.capot && b.smallBar > 0 && (
              <ChipBar width={21} height={9} tone="small" value={50} tilt={5 + seatJitter("top", i, 33) * 3} />
            )}
            {!b.capot && b.rounds > 0 && (
              <div className="flex items-center" style={{ gap: 2 }}>
                {Array.from({ length: b.rounds }).map((_, j) => (
                  <div key={j} style={{ transform: `translateY(${seatJitter("top", j + i * 7, 37) * 2}px) rotate(${((j * 41) % 19) - 9}deg)` }}>
                    <RoundChip index={j} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
