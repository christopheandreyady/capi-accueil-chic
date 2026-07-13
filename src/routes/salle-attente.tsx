import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Check, Clock, ArrowLeft, Play } from "lucide-react";
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
  avatar: string; // initials
  ready: boolean;
};

type Seat =
  | { position: "bottom" | "top" | "left" | "right"; player: Player | null };

// Mock seating. Bottom = local player, top = partner, left/right = opponents.
const seats: Seat[] = [
  {
    position: "top",
    player: { name: "Jean-Luc", level: 27, avatar: "JL", ready: true },
  },
  {
    position: "left",
    player: { name: "Margaux", level: 14, avatar: "MG", ready: false },
  },
  { position: "right", player: null },
  {
    position: "bottom",
    player: { name: "Vous", level: 22, avatar: "VS", ready: true },
  },
];

function WaitingRoom() {
  const players = seats.filter((s) => s.player).length;
  const total = 4;
  const allReady = players === total && seats.every((s) => !s.player || s.player.ready);

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Background */}
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
            "radial-gradient(60% 35% at 50% 0%, oklch(0.85 0.14 75 / 30%) 0%, oklch(0.7 0.12 65 / 12%) 40%, transparent 70%)",
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

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pt-6 pb-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link
            to="/"
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
        <section className="relative mt-6 flex-1">
          <div className="relative mx-auto aspect-square w-full max-w-[380px]">
            {/* Felt table circle */}
            <div
              className="absolute inset-6 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 50% 40%, oklch(0.4 0.09 150) 0%, oklch(0.28 0.08 150) 60%, oklch(0.2 0.06 150) 100%)",
                boxShadow: `
                  0 0 0 6px oklch(0.22 0.05 40),
                  0 0 0 8px oklch(0.82 0.14 82 / 35%),
                  0 0 0 14px oklch(0.16 0.04 35),
                  0 30px 60px -20px oklch(0 0 0 / 80%),
                  inset 0 0 80px oklch(0 0 0 / 50%)
                `,
              }}
            >
              {/* Center emblem */}
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src={capiEmblem}
                  alt=""
                  width={1024}
                  height={1024}
                  className="h-20 w-20 opacity-40"
                  style={{ filter: "drop-shadow(0 4px 10px oklch(0 0 0 / 60%))" }}
                />
              </div>
            </div>

            {/* Seats */}
            <SeatSlot seat={seats.find((s) => s.position === "top")!} className="absolute left-1/2 top-0 -translate-x-1/2" />
            <SeatSlot seat={seats.find((s) => s.position === "left")!} className="absolute left-0 top-1/2 -translate-y-1/2" />
            <SeatSlot seat={seats.find((s) => s.position === "right")!} className="absolute right-0 top-1/2 -translate-y-1/2" />
            <SeatSlot
              seat={seats.find((s) => s.position === "bottom")!}
              className="absolute bottom-0 left-1/2 -translate-x-1/2"
              isLocal
            />
          </div>
        </section>

        {/* Start button */}
        <div className="mt-6">
          <button
            type="button"
            disabled={!allReady}
            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden px-6 py-4 transition-all duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100"
            style={{
              borderRadius: "1.1rem",
              background: allReady
                ? "linear-gradient(160deg, oklch(0.5 0.15 155) 0%, oklch(0.32 0.10 155) 100%)"
                : "linear-gradient(160deg, oklch(0.32 0.02 40) 0%, oklch(0.22 0.02 40) 100%)",
              border: `1px solid ${allReady ? "oklch(0.62 0.15 155 / 60%)" : "oklch(0.4 0.02 40 / 50%)"}`,
              boxShadow: allReady
                ? "0 10px 22px -10px oklch(0.42 0.13 155 / 55%), 0 1px 0 0 oklch(1 0 0 / 15%) inset, 0 -8px 16px -8px oklch(0 0 0 / 40%) inset"
                : "0 4px 10px -6px oklch(0 0 0 / 60%), 0 1px 0 0 oklch(1 0 0 / 5%) inset",
              opacity: allReady ? 1 : 0.7,
            }}
          >
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-60"
              style={{
                background:
                  "linear-gradient(180deg, oklch(1 0 0 / 22%) 0%, oklch(1 0 0 / 4%) 60%, transparent 100%)",
              }}
            />
            <Play
              className="h-5 w-5"
              style={{
                color: allReady ? "oklch(0.94 0.11 88)" : "oklch(0.6 0.03 80)",
                filter: allReady
                  ? "drop-shadow(0 1px 0 oklch(0 0 0 / 50%)) drop-shadow(0 0 6px oklch(0.82 0.14 82 / 35%))"
                  : "none",
              }}
              strokeWidth={2.2}
              fill="currentColor"
            />
            <span
              className="font-serif text-lg font-semibold tracking-wide"
              style={{
                background: allReady
                  ? "linear-gradient(180deg, oklch(0.96 0.1 88), oklch(0.76 0.14 78))"
                  : "linear-gradient(180deg, oklch(0.65 0.03 80), oklch(0.5 0.03 80))",
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
    </main>
  );
}

function SeatSlot({
  seat,
  className,
  isLocal,
}: {
  seat: Seat;
  className?: string;
  isLocal?: boolean;
}) {
  const p = seat.player;

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className ?? ""}`}>
      {p ? (
        <>
          <div className="relative">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full border-2 font-serif text-lg font-semibold"
              style={{
                background:
                  "linear-gradient(160deg, oklch(0.38 0.05 40), oklch(0.24 0.04 40))",
                borderColor: isLocal ? "oklch(0.82 0.14 82 / 90%)" : "oklch(0.82 0.14 82 / 55%)",
                color: "oklch(0.92 0.1 85)",
                boxShadow:
                  "0 6px 14px -6px oklch(0 0 0 / 70%), 0 0 0 1px oklch(0 0 0 / 40%) inset",
              }}
            >
              {p.avatar}
            </div>
            {/* Ready pill */}
            <span
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2"
              style={{
                background: p.ready ? "oklch(0.68 0.19 145)" : "oklch(0.85 0.02 85)",
                borderColor: "oklch(0.15 0.03 40)",
                boxShadow: "0 2px 4px oklch(0 0 0 / 60%)",
              }}
              aria-label={p.ready ? "Prêt" : "En attente"}
            >
              {p.ready ? (
                <Check className="h-3 w-3" style={{ color: "oklch(0.15 0.05 145)" }} strokeWidth={3} />
              ) : (
                <Clock className="h-3 w-3" style={{ color: "oklch(0.35 0.02 80)" }} strokeWidth={2.5} />
              )}
            </span>
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
          className="flex flex-col items-center gap-1.5 transition active:scale-95"
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed"
            style={{
              background: "oklch(0.2 0.03 40 / 55%)",
              borderColor: "oklch(0.82 0.14 82 / 55%)",
              backdropFilter: "blur(4px)",
              boxShadow: "0 4px 12px -6px oklch(0 0 0 / 60%)",
            }}
          >
            <Plus className="h-6 w-6" style={{ color: "oklch(0.85 0.12 85)" }} strokeWidth={2} />
          </div>
          <p
            className="font-serif text-xs font-semibold tracking-wide"
            style={{ color: "oklch(0.85 0.1 85)", textShadow: "0 1px 2px oklch(0 0 0 / 80%)" }}
          >
            Inviter
          </p>
        </button>
      )}
    </div>
  );
}
