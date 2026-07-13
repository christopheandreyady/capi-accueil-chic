import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ArrowLeft, Play } from "lucide-react";
import bistrotTable from "@/assets/capi-bistrot-table.jpg";
import capiEmblem from "@/assets/capi-emblem.png";

export const Route = createFileRoute("/salle-attente")({
  head: () => ({
    meta: [
      { title: "Salle d'attente — CAPI" },
      {
        name: "description",
        content: "Rejoignez vos partenaires autour de la table avant de lancer votre partie de Contrée.",
      },
      { property: "og:title", content: "Salle d'attente — CAPI" },
      {
        property: "og:description",
        content: "Invitez vos amis et lancez votre partie de Contrée dans l'ambiance CAPI.",
      },
    ],
  }),
  component: WaitingRoom,
});

type Player = {
  name: string;
  level: number;
  photo: string;
  online: boolean;
};

type Seat = {
  position: "bottom" | "top" | "left" | "right";
  player: Player | null;
};

const seats: Seat[] = [
  {
    position: "top",
    player: {
      name: "Jean-Luc",
      level: 27,
      photo: "https://i.pravatar.cc/200?img=68",
      online: true,
    },
  },
  {
    position: "left",
    player: {
      name: "Margaux",
      level: 14,
      photo: "https://i.pravatar.cc/200?img=47",
      online: true,
    },
  },
  { position: "right", player: null },
  {
    position: "bottom",
    player: {
      name: "Vous",
      level: 22,
      photo: "https://i.pravatar.cc/200?img=12",
      online: true,
    },
  },
];

