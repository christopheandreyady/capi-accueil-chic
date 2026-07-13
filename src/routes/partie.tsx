import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
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

const PLAYERS: Record<Position, { name: string; level: number }> = {
  bottom: { name: "Vous", level: 12 },
  left: { name: "Camille", level: 9 },
  top: { name: "Léo", level: 14 },
  right: { name: "Alex", level: 8 },
};

const CARD_W_BIG = 56;
const CARD_H_BIG = 82;
const CARD_W_SMALL = 34;
const CARD_H_SMALL = 50;

const FLIGHT_MS = 420; // per-card flight
const CUT_MS = 1700;
const BATCH_PAUSE_MS = 220; // extra pause between batches / seat changes

type DealMode = "3-2-3" | "2-3-3";

type Dealt = {
  card: Card;
  seat: Position;
  indexInHand: number; // 0..7
  batchIndex: number;
};

type Phase = "mode" | "cut" | "dealing" | "done";

function nextClockwise(p: Position): Position {
  return POSITIONS[(POSITIONS.indexOf(p) + 1) % 4];
}

function prevClockwise(p: Position): Position {
  return POSITIONS[(POSITIONS.indexOf(p) + 3) % 4];
}

// Soft, felted card sound — a low thud + a short paper hiss.
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

    // 1) Soft paper hiss (band-limited noise)
    const dur = 0.09;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      // fast attack, exp decay
      const env = Math.pow(1 - t, 2.4);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3800;
    const hissGain = ctx.createGain();
    hissGain.gain.setValueAtTime(0.09 + Math.random() * 0.03, now);
    hissGain.gain.exponentialRampToValueAtTime(0.0005, now + dur);
    src.connect(hp).connect(lp).connect(hissGain).connect(ctx.destination);
    src.start(now);
    src.stop(now + dur);

    // 2) Very short low thud (soft landing)
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.06);
    const oGain = ctx.createGain();
    oGain.gain.setValueAtTime(0.045, now);
    oGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.07);
    osc.connect(oGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
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
  const [phase, setPhase] = useState<Phase>("mode");
  const [cutStep, setCutStep] = useState<0 | 1 | 2>(0);
  const [dealMode, setDealMode] = useState<DealMode | null>(null);

  const cutter = prevClockwise(dealer);

  const dealOrder = useMemo<Dealt[]>(() => {
    if (!dealMode) return [];
    const deck = shuffle(buildDeck());
    const order: Dealt[] = [];
    // Start with the player AFTER the dealer (clockwise), classic Contrée.
    const start = (POSITIONS.indexOf(dealer) + 1) % 4;
    const handIdx: Record<Position, number> = { bottom: 0, left: 0, top: 0, right: 0 };
    const pattern = dealMode === "3-2-3" ? [3, 2, 3] : [2, 3, 3];
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

  // Reset to mode-choice each new round.
  useEffect(() => {
    setPhase("mode");
    setCutStep(0);
    setDealtCount(0);
    setDealMode(null);
  }, [dealSeed, dealer]);

  // Cut → deal lifecycle (only once mode chosen)
  useEffect(() => {
    if (size.w === 0 || !dealMode) return;
    setPhase("cut");
    setCutStep(0);
    setDealtCount(0);
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setCutStep(1), 550));
    timers.push(window.setTimeout(() => setCutStep(2), 550 + 700));
    timers.push(
      window.setTimeout(() => {
        setPhase("dealing");
        // Human-paced deal: 220-300ms between cards, plus a pause between batches.
        let cumulative = 0;
        for (let k = 0; k < dealOrder.length; k++) {
          const prev = dealOrder[k - 1];
          const cur = dealOrder[k];
          const seatChanged = !prev || prev.seat !== cur.seat;
          const batchChanged = !prev || prev.batchIndex !== cur.batchIndex;
          const base = 240 + Math.random() * 70; // 240-310ms natural jitter
          const extra = seatChanged ? (batchChanged ? BATCH_PAUSE_MS : 60) : 0;
          cumulative += k === 0 ? 260 : base + extra;
          const stepIdx = k + 1;
          timers.push(
            window.setTimeout(() => {
              setDealtCount(stepIdx);
              playCardSound();
            }, cumulative),
          );
        }
        timers.push(window.setTimeout(() => setPhase("done"), cumulative + FLIGHT_MS + 250));
      }, CUT_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [dealMode, dealOrder, size.w]);

  // Seat anchor points — closer to the physical edge of the table.
  const anchors = useMemo(() => {
    const w = size.w || 1;
    const h = size.h || 1;
    return {
      bottom: { x: w * 0.5, y: h - 44, angle: 0 },
      top: { x: w * 0.5, y: 44, angle: 180 },
      left: { x: 32, y: h * 0.5, angle: 90 },
      right: { x: w - 32, y: h * 0.5, angle: -90 },
    } as const;
  }, [size]);

  // Deck sits just in front of the dealer.
  const deckBase = useMemo(() => {
    const a = anchors[dealer];
    const cx = (size.w || 0) / 2;
    const cy = (size.h || 0) / 2;
    const dx = cx - a.x;
    const dy = cy - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const inset = dealer === "bottom" || dealer === "top" ? 110 : 95;
    return {
      x: a.x + (dx / len) * inset,
      y: a.y + (dy / len) * inset,
      angle: a.angle,
    };
  }, [anchors, dealer, size]);

  // Deck pivots slightly toward the current recipient (like a real wrist turn).
  const deckPos = useMemo(() => {
    if (phase !== "dealing" || dealtCount === 0 || dealtCount > dealOrder.length) return deckBase;
    const cur = dealOrder[Math.min(dealtCount, dealOrder.length - 1)] ?? dealOrder[dealtCount - 1];
    const rec = anchors[cur.seat];
    const dx = rec.x - deckBase.x;
    const dy = rec.y - deckBase.y;
    const targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90; // 0 = pointing "up" toward recipient
    // Blend gently between base angle and target for a subtle wrist tilt.
    const diff = ((targetAngle - deckBase.angle + 540) % 360) - 180;
    return { ...deckBase, angle: deckBase.angle + diff * 0.18 };
  }, [phase, dealtCount, dealOrder, deckBase, anchors]);

  const computeTarget = (d: Dealt) => {
    const isBottom = d.seat === "bottom";
    const cardW = isBottom ? CARD_W_BIG : CARD_W_SMALL;
    const cardH = isBottom ? CARD_H_BIG : CARD_H_SMALL;
    const a = anchors[d.seat];
    const n = 8;
    const spread = isBottom ? 34 : 22;
    const step = spread / (n - 1);
    const localAngle = -spread / 2 + step * d.indexInHand;
    const radius = isBottom ? 90 : 58; // cards sit close to the seated player
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


  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background">
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
            "radial-gradient(60% 35% at 50% 0%, oklch(0.85 0.14 75 / 30%) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 50%, transparent 0%, oklch(0 0 0 / 55%) 70%, oklch(0.06 0.02 40 / 95%) 100%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <header className="flex items-center justify-between px-4 pt-4">
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
            {phase === "mode" ? "Mode de distribution" : phase === "cut" ? "Coupe" : "Distribution"}
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

        <div ref={boxRef} className="relative mx-auto mt-3 w-full max-w-md flex-1">
          {/* Table felt */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "min(88%, 420px)",
              height: "min(78%, 520px)",
              borderRadius: "26px",
              background:
                "radial-gradient(120% 90% at 50% 45%, oklch(0.42 0.11 155) 0%, oklch(0.28 0.09 155) 55%, oklch(0.18 0.06 155) 100%)",
              boxShadow:
                "0 24px 40px -18px oklch(0 0 0 / 70%), 0 0 0 6px oklch(0.22 0.05 55 / 55%), 0 0 0 10px oklch(0.14 0.04 45 / 65%)",
            }}
          />

          {/* Seat labels + dealer badge */}
          {POSITIONS.map((p) => (
            <SeatLabel key={p} position={p} anchors={anchors} isDealer={p === dealer} />
          ))}

          {/* Cut message */}
          {phase === "cut" && (
            <div
              className="pointer-events-none absolute left-1/2 top-6 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium animate-fade-in"
              style={{
                background: "oklch(0.18 0.03 40 / 80%)",
                borderColor: "oklch(0.82 0.14 82 / 35%)",
                color: "oklch(0.94 0.1 85)",
                backdropFilter: "blur(8px)",
                textShadow: "0 1px 2px oklch(0 0 0 / 60%)",
              }}
            >
              À {PLAYERS[cutter].name} de couper le paquet.
            </div>
          )}

          {/* Mode choice — dealer picks the deal pattern before the cut */}
          {phase === "mode" && (
            <div
              className="absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 animate-fade-in"
            >
              <div
                className="rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em]"
                style={{
                  background: "oklch(0.18 0.03 40 / 80%)",
                  borderColor: "oklch(0.82 0.14 82 / 35%)",
                  color: "oklch(0.94 0.1 85)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {PLAYERS[dealer].name} distribue
              </div>
              <div className="flex gap-3">
                {(["3-2-3", "2-3-3"] as DealMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDealMode(m)}
                    className="rounded-2xl border px-5 py-3 font-serif text-base font-semibold tracking-wide transition active:scale-[0.97]"
                    style={{
                      background:
                        "linear-gradient(168deg, oklch(0.32 0.09 152) 0%, oklch(0.22 0.07 152) 100%)",
                      borderColor: "oklch(0.82 0.14 82 / 45%)",
                      color: "transparent",
                      backgroundClip: "padding-box",
                      boxShadow:
                        "0 10px 22px -12px oklch(0 0 0 / 70%), inset 0 1px 0 oklch(1 0 0 / 12%), inset 0 -6px 12px oklch(0 0 0 / 35%)",
                    }}
                  >
                    <span
                      style={{
                        background: "linear-gradient(180deg, oklch(0.96 0.1 88), oklch(0.72 0.14 78))",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                        textShadow: "0 1px 0 oklch(0 0 0 / 40%)",
                      }}
                    >
                      {m}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Deck (in front of dealer) — split during cut */}
          {phase !== "done" && phase !== "mode" && (
            <DeckStack deckPos={deckPos} cutStep={phase === "cut" ? cutStep : 2} remaining={32 - dealtCount} />
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
    </main>
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
  const w = 40;
  const h = 58;
  // During cut, top half slides aside then swaps under.
  const splitOffset = cutStep === 1 ? 46 : 0;
  const topZ = cutStep === 2 ? 1 : 3; // after recompose, ex-top goes underneath
  const bottomZ = cutStep === 2 ? 3 : 1;
  const rad = (deckPos.angle * Math.PI) / 180;
  const ox = Math.cos(rad) * splitOffset;
  const oy = Math.sin(rad) * splitOffset;
  return (
    <>
      {/* Bottom half */}
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
      {/* Top half */}
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
        <div
          key={i}
          className="absolute inset-0"
          style={{
            transform: `translate(${i * 0.6}px, ${-i * 0.8}px)`,
          }}
        >
          <CardBack />
        </div>
      ))}
    </div>
  );
}

function SeatLabel({
  position,
  anchors,
  isDealer,
}: {
  position: Position;
  anchors: Record<Position, { x: number; y: number; angle: number }>;
  isDealer: boolean;
}) {
  const a = anchors[position];
  const p = PLAYERS[position];
  const offset = position === "bottom" ? { x: 0, y: 42 }
    : position === "top" ? { x: 0, y: -42 }
    : position === "left" ? { x: -8, y: -70 }
    : { x: 8, y: -70 };
  return (
    <div
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: a.x + offset.x, top: a.y + offset.y, zIndex: 5 }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="font-serif text-[12px] font-semibold tracking-wide"
          style={{
            color: "oklch(0.94 0.09 85)",
            textShadow: "0 1px 2px oklch(0 0 0 / 70%)",
          }}
        >
          {p.name}
        </span>
        {isDealer && (
          <span
            className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-[9px] font-bold animate-scale-in"
            style={{
              background: "linear-gradient(180deg, oklch(0.9 0.14 88), oklch(0.65 0.16 72))",
              color: "oklch(0.2 0.05 40)",
              boxShadow: "0 1px 2px oklch(0 0 0 / 60%), 0 0 0 1px oklch(0.4 0.08 55) inset",
            }}
            aria-label="Donneur"
            title="Donneur"
          >
            D
          </span>
        )}
      </div>
      <span
        className="mt-0.5 text-[9px] uppercase tracking-[0.2em]"
        style={{ color: "oklch(0.85 0.06 82 / 80%)" }}
      >
        Niv. {p.level}
      </span>
    </div>
  );
}

function CardFace({ card }: { card: Card }) {
  const red = isRedSuit(card.suit);
  const color = red ? "oklch(0.5 0.19 25)" : "oklch(0.2 0.03 260)";
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        borderRadius: 6,
        background:
          "linear-gradient(180deg, oklch(0.99 0.01 90) 0%, oklch(0.94 0.01 85) 100%)",
        border: "1px solid oklch(0.75 0.02 85)",
        boxShadow: "0 4px 8px -3px oklch(0 0 0 / 55%), 0 1px 0 oklch(1 0 0 / 60%) inset",
      }}
    >
      <div
        className="absolute left-1 top-0.5 flex flex-col items-center leading-none"
        style={{ color }}
      >
        <span className="font-serif text-[13px] font-bold">{card.rank}</span>
        <span className="text-[12px]">{card.suit}</span>
      </div>
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ color }}
      >
        <span className="text-[26px] leading-none">{card.suit}</span>
      </div>
      <div
        className="absolute bottom-0.5 right-1 flex rotate-180 flex-col items-center leading-none"
        style={{ color }}
      >
        <span className="font-serif text-[13px] font-bold">{card.rank}</span>
        <span className="text-[12px]">{card.suit}</span>
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        borderRadius: 5,
        background:
          "linear-gradient(160deg, oklch(0.28 0.09 25) 0%, oklch(0.18 0.06 25) 100%)",
        border: "1px solid oklch(0.55 0.14 78 / 60%)",
        boxShadow: "0 4px 8px -3px oklch(0 0 0 / 60%), 0 1px 0 oklch(1 0 0 / 15%) inset",
      }}
    >
      <div
        className="absolute inset-1 rounded-[3px]"
        style={{
          border: "1px solid oklch(0.72 0.14 82 / 55%)",
          backgroundImage:
            "repeating-linear-gradient(45deg, oklch(0.72 0.14 82 / 18%) 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, oklch(0.72 0.14 82 / 12%) 0 2px, transparent 2px 6px)",
        }}
      />
      <div
        className="absolute inset-0 flex items-center justify-center font-serif text-[11px] font-bold tracking-widest"
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
