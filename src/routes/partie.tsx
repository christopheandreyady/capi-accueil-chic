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

const DEAL_MS = 170; // stagger between cards (~0.17s)
const FLIGHT_MS = 360; // per-card flight duration
const CUT_MS = 1700; // total cut animation

type Dealt = {
  card: Card;
  seat: Position;
  indexInHand: number; // 0..7
};

type Phase = "cut" | "dealing" | "done";

function nextClockwise(p: Position): Position {
  return POSITIONS[(POSITIONS.indexOf(p) + 1) % 4];
}

// Lightweight card-flick sound using the WebAudio API — no assets.
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
    // Short filtered noise burst = card flick
    const dur = 0.07;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      data[i] = (Math.random() * 2 - 1) * (1 - t) * 0.55;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + dur);
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
  const [phase, setPhase] = useState<Phase>("cut");
  const [cutStep, setCutStep] = useState<0 | 1 | 2>(0); // 0 idle, 1 split, 2 recomposed

  const cutter = nextClockwise(dealer);

  const dealOrder = useMemo<Dealt[]>(() => {
    const deck = shuffle(buildDeck());
    const order: Dealt[] = [];
    // 8 cards each, dealt one-by-one clockwise starting AFTER the dealer.
    const start = (POSITIONS.indexOf(dealer) + 1) % 4;
    const handIdx: Record<Position, number> = { bottom: 0, left: 0, top: 0, right: 0 };
    for (let k = 0; k < 32; k++) {
      const seat = POSITIONS[(start + k) % 4];
      order.push({ card: deck[k], seat, indexInHand: handIdx[seat]++ });
    }
    return order;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealSeed, dealer]);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Round lifecycle: cut → deal → done.
  useEffect(() => {
    if (size.w === 0) return;
    setPhase("cut");
    setCutStep(0);
    setDealtCount(0);
    const timers: number[] = [];
    // Split
    timers.push(window.setTimeout(() => setCutStep(1), 550));
    // Recompose
    timers.push(window.setTimeout(() => setCutStep(2), 550 + 700));
    // Start dealing
    timers.push(
      window.setTimeout(() => {
        setPhase("dealing");
        for (let k = 1; k <= 32; k++) {
          timers.push(
            window.setTimeout(() => {
              setDealtCount(k);
              playCardSound();
            }, k * DEAL_MS),
          );
        }
        timers.push(window.setTimeout(() => setPhase("done"), 32 * DEAL_MS + FLIGHT_MS + 200));
      }, CUT_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [dealSeed, dealer, size.w]);

  // Seat anchor points (center of the fanned hand)
  const anchors = useMemo(() => {
    const w = size.w || 1;
    const h = size.h || 1;
    return {
      bottom: { x: w * 0.5, y: h - 70, angle: 0 },
      top: { x: w * 0.5, y: 70, angle: 180 },
      left: { x: 46, y: h * 0.5, angle: 90 },
      right: { x: w - 46, y: h * 0.5, angle: -90 },
    } as const;
  }, [size]);

  // Deck sits just in front of the dealer (pulled toward table center from seat).
  const deckPos = useMemo(() => {
    const a = anchors[dealer];
    const cx = (size.w || 0) / 2;
    const cy = (size.h || 0) / 2;
    const dx = cx - a.x;
    const dy = cy - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const inset = dealer === "bottom" || dealer === "top" ? 110 : 90;
    return {
      x: a.x + (dx / len) * inset,
      y: a.y + (dy / len) * inset,
      angle: a.angle,
    };
  }, [anchors, dealer, size]);

  const computeTarget = (d: Dealt) => {
    const isBottom = d.seat === "bottom";
    const cardW = isBottom ? CARD_W_BIG : CARD_W_SMALL;
    const cardH = isBottom ? CARD_H_BIG : CARD_H_SMALL;
    const a = anchors[d.seat];
    const n = 8;
    const spread = isBottom ? 34 : 22;
    const step = spread / (n - 1);
    const localAngle = -spread / 2 + step * d.indexInHand;
    const radius = isBottom ? 140 : 90;
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

  // Persist per-card target so rotation jitter doesn't jump each render.
  const targetsRef = useRef<Record<string, ReturnType<typeof computeTarget>>>({});
  useEffect(() => {
    targetsRef.current = {};
  }, [dealSeed, dealer, size.w]);

  const nextRound = () => {
    setDealer((d) => nextClockwise(d));
    setDealSeed((s) => s + 1);
  };
  const redeal = () => setDealSeed((s) => s + 1);

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
            {phase === "cut" ? "Coupe" : "Distribution"}
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

          {/* Deck (in front of dealer) — split during cut */}
          {phase !== "done" && (
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
