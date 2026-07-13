import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Shuffle, Check } from "lucide-react";
import bistrotTable from "@/assets/capi-bistrot-table.jpg";
import { buildDeck, isRedSuit, shuffle, type Card } from "@/lib/deck";

export const Route = createFileRoute("/partie")({
  head: () => ({
    meta: [
      { title: "Partie — CAPI" },
      {
        name: "description",
        content: "Table de Contrée en cours : distribution des 32 cartes autour de la table.",
      },
      { property: "og:title", content: "Partie — CAPI" },
      { property: "og:description", content: "Distribution en direct des cartes de Contrée." },
    ],
  }),
  component: GameTable,
});

type Position = "bottom" | "left" | "top" | "right";

const POSITIONS: Position[] = ["bottom", "left", "top", "right"];

type PlayerInfo = { name: string; level: number; photo: string };

const PLAYERS: Record<Position, PlayerInfo> = {
  bottom: { name: "Vous", level: 22, photo: "https://i.pravatar.cc/200?img=12" },
  left: { name: "Bot Margaux", level: 15, photo: "https://i.pravatar.cc/200?img=47" },
  top: { name: "Bot Jean-Luc", level: 18, photo: "https://i.pravatar.cc/200?img=68" },
  right: { name: "Bot Alex", level: 12, photo: "https://i.pravatar.cc/200?img=15" },
};

// Bigger, more readable cards
const CARD_W_BIG = 82;
const CARD_H_BIG = 120;
const CARD_W_SMALL = 44;
const CARD_H_SMALL = 64;

const FLIGHT_MS = 420;
const CUT_MS = 2100;
const SHUFFLE_MS = 2600;

type DealMode = "3-2-3" | "2-3-3" | "3-3-2";
type Phase = "shuffle" | "shuffling" | "cut" | "mode" | "dealing" | "done";

type Dealt = {
  card: Card;
  seat: Position;
  indexInHand: number;
  batchIndex: number;
};

function nextClockwise(p: Position): Position {
  return POSITIONS[(POSITIONS.indexOf(p) + 1) % 4];
}
function prevClockwise(p: Position): Position {
  return POSITIONS[(POSITIONS.indexOf(p) + 3) % 4];
}

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
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 700;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.11 + Math.random() * 0.03, now);
  g.gain.exponentialRampToValueAtTime(0.0005, now + dur);
  src.connect(bp).connect(hp).connect(g).connect(ctx.destination);
  src.start(now);
  src.stop(now + dur);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(160, now + dur * 0.75);
  osc.frequency.exponentialRampToValueAtTime(80, now + dur + 0.05);
  const oGain = ctx.createGain();
  oGain.gain.setValueAtTime(0.045, now + dur * 0.75);
  oGain.gain.exponentialRampToValueAtTime(0.0005, now + dur + 0.06);
  osc.connect(oGain).connect(ctx.destination);
  osc.start(now + dur * 0.75);
  osc.stop(now + dur + 0.08);
}

// Burst of paper riffle — many short high-frequency ticks
function playRiffleBurst() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const dur = 0.55;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    // Multiple ticks along the duration
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

  // Thud
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(110, now + 0.08);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.24);
  const oG = ctx.createGain();
  oG.gain.setValueAtTime(0.09, now + 0.08);
  oG.gain.exponentialRampToValueAtTime(0.0005, now + 0.26);
  osc.connect(oG).connect(ctx.destination);
  osc.start(now + 0.08);
  osc.stop(now + 0.28);
}

// --- Component -------------------------------------------------------------

