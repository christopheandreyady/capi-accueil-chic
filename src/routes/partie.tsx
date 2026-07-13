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

// Clockwise seating order used for turn / deal rotation.
const POSITIONS: Position[] = ["bottom", "left", "top", "right"];

type PlayerInfo = { name: string; level: number; photo: string };

const PLAYERS: Record<Position, PlayerInfo> = {
  bottom: { name: "Vous", level: 22, photo: "https://i.pravatar.cc/200?img=12" },
  left: { name: "Bot Margaux", level: 15, photo: "https://i.pravatar.cc/200?img=47" },
  top: { name: "Bot Jean-Luc", level: 18, photo: "https://i.pravatar.cc/200?img=68" },
  right: { name: "Bot Alex", level: 12, photo: "https://i.pravatar.cc/200?img=15" },
};

// Larger, more readable cards (+~30%)
const CARD_W_BIG = 74;
const CARD_H_BIG = 108;
const CARD_W_SMALL = 44;
const CARD_H_SMALL = 64;

const FLIGHT_MS = 460;
const CUT_MS = 1900;
const SHUFFLE_MS = 1400;

type DealMode = "3-2-3" | "3-3-2" | "2-3-3";
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

// Realistic felted card sliding sound: paper hiss + soft thud.
function playCardSound() {
  try {
    const w = window as unknown as {
      __capiAudioCtx?: AudioContext;
      AudioContext: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    if (!w.__capiAudioCtx) w.__capiAudioCtx = new Ctor();
    const ctx = w.__capiAudioCtx!;
    const now = ctx.currentTime;

    // Long, feathered slide (noise through bandpass)
    const dur = 0.16 + Math.random() * 0.05;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      // slow attack, longer decay — resembles a card gliding
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
    const hissGain = ctx.createGain();
    hissGain.gain.setValueAtTime(0.11 + Math.random() * 0.03, now);
    hissGain.gain.exponentialRampToValueAtTime(0.0005, now + dur);
    src.connect(bp).connect(hp).connect(hissGain).connect(ctx.destination);
    src.start(now);
    src.stop(now + dur);

    // Soft landing thud
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
  } catch {
    /* silent */
  }
}

function GameTable() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dealtCount, setDealtCount] = useState(0);
  const [dealSeed, setDealSeed] = useState(0);
  const [dealer, setDealer] = useState<Position>("bottom");
  const [phase, setPhase] = useState<Phase>("shuffle");
  const [cutStep, setCutStep] = useState<0 | 1 | 2>(0);
  const [dealMode, setDealMode] = useState<DealMode | null>(null);

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

  // Reset lifecycle each new round.
  useEffect(() => {
    setPhase("shuffle");
    setCutStep(0);
    setDealtCount(0);
    setDealMode(null);
  }, [dealSeed, dealer]);

  // Cut → mode → deal lifecycle. Starts once user picks shuffle option and mode.
  useEffect(() => {
    if (size.w === 0 || phase !== "dealing" || !dealMode) return;
    const timers: number[] = [];
    // Slower, more natural rhythm: 320-440ms per card, batch pauses ~280ms.
    let cumulative = 0;
    for (let k = 0; k < dealOrder.length; k++) {
      const prev = dealOrder[k - 1];
      const cur = dealOrder[k];
      const seatChanged = !prev || prev.seat !== cur.seat;
      const batchChanged = !prev || prev.batchIndex !== cur.batchIndex;
      const base = 330 + Math.random() * 110;
      const extra = seatChanged ? (batchChanged ? 280 : 90) : 0;
      cumulative += k === 0 ? 320 : base + extra;
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

  // Seat anchor points — closer to each player.
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

  // Deck sits just in front of dealer.
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

  // Deck pivots subtly toward the current recipient (wrist tilt).
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
    const spread = isBottom ? 38 : 26;
    const step = spread / (n - 1);
    const localAngle = -spread / 2 + step * d.indexInHand;
    // Fan sits VERY close to each seated player.
    const radius = isBottom ? 78 : 46;
    const rad = (localAngle * Math.PI) / 180;
    const lx = Math.sin(rad) * radius;
    const ly = -Math.cos(rad) * radius;
    const seatRad = (a.angle * Math.PI) / 180;
    const rx = lx * Math.cos(seatRad) - ly * Math.sin(seatRad);
    const ry = lx * Math.sin(seatRad) + ly * Math.cos(seatRad);
    return {
      x: a.x + rx,
      y: a.y + ry,
      rotate: localAngle + a.angle + (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3),
      w: cardW,
      h: cardH,
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
      const t1 = window.setTimeout(() => setCutStep(1), 550);
      const t2 = window.setTimeout(() => setCutStep(2), 550 + 700);
      const t3 = window.setTimeout(() => setPhase("mode"), CUT_MS);
      return () => [t1, t2, t3].forEach(clearTimeout);
    }
    setPhase("shuffling");
    window.setTimeout(() => {
      setPhase("cut");
      setCutStep(0);
      window.setTimeout(() => setCutStep(1), 550);
      window.setTimeout(() => setCutStep(2), 550 + 700);
      window.setTimeout(() => setPhase("mode"), CUT_MS);
    }, SHUFFLE_MS);
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

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background">
      <img
        src={bistrotTable}
        alt=""
        width={1024}
        height={1536}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      {/* Warm overhead light */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 35% at 50% 0%, oklch(0.85 0.14 75 / 32%) 0%, oklch(0.7 0.12 65 / 12%) 40%, transparent 70%)",
        }}
      />
      {/* Vignette */}
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
          {/* Bistro wooden table (same identity as salle d'attente) */}
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

            {/* Green felt mat */}
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

            {/* Permanent player badges (avatar + pseudo + level + dealer D) */}
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

            {/* Shuffling label */}
            {phase === "shuffling" && (
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-medium animate-fade-in"
                style={{
                  background: "oklch(0.18 0.03 40 / 88%)",
                  borderColor: "oklch(0.82 0.14 82 / 40%)",
                  color: "oklch(0.94 0.1 85)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <Shuffle className="h-3.5 w-3.5" />
                Mélange en cours…
              </div>
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

            {/* Mode choice — 3 options */}
            {phase === "mode" && size.w > 0 && (
              <ChoicePanel
                title="Vous distribuez"
                subtitle="Choisissez la distribution"
                options={(["3-2-3", "3-3-2", "2-3-3"] as DealMode[]).map((m) => ({
                  key: m,
                  label: m,
                  onClick: () => chooseMode(m),
                  primary: true,
                }))}
              />
            )}

            {/* Deck (in front of dealer) — split during cut */}
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
              const x = isDealt ? target.x : deckPos.x;
              const y = isDealt ? target.y : deckPos.y;
              const rotate = isDealt ? target.rotate : deckPos.angle + (i % 2 === 0 ? -1.5 : 1.5);
              const w = target.w;
              const h = target.h;
              const showFace = isDealt && d.seat === "bottom";
              const z = isDealt ? 100 + d.indexInHand + (d.seat === "bottom" ? 50 : 0) : 20 + (32 - i);
              const visible = isDealt || phase === "dealing";
              return (
                <div
                  key={d.card.id}
                  className="absolute left-0 top-0"
                  style={{
                    width: w,
                    height: h,
                    transform: `translate3d(${x - w / 2}px, ${y - h / 2}px, 0) rotate(${rotate}deg)`,
                    transition: `transform ${FLIGHT_MS}ms cubic-bezier(0.22, 0.7, 0.25, 1)`,
                    zIndex: z,
                    willChange: "transform",
                    opacity: visible ? 1 : 0,
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
  // Avatars are placed OUTSIDE the wooden table, at the seated position.
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
        borderRadius: 7,
        background:
          "linear-gradient(180deg, oklch(0.99 0.01 90) 0%, oklch(0.94 0.01 85) 100%)",
        border: "1px solid oklch(0.75 0.02 85)",
        boxShadow: "0 5px 10px -3px oklch(0 0 0 / 60%), 0 1px 0 oklch(1 0 0 / 60%) inset",
      }}
    >
      <div className="absolute left-1 top-0.5 flex flex-col items-center leading-none" style={{ color }}>
        <span className="font-serif text-[16px] font-bold">{card.rank}</span>
        <span className="text-[15px]">{card.suit}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center" style={{ color }}>
        <span className="text-[34px] leading-none">{card.suit}</span>
      </div>
      <div
        className="absolute bottom-0.5 right-1 flex rotate-180 flex-col items-center leading-none"
        style={{ color }}
      >
        <span className="font-serif text-[16px] font-bold">{card.rank}</span>
        <span className="text-[15px]">{card.suit}</span>
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