function WaitingRoom() {
  const players = seats.filter((s) => s.player).length;
  const total = 4;
  const allReady = players === total;

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
            "radial-gradient(120% 80% at 50% 50%, transparent 0%, oklch(0 0 0 / 40%) 60%, oklch(0.08 0.02 40 / 92%) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.12 0.03 40 / 70%) 0%, transparent 20%, transparent 55%, oklch(0.08 0.02 40 / 90%) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pt-6 pb-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link
            to="/amis"
            className="flex h-10 w-10 items-center justify-center rounded-full border transition active:scale-95"
            style={{
              background: "oklch(0.2 0.03 40 / 60%)",
              borderColor: "oklch(0.82 0.14 82 / 30%)",
              backdropFilter: "blur(8px)",
              color: "oklch(0.9 0.1 85)",
            }}
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="flex flex-col items-center">
            <h1
              className="font-serif text-xl font-semibold tracking-wide"
              style={{
                background: "linear-gradient(180deg, oklch(0.95 0.1 88), oklch(0.72 0.14 78))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                textShadow: "0 1px 0 oklch(0 0 0 / 40%)",
              }}
            >
              Table du Bistrot
            </h1>
            <span
              className="mt-0.5 text-[11px] uppercase tracking-[0.25em]"
              style={{ color: "oklch(0.8 0.08 82 / 75%)" }}
            >
              {players}/{total} joueurs
            </span>
          </div>

          <img
            src={capiEmblem}
            alt="CAPI"
            width={1024}
            height={1024}
            className="h-10 w-10"
            style={{ filter: "drop-shadow(0 4px 8px oklch(0 0 0 / 60%))" }}
          />
        </header>

        {/* Table area */}
        <section className="relative mt-8 flex-1">
          <div className="relative mx-auto aspect-square w-full max-w-[400px]">
            {/* Wooden rim + felt (rim = the outer ring where avatars sit) */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 50% 30%, oklch(0.42 0.09 45) 0%, oklch(0.3 0.08 40) 55%, oklch(0.18 0.05 35) 100%)",
                boxShadow:
                  "0 30px 60px -20px oklch(0 0 0 / 80%), inset 0 2px 0 oklch(1 0 0 / 10%), inset 0 -10px 20px oklch(0 0 0 / 60%)",
              }}
            >
              {/* Wood grain */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full opacity-40 mix-blend-overlay"
                style={{
                  backgroundImage:
                    "repeating-radial-gradient(circle at 50% 50%, oklch(0 0 0 / 25%) 0 2px, transparent 2px 6px), repeating-conic-gradient(from 0deg, oklch(1 0 0 / 4%) 0deg 8deg, transparent 8deg 16deg)",
                }}
              />
              {/* Gold inlay */}
              <div
                className="pointer-events-none absolute inset-[10%] rounded-full"
                style={{
                  border: "1px solid oklch(0.82 0.14 82 / 55%)",
                  boxShadow:
                    "0 0 12px oklch(0.82 0.14 82 / 25%), inset 0 0 12px oklch(0.82 0.14 82 / 20%)",
                }}
              />
            </div>

            {/* Felt table */}
            <div
              className="absolute inset-[13%] rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 50% 35%, oklch(0.44 0.11 152) 0%, oklch(0.3 0.09 152) 55%, oklch(0.18 0.06 150) 100%)",
                boxShadow:
                  "inset 0 0 100px oklch(0 0 0 / 60%), inset 0 20px 40px oklch(1 0 0 / 5%), 0 0 0 2px oklch(0.15 0.04 35)",
              }}
            >
              {/* Felt texture */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full opacity-40 mix-blend-overlay"
                style={{
                  backgroundImage:
                    "radial-gradient(oklch(0 0 0 / 30%) 1px, transparent 1px), radial-gradient(oklch(1 0 0 / 12%) 1px, transparent 1px)",
                  backgroundSize: "3px 3px, 5px 5px",
                  backgroundPosition: "0 0, 1px 2px",
                }}
              />
            </div>

            {/* Jetons scattered on wooden rim (outside felt, inside wood) */}
            {/* Top-left area */}
            <RoundChip
              className="absolute"
              style={{ left: "10%", top: "18%", transform: "rotate(-12deg)" }}
              color="oklch(0.55 0.19 25)"
            />
            <BarChip
              className="absolute"
              style={{ left: "18%", top: "8%", transform: "rotate(24deg)" }}
              value={100}
            />
            <RoundChip
              className="absolute"
              style={{ left: "6%", top: "42%", transform: "rotate(8deg)" }}
              color="oklch(0.5 0.15 260)"
            />
            {/* Top-right area */}
            <BarChip
              className="absolute"
              style={{ right: "10%", top: "12%", transform: "rotate(-18deg)" }}
              value={50}
            />
            <RoundChip
              className="absolute"
              style={{ right: "8%", top: "38%", transform: "rotate(-5deg)" }}
              color="oklch(0.62 0.14 82)"
            />
            {/* Bottom-left */}
            <BarChip
              className="absolute"
              style={{ left: "12%", bottom: "14%", transform: "rotate(14deg)" }}
              value={50}
            />
            <RoundChip
              className="absolute"
              style={{ left: "22%", bottom: "8%", transform: "rotate(-6deg)" }}
              color="oklch(0.55 0.19 25)"
            />
            {/* Bottom-right */}
            <RoundChip
              className="absolute"
              style={{ right: "14%", bottom: "10%", transform: "rotate(18deg)" }}
              color="oklch(0.5 0.15 260)"
            />
            <BarChip
              className="absolute"
              style={{ right: "18%", bottom: "18%", transform: "rotate(-22deg)" }}
              value={100}
            />

            {/* Seats — placed ON the outer rim, at 90° angles */}
            <SeatSlot
              seat={seats.find((s) => s.position === "top")!}
              className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2"
              delay={80}
            />
            <SeatSlot
              seat={seats.find((s) => s.position === "left")!}
              className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2"
              delay={180}
            />
            <SeatSlot
              seat={seats.find((s) => s.position === "right")!}
              className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2"
              delay={260}
            />
            <SeatSlot
              seat={seats.find((s) => s.position === "bottom")!}
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2"
              isLocal
              delay={0}
            />
          </div>
        </section>

        {/* Start button — thinner & more elegant */}
        <div className="mt-8">
          <button
            type="button"
            disabled={!allReady}
            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden px-6 py-3 transition-all duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100"
            style={{
              borderRadius: "0.9rem",
              background: allReady
                ? "linear-gradient(160deg, oklch(0.5 0.15 155) 0%, oklch(0.32 0.10 155) 100%)"
                : "linear-gradient(160deg, oklch(0.3 0.02 40) 0%, oklch(0.2 0.02 40) 100%)",
              border: `1px solid ${allReady ? "oklch(0.62 0.15 155 / 60%)" : "oklch(0.4 0.02 40 / 45%)"}`,
              boxShadow: allReady
                ? "0 8px 18px -10px oklch(0.42 0.13 155 / 55%), 0 0 20px -4px oklch(0.6 0.18 155 / 40%), 0 1px 0 0 oklch(1 0 0 / 12%) inset"
                : "0 3px 8px -6px oklch(0 0 0 / 60%), 0 1px 0 0 oklch(1 0 0 / 5%) inset",
              opacity: allReady ? 1 : 0.78,
              animation: allReady ? "capi-glow 2.6s ease-in-out infinite" : undefined,
            }}
          >
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-60"
              style={{
                background:
                  "linear-gradient(180deg, oklch(1 0 0 / 18%) 0%, oklch(1 0 0 / 4%) 60%, transparent 100%)",
              }}
            />
            {allReady && (
              <span
                className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, oklch(1 0 0 / 22%), transparent)",
                  animation: "capi-sheen 2.6s ease-in-out infinite",
                }}
              />
            )}
            <Play
              className="h-4 w-4"
              style={{
                color: allReady ? "oklch(0.94 0.11 88)" : "oklch(0.6 0.03 80)",
                filter: allReady
                  ? "drop-shadow(0 0 6px oklch(0.82 0.14 82 / 35%))"
                  : "none",
              }}
              strokeWidth={2.2}
              fill="currentColor"
            />
            <span
              className="font-serif text-base font-semibold tracking-wide"
              style={{
                background: allReady
                  ? "linear-gradient(180deg, oklch(0.96 0.1 88), oklch(0.76 0.14 78))"
                  : "linear-gradient(180deg, oklch(0.68 0.03 80), oklch(0.52 0.03 80))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                textShadow: "0 1px 0 oklch(0 0 0 / 30%)",
              }}
            >
              {allReady ? "Commencer la partie" : "En attente des joueurs…"}
            </span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes capi-seat-in {
          0% { opacity: 0; transform: var(--seat-transform) scale(0.6); filter: blur(6px); }
          60% { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: var(--seat-transform) scale(1); filter: blur(0); }
        }
        @keyframes capi-photo-fade {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes capi-sheen {
          0% { left: -35%; }
          60%, 100% { left: 120%; }
        }
        @keyframes capi-glow {
          0%, 100% { box-shadow: 0 8px 18px -10px oklch(0.42 0.13 155 / 55%), 0 0 18px -4px oklch(0.6 0.18 155 / 35%), 0 1px 0 0 oklch(1 0 0 / 12%) inset; }
          50%  { box-shadow: 0 8px 18px -10px oklch(0.42 0.13 155 / 65%), 0 0 30px -2px oklch(0.65 0.2 155 / 55%), 0 1px 0 0 oklch(1 0 0 / 15%) inset; }
        }
      `}</style>
    </main>
  );
}

function RoundChip({
  className,
  style,
  color,
}: {
  className?: string;
  style?: React.CSSProperties;
  color: string;
}) {
  return (
    <div
      className={className}
      style={{
        width: 26,
        height: 26,
        borderRadius: "9999px",
        background: `radial-gradient(ellipse at 40% 30%, oklch(1 0 0 / 25%), transparent 60%), ${color}`,
        border: "1px solid oklch(0 0 0 / 55%)",
        boxShadow:
          "0 3px 5px oklch(0 0 0 / 60%), inset 0 -2px 0 oklch(0 0 0 / 40%), inset 0 1px 0 oklch(1 0 0 / 30%)",
        backgroundImage: `
          repeating-conic-gradient(from 0deg, oklch(1 0 0 / 15%) 0deg 15deg, transparent 15deg 30deg),
          radial-gradient(ellipse at 40% 30%, oklch(1 0 0 / 25%), transparent 60%)
        `,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 4,
          borderRadius: "9999px",
          background: color,
          border: "1px dashed oklch(1 0 0 / 40%)",
          boxShadow: "inset 0 1px 2px oklch(0 0 0 / 40%)",
        }}
      />
    </div>
  );
}

function BarChip({
  className,
  style,
  value,
}: {
  className?: string;
  style?: React.CSSProperties;
  value: 50 | 100;
}) {
  const base =
    value === 100
      ? "linear-gradient(160deg, oklch(0.5 0.15 260) 0%, oklch(0.32 0.12 260) 100%)"
      : "linear-gradient(160deg, oklch(0.55 0.19 25) 0%, oklch(0.35 0.14 25) 100%)";
  return (
    <div
      className={className}
      style={{
        width: 44,
        height: 14,
        borderRadius: 3,
        background: base,
        border: "1px solid oklch(0 0 0 / 60%)",
        boxShadow:
          "0 3px 5px oklch(0 0 0 / 60%), inset 0 -2px 0 oklch(0 0 0 / 35%), inset 0 1px 0 oklch(1 0 0 / 25%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "ui-serif, Georgia, serif",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.05em",
          color: "oklch(0.94 0.1 88)",
          textShadow: "0 1px 0 oklch(0 0 0 / 60%)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SeatSlot({
  seat,
  className,
  isLocal,
  delay = 0,
}: {
  seat: Seat;
  className?: string;
  isLocal?: boolean;
  delay?: number;
}) {
  const p = seat.player;
  const pos = seat.position;

  // Match the translate used in className so animation keyframes preserve position
  const seatTransform =
    pos === "top"
      ? "translate(-50%, -50%)"
      : pos === "bottom"
        ? "translate(-50%, 50%)"
        : pos === "left"
          ? "translate(-50%, -50%)"
          : "translate(50%, -50%)";

  return (
    <div
      className={`flex flex-col items-center gap-1.5 ${className ?? ""}`}
      style={{
        // @ts-expect-error CSS var
        "--seat-transform": seatTransform,
        animation: `capi-seat-in 520ms ${delay}ms cubic-bezier(.2,.8,.25,1) both`,
      }}
    >
      {p ? (
        <>
          <div className="relative">
            <div
              className="overflow-hidden rounded-full border-2"
              style={{
                width: 76,
                height: 76,
                borderColor: isLocal ? "oklch(0.82 0.14 82 / 95%)" : "oklch(0.82 0.14 82 / 65%)",
                background:
                  "linear-gradient(160deg, oklch(0.38 0.05 40), oklch(0.24 0.04 40))",
                boxShadow: isLocal
                  ? "0 6px 16px -6px oklch(0 0 0 / 75%), 0 0 0 3px oklch(0.82 0.14 82 / 25%), 0 0 14px -2px oklch(0.82 0.14 82 / 45%)"
                  : "0 6px 14px -6px oklch(0 0 0 / 70%), 0 0 0 2px oklch(0 0 0 / 45%)",
              }}
            >
              <img
                src={p.photo}
                alt={p.name}
                width={200}
                height={200}
                className="h-full w-full object-cover"
                style={{ animation: `capi-photo-fade 700ms ${delay + 120}ms ease-out both` }}
                loading="lazy"
              />
            </div>
            {/* Online dot */}
            <span
              className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2"
              style={{
                background: p.online ? "oklch(0.7 0.19 145)" : "oklch(0.6 0.02 80)",
                borderColor: "oklch(0.15 0.03 40)",
                boxShadow: p.online
                  ? "0 0 8px oklch(0.7 0.19 145 / 70%), 0 1px 2px oklch(0 0 0 / 60%)"
                  : "0 1px 2px oklch(0 0 0 / 60%)",
              }}
              aria-label={p.online ? "Connecté" : "Hors ligne"}
            />
          </div>
          <div className="text-center leading-tight">
            <p
              className="font-serif text-sm font-semibold"
              style={{ color: "oklch(0.95 0.06 85)", textShadow: "0 1px 2px oklch(0 0 0 / 80%)" }}
            >
              {p.name}
            </p>
            <p
              className="text-[10px] uppercase tracking-[0.15em]"
              style={{ color: "oklch(0.8 0.1 82 / 85%)" }}
            >
              Niv. {p.level}
            </p>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="group flex flex-col items-center gap-1.5 transition-transform duration-150 active:scale-95"
          aria-label="Inviter un joueur"
        >
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-full border-2"
            style={{
              width: 76,
              height: 76,
              background:
                "radial-gradient(circle at 35% 22%, oklch(0.45 0.09 45) 0%, oklch(0.28 0.07 40) 55%, oklch(0.16 0.05 35) 100%)",
              borderColor: "oklch(0.82 0.14 82 / 75%)",
              boxShadow:
                "0 6px 16px -6px oklch(0 0 0 / 75%), 0 0 0 3px oklch(0.82 0.14 82 / 18%), inset 0 1px 0 oklch(1 0 0 / 15%), inset 0 -8px 14px oklch(0 0 0 / 55%)",
            }}
          >
            {/* Wood/leather grain */}
            <span
              className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
              style={{
                backgroundImage:
                  "repeating-radial-gradient(circle at 50% 50%, oklch(0 0 0 / 25%) 0 1px, transparent 1px 4px), radial-gradient(oklch(1 0 0 / 12%) 1px, transparent 1px)",
                backgroundSize: "auto, 5px 5px",
              }}
            />
            <Plus
              className="h-8 w-8 transition-transform duration-200 group-active:scale-90"
              strokeWidth={2.4}
              style={{
                color: "oklch(0.92 0.13 85)",
                filter:
                  "drop-shadow(0 1px 0 oklch(0 0 0 / 60%)) drop-shadow(0 0 6px oklch(0.82 0.14 82 / 55%))",
              }}
            />
          </div>
          <p
            className="font-serif text-xs font-semibold tracking-wide"
            style={{ color: "oklch(0.88 0.1 85)", textShadow: "0 1px 2px oklch(0 0 0 / 80%)" }}
          >
            Inviter
          </p>
        </button>
      )}
    </div>
  );
}
