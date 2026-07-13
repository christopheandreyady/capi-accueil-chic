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

const POSITIONS: Position[] = ["bottom", "left", "top", "right"];

const PLAYERS: Record<Position, { name: string; level: number }> = {
  bottom: { name: "Vous", level: 12 },
  left: { name: "Camille", level: 9 },
  top: { name: "Léo", level: 14 },
  right: { name: "Alex", level: 8 },
};

// Card sizes (px). Bottom player has larger, readable cards.
const CARD_W_BIG = 56;
const CARD_H_BIG = 82;
const CARD_W_SMALL = 34;
const CARD_H_SMALL = 50;

const DEAL_MS = 110; // stagger between cards
const FLIGHT_MS = 420; // per-card flight duration

type Dealt = {
  card: Card;
  seat: Position;
  indexInHand: number; // 0..7
};

function GameTable() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dealtCount, setDealtCount] = useState(0);
  const [dealSeed, setDealSeed] = useState(0);

  const dealOrder = useMemo<Dealt[]>(() => {
    const deck = shuffle(buildDeck());
    const order: Dealt[] = [];
    // 8 rounds, clockwise from bottom: bottom → left → top → right
    for (let round = 0; round < 8; round++) {
      for (const seat of POSITIONS) {
        const idx = round * 4 + POSITIONS.indexOf(seat);
        order.push({ card: deck[idx], seat, indexInHand: round });
      }
    }
    return order;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealSeed]);

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
    setDealtCount(0);
    if (size.w === 0) return;
    const timers: number[] = [];
    for (let k = 1; k <= 32; k++) {
      timers.push(
        window.setTimeout(() => setDealtCount(k), 250 + k * DEAL_MS),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [dealSeed, size.w]);

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

  const center = { x: (size.w || 0) / 2, y: (size.h || 0) / 2 };

  const computeTarget = (d: Dealt) => {
    const isBottom = d.seat === "bottom";
    const cardW = isBottom ? CARD_W_BIG : CARD_W_SMALL;
    const cardH = isBottom ? CARD_H_BIG : CARD_H_SMALL;
    const a = anchors[d.seat];
    // Fan geometry: pivot below the visible cards, arc them symmetrically
    const n = 8;
    const spread = isBottom ? 34 : 22; // total angular spread deg
    const step = spread / (n - 1);
    const localAngle = -spread / 2 + step * d.indexInHand; // deg
    const radius = isBottom ? 140 : 90;
    // Local point (before seat rotation): pivot at (0,0) below, cards up
    const rad = (localAngle * Math.PI) / 180;
    const lx = Math.sin(rad) * radius;
    const ly = -Math.cos(rad) * radius;
    // Rotate by seat orientation
    const seatRad = (a.angle * Math.PI) / 180;
    const rx = lx * Math.cos(seatRad) - ly * Math.sin(seatRad);
    const ry = lx * Math.sin(seatRad) + ly * Math.cos(seatRad);
    // Anchor is roughly the seat pivot; pull cards inward from edge
    const cx = a.x + rx;
    const cy = a.y + ry;
    return {
      x: cx,
      y: cy,
      rotate: localAngle + a.angle,
      w: cardW,
      h: cardH,
    };
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
            Distribution
          </h1>
          <button
            type="button"
            onClick={() => setDealSeed((s) => s + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-95"
            style={{
              background: "oklch(0.2 0.03 40 / 60%)",
              borderColor: "oklch(0.82 0.14 82 / 30%)",
              backdropFilter: "blur(8px)",
              color: "oklch(0.9 0.1 85)",
            }}
            aria-label="Redistribuer"
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

          {/* Seat name plates */}
          {POSITIONS.map((p) => (
            <SeatLabel key={p} position={p} anchors={anchors} />
          ))}

          {/* Cards */}
          {dealOrder.map((d, i) => {
            const isDealt = i < dealtCount;
            const target = computeTarget(d);
            const x = isDealt ? target.x : center.x;
            const y = isDealt ? target.y : center.y;
            const rotate = isDealt ? target.rotate : (i % 2 === 0 ? -6 : 6);
            const w = target.w;
            const h = target.h;
            const showFace = isDealt && d.seat === "bottom";
            const z = isDealt ? 100 + d.indexInHand + (d.seat === "bottom" ? 50 : 0) : 500 - i;
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

function SeatLabel({
  position,
  anchors,
}: {
  position: Position;
  anchors: Record<Position, { x: number; y: number; angle: number }>;
}) {
  const a = anchors[position];
  const p = PLAYERS[position];
  // Offset the label outward from the fan
  const offset = position === "bottom" ? { x: 0, y: 42 }
    : position === "top" ? { x: 0, y: -42 }
    : position === "left" ? { x: -8, y: -70 }
    : { x: 8, y: -70 };
  return (
    <div
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: a.x + offset.x, top: a.y + offset.y, zIndex: 5 }}
    >
      <span
        className="font-serif text-[12px] font-semibold tracking-wide"
        style={{
          color: "oklch(0.94 0.09 85)",
          textShadow: "0 1px 2px oklch(0 0 0 / 70%)",
        }}
      >
        {p.name}
      </span>
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