function GameTable() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dealtCount, setDealtCount] = useState(0);
  const [dealSeed, setDealSeed] = useState(0);
  const [dealer, setDealer] = useState<Position>("bottom");
  const [phase, setPhase] = useState<Phase>("shuffle");
  const [cutStep, setCutStep] = useState<0 | 1 | 2>(0);
  const [dealMode, setDealMode] = useState<DealMode | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const cutter = prevClockwise(dealer);

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
    for (const size of pattern) {
      for (let seatOffset = 0; seatOffset < 4; seatOffset++) {
        const seat = POSITIONS[(start + seatOffset) % 4];
        for (let c = 0; c < size; c++) {
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

  useEffect(() => {
    setPhase("shuffle");
    setCutStep(0);
    setDealtCount(0);
    setDealMode(null);
    setSelectedCardId(null);
  }, [dealSeed, dealer]);

  // Dealing loop — batch-aware timing (packets)
  useEffect(() => {
    if (size.w === 0 || phase !== "dealing" || !dealMode) return;
    const timers: number[] = [];
    let cumulative = 0;
    for (let k = 0; k < dealOrder.length; k++) {
      const prev = dealOrder[k - 1];
      const cur = dealOrder[k];
      const batchChanged = !prev || prev.batchIndex !== cur.batchIndex;
      // Within a packet: fast successive slides (~110-160ms).
      // Between packets (seat change): ~380ms wrist reset.
      const step = k === 0 ? 260 : batchChanged ? 380 + Math.random() * 90 : 115 + Math.random() * 55;
      cumulative += step;
      const stepIdx = k + 1;
      timers.push(
        window.setTimeout(() => {
          setDealtCount(stepIdx);
          playCardSound();
        }, cumulative),
      );
    }
    timers.push(window.setTimeout(() => setPhase("done"), cumulative + FLIGHT_MS + 300));
    return () => timers.forEach(clearTimeout);
  }, [phase, dealMode, dealOrder, size.w]);

  const anchors = useMemo(() => {
    const w = size.w || 1;
    const h = size.h || 1;
    return {
      bottom: { x: w * 0.5, y: h - 28, angle: 0 },
      top: { x: w * 0.5, y: 28, angle: 180 },
      left: { x: 22, y: h * 0.5, angle: 90 },
      right: { x: w - 22, y: h * 0.5, angle: -90 },
    } as const;
  }, [size]);

  const deckBase = useMemo(() => {
    const a = anchors[dealer];
    const cx = (size.w || 0) / 2;
    const cy = (size.h || 0) / 2;
    const dx = cx - a.x;
    const dy = cy - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const inset = dealer === "bottom" || dealer === "top" ? 128 : 112;
    return { x: a.x + (dx / len) * inset, y: a.y + (dy / len) * inset, angle: a.angle };
  }, [anchors, dealer, size]);

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

  const computeTarget = (d: Dealt) => {
    const isBottom = d.seat === "bottom";
    const cardW = isBottom ? CARD_W_BIG : CARD_W_SMALL;
    const cardH = isBottom ? CARD_H_BIG : CARD_H_SMALL;
    const a = anchors[d.seat];
    const n = 8;
    // Wider, more readable fan for the local player
    const spread = isBottom ? 62 : 26;
    const step = spread / (n - 1);
    const localAngle = -spread / 2 + step * d.indexInHand;
    // Fan sits close to each seated player.
    const radius = isBottom ? 100 : 46;
    const rad = (localAngle * Math.PI) / 180;
    const lx = Math.sin(rad) * radius;
    const ly = -Math.cos(rad) * radius;
    const seatRad = (a.angle * Math.PI) / 180;
    const rx = lx * Math.cos(seatRad) - ly * Math.sin(seatRad);
    const ry = lx * Math.sin(seatRad) + ly * Math.cos(seatRad);
    return {
      x: a.x + rx,
      y: a.y + ry,
      rotate: localAngle + a.angle + (Math.random() < 0.5 ? -1 : 1) * (isBottom ? 0.5 : 2),
      w: cardW,
      h: cardH,
      localAngle,
      seatAngle: a.angle,
    };
  };

  const targetsRef = useRef<Record<string, ReturnType<typeof computeTarget>>>({});
  useEffect(() => {
    targetsRef.current = {};
  }, [dealSeed, dealer, size.w, dealMode]);

  const nextRound = () => {
    setDealer((d) => nextClockwise(d));
    setDealSeed((s) => s + 1);
  };

  const doShuffle = (really: boolean) => {
    if (!really) {
      setPhase("cut");
      setCutStep(0);
      const t0 = window.setTimeout(() => {
        setCutStep(1);
        playCutSound();
      }, 550);
      const t1 = window.setTimeout(() => setCutStep(2), 550 + 800);
      const t2 = window.setTimeout(() => setPhase("mode"), CUT_MS);
      return () => [t0, t1, t2].forEach(clearTimeout);
    }
    setPhase("shuffling");
    // Multiple riffle bursts throughout the animation
    playRiffleBurst();
    const s1 = window.setTimeout(() => playRiffleBurst(), 850);
    const s2 = window.setTimeout(() => playRiffleBurst(), 1700);
    window.setTimeout(() => {
      setPhase("cut");
      setCutStep(0);
      window.setTimeout(() => {
        setCutStep(1);
        playCutSound();
      }, 550);
      window.setTimeout(() => setCutStep(2), 550 + 800);
      window.setTimeout(() => setPhase("mode"), CUT_MS);
    }, SHUFFLE_MS);
    return () => [s1, s2].forEach(clearTimeout);
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
          ? "Vous distribuez"
          : "Distribution";

  const handleCardClick = (cardId: string, seat: Position) => {
    if (phase !== "done" || seat !== "bottom") return;
    setSelectedCardId((prev) => (prev === cardId ? null : cardId));
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Inline keyframes for shuffle */}
      <style>{`
        @keyframes capi-riffle {
          0%   { transform: translate(-42px, 0) rotate(-6deg); }
          18%  { transform: translate(-42px, -8px) rotate(-6deg); }
          32%  { transform: translate(-6px, -2px) rotate(-1deg); }
          50%  { transform: translate(2px, 0) rotate(0deg); }
          62%  { transform: translate(-38px, -6px) rotate(-4deg); }
          78%  { transform: translate(-4px, -1px) rotate(-0.5deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes capi-riffle-r {
          0%   { transform: translate(42px, 0) rotate(6deg); }
          18%  { transform: translate(42px, -8px) rotate(6deg); }
          32%  { transform: translate(6px, -2px) rotate(1deg); }
          50%  { transform: translate(-2px, 0) rotate(0deg); }
          62%  { transform: translate(38px, -6px) rotate(4deg); }
          78%  { transform: translate(4px, -1px) rotate(0.5deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes capi-riffle-tick {
          0%, 30%, 60% { transform: translateY(0) rotate(0deg); }
          10%, 40%, 70% { transform: translateY(-4px) rotate(-1.5deg); }
          20%, 50%, 80% { transform: translateY(0) rotate(0deg); }
        }
      `}</style>

      <img
        src={bistrotTable}
        alt=""
        width={1024}
        height={1536}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 35% at 50% 0%, oklch(0.85 0.14 75 / 32%) 0%, oklch(0.7 0.12 65 / 12%) 40%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 50%, transparent 0%, oklch(0 0 0 / 45%) 60%, oklch(0.08 0.02 40 / 94%) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.12 0.03 40 / 72%) 0%, transparent 22%, transparent 55%, oklch(0.08 0.02 40 / 92%) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pt-4 pb-4">
        <header className="flex items-center justify-between">
          <Link
            to="/salle-attente"
            className="flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-95"
            style={{
              background: "oklch(0.2 0.03 40 / 60%)",
              borderColor: "oklch(0.82 0.14 82 / 30%)",
              backdropFilter: "blur(8px)",
              color: "oklch(0.9 0.1 85)",
            }}
            aria-label="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1
            className="font-serif text-lg font-semibold tracking-wide"
            style={{
              background: "linear-gradient(180deg, oklch(0.95 0.1 88), oklch(0.72 0.14 78))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              textShadow: "0 1px 0 oklch(0 0 0 / 40%)",
            }}
          >
            {phaseTitle}
          </h1>
          <button
            type="button"
            onClick={nextRound}
            className="flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-95"
            style={{
              background: "oklch(0.2 0.03 40 / 60%)",
              borderColor: "oklch(0.82 0.14 82 / 30%)",
              backdropFilter: "blur(8px)",
              color: "oklch(0.9 0.1 85)",
            }}
            aria-label="Manche suivante"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </header>

        <div ref={boxRef} className="relative mx-auto mt-3 w-full max-w-[420px] flex-1">
          <div className="relative mx-auto aspect-square w-full">
            <div
              className="absolute inset-[4%] overflow-hidden"
              style={{
                borderRadius: "14%",
                background:
                  "radial-gradient(ellipse 120% 90% at 30% 20%, oklch(0.52 0.11 55) 0%, oklch(0.42 0.10 48) 35%, oklch(0.30 0.08 42) 70%, oklch(0.20 0.06 38) 100%)",
                boxShadow:
                  "0 32px 60px -18px oklch(0 0 0 / 85%), 0 12px 22px -10px oklch(0 0 0 / 60%), inset 0 2px 0 oklch(1 0 0 / 14%), inset 0 -14px 26px oklch(0 0 0 / 55%)",
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-70 mix-blend-overlay"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(92deg, oklch(0 0 0 / 10%) 0 1px, transparent 1px 5px), repeating-linear-gradient(88deg, oklch(1 0 0 / 4%) 0 1px, transparent 1px 11px), repeating-linear-gradient(94deg, oklch(0 0 0 / 6%) 0 2px, transparent 2px 34px)",
                }}
              />
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  background:
                    "linear-gradient(150deg, oklch(1 0 0 / 8%) 0%, transparent 35%, transparent 65%, oklch(0 0 0 / 18%) 100%)",
                }}
              />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  boxShadow:
                    "inset 0 0 0 1px oklch(0 0 0 / 55%), inset 0 0 0 2px oklch(1 0 0 / 7%)",
                }}
              />
            </div>

            <div
              className="absolute overflow-hidden"
              style={{
                left: "14%",
                right: "14%",
                top: "14%",
                bottom: "14%",
                transform: "rotate(-1.2deg)",
                borderRadius: "6%",
                background:
                  "linear-gradient(162deg, oklch(0.32 0.09 152) 0%, oklch(0.27 0.08 152) 55%, oklch(0.22 0.07 150) 100%)",
                boxShadow:
                  "0 3px 6px -2px oklch(0 0 0 / 45%), 0 1px 2px oklch(0 0 0 / 40%), inset 0 0 0 1px oklch(0 0 0 / 25%)",
              }}
            >
              <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.12 }}>
                <IntegratedSuit symbol="♠" color="black" style={{ left: "6%", top: "5%", fontSize: 58, transform: "rotate(-14deg)" }} />
                <IntegratedSuit symbol="♥" color="red" style={{ right: "6%", top: "5%", fontSize: 58, transform: "rotate(12deg)" }} />
                <IntegratedSuit symbol="♦" color="red" style={{ left: "6%", bottom: "5%", fontSize: 58, transform: "rotate(10deg)" }} />
                <IntegratedSuit symbol="♣" color="black" style={{ right: "6%", bottom: "5%", fontSize: 58, transform: "rotate(-10deg)" }} />
              </div>
              <div
                className="pointer-events-none absolute inset-0 opacity-70 mix-blend-overlay"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, oklch(1 0 0 / 4%) 0 1px, transparent 1px 2px), repeating-linear-gradient(-45deg, oklch(0 0 0 / 8%) 0 1px, transparent 1px 2px)",
                }}
              />
            </div>

            {POSITIONS.map((p) => (
              <PlayerBadge
                key={p}
                position={p}
                info={PLAYERS[p]}
                isDealer={p === dealer}
                isLocal={p === "bottom"}
              />
            ))}

            {/* Cut label */}
            {phase === "cut" && (
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-4 py-2 text-[12px] font-medium animate-fade-in"
                style={{
                  background: "oklch(0.18 0.03 40 / 88%)",
                  borderColor: "oklch(0.82 0.14 82 / 40%)",
                  color: "oklch(0.94 0.1 85)",
                  backdropFilter: "blur(8px)",
                  textShadow: "0 1px 2px oklch(0 0 0 / 60%)",
                }}
              >
                À {PLAYERS[cutter].name} de couper le paquet
              </div>
            )}

            {/* Shuffle animation — visible packet riffling */}
            {phase === "shuffling" && size.w > 0 && (
              <ShuffleAnimation deckPos={deckBase} />
            )}

            {/* Shuffle choice */}
            {phase === "shuffle" && size.w > 0 && (
              <ChoicePanel
                title={`${PLAYERS[dealer].name} distribue`}
                subtitle="Mélanger les cartes ?"
                options={[
                  { key: "shuffle", label: "Mélanger", icon: <Shuffle className="h-4 w-4" />, onClick: () => doShuffle(true), primary: true },
                  { key: "no", label: "Ne pas mélanger", icon: <Check className="h-4 w-4" />, onClick: () => doShuffle(false) },
                ]}
              />
            )}

            {/* Mode choice — 3 options in canonical order */}
            {phase === "mode" && size.w > 0 && (
              <ChoicePanel
                title="Vous distribuez"
                subtitle="Choisissez la distribution"
                options={(["3-2-3", "2-3-3", "3-3-2"] as DealMode[]).map((m) => ({
                  key: m,
                  label: m,
                  onClick: () => chooseMode(m),
                  primary: true,
                }))}
              />
            )}

            {(phase === "cut" || phase === "dealing") && (
              <DeckStack
                deckPos={deckPos}
                cutStep={phase === "cut" ? cutStep : 2}
                remaining={32 - dealtCount}
              />
            )}

            {/* Cards */}
            {dealOrder.map((d, i) => {
              const isDealt = i < dealtCount && phase !== "cut";
              if (!targetsRef.current[d.card.id]) {
                targetsRef.current[d.card.id] = computeTarget(d);
              }
              const target = targetsRef.current[d.card.id];
              const isSelected = selectedCardId === d.card.id;
              // Lift the selected card perpendicular to its own local direction
              let liftX = 0;
              let liftY = 0;
              if (isSelected) {
                const seatRad = (target.seatAngle * Math.PI) / 180;
                // "up" in seat local frame = -Y
                liftX = Math.sin(seatRad) * 0 - -1 * Math.sin(seatRad + Math.PI) * 0; // no-op guard
                const upX = -Math.sin(seatRad + Math.PI);
                const upY = Math.cos(seatRad + Math.PI);
                liftX = upX * 22;
                liftY = upY * 22;
              }
              const x = isDealt ? target.x + liftX : deckPos.x;
              const y = isDealt ? target.y + liftY : deckPos.y;
              const rotate = isDealt ? target.rotate : deckPos.angle + (i % 2 === 0 ? -1.5 : 1.5);
              const w = target.w;
              const h = target.h;
              const showFace = isDealt && d.seat === "bottom";
              const z = isDealt
                ? (isSelected ? 400 : 100 + d.indexInHand + (d.seat === "bottom" ? 50 : 0))
                : 20 + (32 - i);
              const visible = isDealt || phase === "dealing";
              const clickable = phase === "done" && d.seat === "bottom";
              return (
                <div
                  key={d.card.id}
                  className={`absolute left-0 top-0 ${clickable ? "cursor-pointer" : ""}`}
                  onClick={clickable ? () => handleCardClick(d.card.id, d.seat) : undefined}
                  style={{
                    width: w,
                    height: h,
                    transform: `translate3d(${x - w / 2}px, ${y - h / 2}px, 0) rotate(${rotate}deg)`,
                    transition: `transform ${isSelected ? 180 : FLIGHT_MS}ms cubic-bezier(0.22, 0.7, 0.25, 1)`,
                    zIndex: z,
                    willChange: "transform",
                    opacity: visible ? 1 : 0,
                    filter: isSelected
                      ? "drop-shadow(0 10px 14px oklch(0 0 0 / 55%)) drop-shadow(0 0 8px oklch(0.85 0.14 82 / 55%))"
                      : undefined,
                  }}
                >
                  {showFace ? <CardFace card={d.card} /> : <CardBack />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

// --- Shuffle animation -----------------------------------------------------

function ShuffleAnimation({ deckPos }: { deckPos: { x: number; y: number; angle: number } }) {
  const w = 46;
  const h = 66;
  const layers = 8;
  return (
    <div
      className="pointer-events-none absolute left-0 top-0"
      style={{
        transform: `translate3d(${deckPos.x - w / 2}px, ${deckPos.y - h / 2}px, 0) rotate(${deckPos.angle}deg)`,
        zIndex: 60,
        width: w,
        height: h,
      }}
    >
      {/* Left half riffling */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          animation: "capi-riffle 900ms cubic-bezier(0.4, 0.1, 0.3, 1) 3",
        }}
      >
        {Array.from({ length: layers }).map((_, i) => (
          <div
            key={`L${i}`}
            style={{
              position: "absolute",
              inset: 0,
              transform: `translate(${-i * 0.5}px, ${-i * 0.9}px)`,
              animation: `capi-riffle-tick 900ms ease-in-out ${i * 40}ms infinite`,
            }}
          >
            <CardBack />
          </div>
        ))}
      </div>
      {/* Right half riffling */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          animation: "capi-riffle-r 900ms cubic-bezier(0.4, 0.1, 0.3, 1) 3",
        }}
      >
        {Array.from({ length: layers }).map((_, i) => (
          <div
            key={`R${i}`}
            style={{
              position: "absolute",
              inset: 0,
              transform: `translate(${i * 0.5}px, ${-i * 0.9}px)`,
              animation: `capi-riffle-tick 900ms ease-in-out ${i * 40 + 20}ms infinite`,
            }}
          >
            <CardBack />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChoicePanel({
  title,
  subtitle,
  options,
}: {
  title: string;
  subtitle: string;
  options: { key: string; label: string; icon?: React.ReactNode; onClick: () => void; primary?: boolean }[];
}) {
  return (
    <div className="absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 animate-fade-in">
      <div
        className="rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.22em]"
        style={{
          background: "oklch(0.18 0.03 40 / 88%)",
          borderColor: "oklch(0.82 0.14 82 / 40%)",
          color: "oklch(0.94 0.1 85)",
          backdropFilter: "blur(8px)",
        }}
      >
        {title}
      </div>
      <div
        className="text-[12px]"
        style={{ color: "oklch(0.88 0.07 82 / 90%)", textShadow: "0 1px 2px oklch(0 0 0 / 65%)" }}
      >
        {subtitle}
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={o.onClick}
            className="flex items-center gap-1.5 rounded-2xl border px-4 py-2.5 font-serif text-sm font-semibold tracking-wide transition active:scale-[0.97]"
            style={{
              background: o.primary
                ? "linear-gradient(168deg, oklch(0.36 0.10 152) 0%, oklch(0.24 0.08 152) 100%)"
                : "linear-gradient(168deg, oklch(0.24 0.04 42) 0%, oklch(0.16 0.03 40) 100%)",
              borderColor: "oklch(0.82 0.14 82 / 45%)",
              boxShadow:
                "0 10px 22px -12px oklch(0 0 0 / 70%), inset 0 1px 0 oklch(1 0 0 / 12%), inset 0 -6px 12px oklch(0 0 0 / 35%)",
            }}
          >
            {o.icon ? (
              <span style={{ color: "oklch(0.94 0.11 88)" }}>{o.icon}</span>
            ) : null}
            <span
              style={{
                background: "linear-gradient(180deg, oklch(0.96 0.1 88), oklch(0.72 0.14 78))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                textShadow: "0 1px 0 oklch(0 0 0 / 40%)",
              }}
            >
              {o.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DeckStack({
  deckPos,
  cutStep,
  remaining,
}: {
  deckPos: { x: number; y: number; angle: number };
  cutStep: 0 | 1 | 2;
  remaining: number;
}) {
  if (remaining <= 0) return null;
  const w = 46;
  const h = 66;
  const splitOffset = cutStep === 1 ? 52 : 0;
  const topZ = cutStep === 2 ? 1 : 3;
  const bottomZ = cutStep === 2 ? 3 : 1;
  const rad = (deckPos.angle * Math.PI) / 180;
  const ox = Math.cos(rad) * splitOffset;
  const oy = Math.sin(rad) * splitOffset;
  return (
    <>
      <div
        className="absolute left-0 top-0"
        style={{
          width: w,
          height: h,
          transform: `translate3d(${deckPos.x - w / 2 - ox}px, ${deckPos.y - h / 2 - oy}px, 0) rotate(${deckPos.angle}deg)`,
          transition: "transform 650ms cubic-bezier(0.22, 0.7, 0.25, 1)",
          zIndex: bottomZ + 40,
        }}
      >
        <DeckSlab count={Math.min(remaining, 16)} />
      </div>
      <div
        className="absolute left-0 top-0"
        style={{
          width: w,
          height: h,
          transform: `translate3d(${deckPos.x - w / 2 + ox}px, ${deckPos.y - h / 2 + oy}px, 0) rotate(${deckPos.angle}deg)`,
          transition: "transform 650ms cubic-bezier(0.22, 0.7, 0.25, 1)",
          zIndex: topZ + 40,
        }}
      >
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
        <div key={i} className="absolute inset-0" style={{ transform: `translate(${i * 0.6}px, ${-i * 0.8}px)` }}>
          <CardBack />
        </div>
      ))}
    </div>
  );
}

function PlayerBadge({
  position,
  info,
  isDealer,
  isLocal,
}: {
  position: Position;
  info: PlayerInfo;
  isDealer: boolean;
  isLocal: boolean;
}) {
  const style: React.CSSProperties =
    position === "bottom"
      ? { left: "50%", bottom: 0, transform: "translate(-50%, 55%)" }
      : position === "top"
        ? { left: "50%", top: 0, transform: "translate(-50%, -55%)" }
        : position === "left"
          ? { left: 0, top: "50%", transform: "translate(-55%, -50%)" }
          : { right: 0, top: "50%", transform: "translate(55%, -50%)" };

  const team = position === "bottom" || position === "top" ? "A" : "B";
  const ring =
    team === "A" ? "oklch(0.72 0.16 55 / 85%)" : "oklch(0.62 0.16 240 / 85%)";
  const avatarSize = isLocal ? 56 : 48;

  return (
    <div
      className="pointer-events-none absolute z-20 flex flex-col items-center gap-1"
      style={style}
    >
      <div className="relative">
        <div
          className="overflow-hidden rounded-full border-2"
          style={{
            width: avatarSize,
            height: avatarSize,
            borderColor: ring,
            background:
              "linear-gradient(160deg, oklch(0.38 0.05 40), oklch(0.24 0.04 40))",
            boxShadow: `0 6px 14px -6px oklch(0 0 0 / 75%), 0 0 0 2px oklch(0 0 0 / 45%), 0 0 10px -3px ${ring.replace("85%", "40%")}`,
          }}
        >
          <img
            src={info.photo}
            alt={info.name}
            width={200}
            height={200}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        {isDealer && (
          <span
            className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold"
            style={{
              background: "linear-gradient(180deg, oklch(0.9 0.14 88), oklch(0.65 0.16 72))",
              color: "oklch(0.2 0.05 40)",
              boxShadow:
                "0 2px 4px oklch(0 0 0 / 60%), 0 0 0 1px oklch(0.4 0.08 55) inset",
            }}
            aria-label="Donneur"
            title="Donneur"
          >
            D
          </span>
        )}
      </div>
      <div className="flex flex-col items-center leading-tight">
        <span
          className="font-serif text-[11px] font-semibold tracking-wide"
          style={{ color: "oklch(0.95 0.08 85)", textShadow: "0 1px 2px oklch(0 0 0 / 80%)" }}
        >
          {info.name}
        </span>
        <span
          className="text-[9px] uppercase tracking-[0.2em]"
          style={{ color: "oklch(0.82 0.08 82 / 85%)" }}
        >
          Niv. {info.level}
        </span>
      </div>
    </div>
  );
}

function IntegratedSuit({
  symbol,
  color,
  style,
}: {
  symbol: string;
  color: "black" | "red";
  style?: React.CSSProperties;
}) {
  const isRed = color === "red";
  return (
    <span
      style={{
        position: "absolute",
        fontFamily: "ui-serif, Georgia, serif",
        lineHeight: 1,
        color: isRed ? "oklch(0.42 0.18 25)" : "oklch(0.12 0.02 40)",
        opacity: 0.22,
        mixBlendMode: "multiply",
        filter: "blur(0.3px)",
        ...style,
      }}
    >
      {symbol}
    </span>
  );
}

function CardFace({ card }: { card: Card }) {
  const red = isRedSuit(card.suit);
  const color = red ? "oklch(0.5 0.19 25)" : "oklch(0.2 0.03 260)";
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        borderRadius: 8,
        background:
          "linear-gradient(180deg, oklch(0.99 0.01 90) 0%, oklch(0.94 0.01 85) 100%)",
        border: "1px solid oklch(0.75 0.02 85)",
        boxShadow: "0 5px 10px -3px oklch(0 0 0 / 60%), 0 1px 0 oklch(1 0 0 / 60%) inset",
      }}
    >
      <div className="absolute left-1.5 top-1 flex flex-col items-center leading-none" style={{ color }}>
        <span className="font-serif text-[18px] font-bold">{card.rank}</span>
        <span className="text-[16px]">{card.suit}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center" style={{ color }}>
        <span className="text-[38px] leading-none">{card.suit}</span>
      </div>
      <div
        className="absolute bottom-1 right-1.5 flex rotate-180 flex-col items-center leading-none"
        style={{ color }}
      >
        <span className="font-serif text-[18px] font-bold">{card.rank}</span>
        <span className="text-[16px]">{card.suit}</span>
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        borderRadius: 6,
        background:
          "linear-gradient(160deg, oklch(0.28 0.09 25) 0%, oklch(0.18 0.06 25) 100%)",
        border: "1px solid oklch(0.55 0.14 78 / 60%)",
        boxShadow: "0 5px 10px -3px oklch(0 0 0 / 65%), 0 1px 0 oklch(1 0 0 / 15%) inset",
      }}
    >
      <div
        className="absolute inset-1 rounded-[4px]"
        style={{
          border: "1px solid oklch(0.72 0.14 82 / 55%)",
          backgroundImage:
            "repeating-linear-gradient(45deg, oklch(0.72 0.14 82 / 18%) 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, oklch(0.72 0.14 82 / 12%) 0 2px, transparent 2px 6px)",
        }}
      />
      <div
        className="absolute inset-0 flex items-center justify-center font-serif text-[12px] font-bold tracking-widest"
        style={{
          color: "oklch(0.85 0.14 82)",
          textShadow: "0 1px 0 oklch(0 0 0 / 60%)",
        }}
      >
        CAPI
      </div>
    </div>
  );
}
