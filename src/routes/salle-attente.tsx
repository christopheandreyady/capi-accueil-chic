import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, ArrowLeft, Crown, Check, Copy, QrCode, Share2, UserPlus } from "lucide-react";
import bistrotTable from "@/assets/capi-bistrot-table.jpg";
import capiEmblem from "@/assets/capi-emblem.png";
import { InviteModal } from "@/components/InviteModal";
import { PremiumModal } from "@/components/PremiumModal";
import { buildInviteLink, defaultTableConfig, loadTableConfig, type TableConfig } from "@/lib/table-config";
import { getWaitingRoomState, markSeatReady } from "@/lib/waiting-room-state";

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

type Position = "bottom" | "top" | "left" | "right";
type Team = "A" | "B";

type Player = {
  name: string;
  level: number;
  photo: string;
  online: boolean;
  ready: boolean;
  host?: boolean;
  isBot?: boolean;
};

// Dev-only bots used to fill empty seats so a table can be tested solo.
// Ordered by seat position; index matches an empty seat's slot when filling.
const DEV_BOTS: Record<Exclude<Position, "bottom">, Player> = {
  top: {
    name: "Bot Jean-Luc",
    level: 18,
    photo: "https://i.pravatar.cc/200?img=68",
    online: true,
    ready: true,
    isBot: true,
  },
  left: {
    name: "Bot Margaux",
    level: 15,
    photo: "https://i.pravatar.cc/200?img=47",
    online: true,
    ready: true,
    isBot: true,
  },
  right: {
    name: "Bot Alex",
    level: 12,
    photo: "https://i.pravatar.cc/200?img=15",
    online: true,
    ready: true,
    isBot: true,
  },
};

type Seat = {
  position: Position;
  team: Team;
  player: Player | null;
};

// Teams: bottom + top = A, left + right = B (partner is across the table)
const initialSeats: Seat[] = [
  {
    position: "bottom",
    team: "A",
    player: {
      name: "Vous",
      level: 22,
      photo: "https://i.pravatar.cc/200?img=12",
      online: true,
      ready: false,
      host: true,
    },
  },
  {
    position: "top",
    team: "A",
    player: {
      name: "Jean-Luc",
      level: 27,
      photo: "https://i.pravatar.cc/200?img=68",
      online: true,
      ready: true,
      isBot: true,
    },
  },
  {
    position: "left",
    team: "B",
    player: {
      name: "Margaux",
      level: 14,
      photo: "https://i.pravatar.cc/200?img=47",
      online: true,
      ready: true,
      isBot: true,
    },
  },
  { position: "right", team: "B", player: null },
];

function WaitingRoom() {
  const navigate = useNavigate();
  const [cfg, setCfg] = useState<TableConfig>(() => defaultTableConfig());
  const [seats, setSeats] = useState<Seat[]>(initialSeats);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const stored = loadTableConfig();
    if (stored) setCfg(stored);
    // Dev helper: auto-fill any empty seat with a ready AI bot so we can
    // start a game without waiting for real players. Skip the bottom seat
    // (that's always the human using the app).
    setSeats((prev) =>
      prev.map((seat) => {
        if (seat.position === "bottom") return seat;
        if (seat.player) {
          return seat.player.isBot && !seat.player.ready
            ? { ...seat, player: { ...seat.player, ready: true } }
            : seat;
        }
        const bot = DEV_BOTS[seat.position];
        return bot ? { ...seat, player: { ...bot, ready: true } } : seat;
      }),
    );
  }, []);

  const inviteLink = useMemo(() => buildInviteLink(cfg.code), [cfg.code]);
  const total = 4;
  const { playersCount, readyCount, allReady, roomFull } = getWaitingRoomState(seats, total);
  const localReady = seats.find((s) => s.position === "bottom")?.player?.ready ?? false;

  // Enter the starting state only when the room is complete and every
  // connected player is represented by the same ready flag used by the UI.
  useEffect(() => {
    setIsStarting(allReady);
    if (allReady) {
      setInviteOpen(false);
      setQrOpen(false);
      setCopied(false);
    }
  }, [allReady]);

  // Re-check both invariants after the short transition. If a player leaves
  // or becomes unavailable, the cleanup cancels navigation immediately.
  useEffect(() => {
    if (!isStarting || !allReady) return;
    const t = window.setTimeout(() => {
      if (playersCount === total && readyCount === total) {
        navigate({ to: "/partie" });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [allReady, isStarting, navigate, playersCount, readyCount]);




  function markReady(pos: Position) {
    setSeats((current) => markSeatReady(current, pos));
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(cfg.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* noop */
    }
  }

  async function share() {
    const data = {
      title: "Rejoignez ma table CAPI",
      text: `Rejoignez ma table de Contrée avec le code ${cfg.code}`,
      url: inviteLink,
    };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* fallthrough */
      }
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* noop */
    }
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Ambient bistro atmosphere — identical stack to the homepage /
          BistrotShell so the waiting room shares the same visual identity. */}
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
            "linear-gradient(180deg, oklch(0.12 0.03 40 / 75%) 0%, transparent 22%, transparent 55%, oklch(0.08 0.02 40 / 92%) 100%)",
        }}
      />



      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-none flex-col px-2 pt-4 pb-4">
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
              {cfg.name}
            </h1>
            <span
              className="mt-0.5 text-[11px] uppercase tracking-[0.25em]"
              style={{ color: "oklch(0.8 0.08 82 / 75%)" }}
            >
              {playersCount}/{total} joueurs · {readyCount} prêts
            </span>
          </div>

          <img
            src={capiEmblem}
            alt="CAPI"
            width={1024}
            height={1024}
            className="h-16 w-16"
            style={{
              filter:
                "drop-shadow(0 8px 14px oklch(0 0 0 / 75%)) drop-shadow(0 0 16px oklch(0.85 0.15 82 / 55%)) contrast(1.18) saturate(1.18) brightness(1.14)",
            }}
          />

        </header>

        {/* Invite code bar */}
        {!isStarting && <div
          className="mt-4 flex items-center gap-2 rounded-2xl border px-3 py-2"
          style={{
            background: "oklch(0.16 0.03 40 / 70%)",
            borderColor: "oklch(0.82 0.14 82 / 25%)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 10px 24px -18px oklch(0 0 0 / 70%)",
          }}
        >
          <span
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "oklch(0.8 0.08 82 / 75%)" }}
          >
            Code
          </span>
          <span
            className="font-serif text-base font-bold tracking-[0.25em]"
            style={{
              color: "oklch(0.94 0.11 88)",
              textShadow: "0 1px 0 oklch(0 0 0 / 50%)",
            }}
          >
            {cfg.code}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <IconAction label="Copier" onClick={copyCode}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </IconAction>
            <IconAction label="QR Code" onClick={() => setQrOpen(true)}>
              <QrCode className="h-4 w-4" />
            </IconAction>
            <IconAction label="Partager" onClick={share}>
              <Share2 className="h-4 w-4" />
            </IconAction>
          </div>
        </div>}

        {/* Table area — the wooden bistro table image is a bounded, centered
            UI object. Seats sit around the OUTSIDE of the wooden border. */}
        <section className="relative mx-auto my-auto flex w-full flex-1 items-center justify-center px-1 py-2">
          <div
            className="relative"
            style={{ width: "min(100vw, calc((100dvh - 130px) * 1.55), 1020px)", aspectRatio: "3 / 2" }}
          >
            <img
              src={bistrotTable}
              alt=""
              width={1280}
              height={1280}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              style={{ filter: "drop-shadow(0 30px 40px oklch(0 0 0 / 75%)) drop-shadow(0 10px 18px oklch(0 0 0 / 55%))" }}
            />
            {/* Warm key light on the felt — masked to the round felt area only. */}
            <div className="pointer-events-none absolute inset-[8%] rounded-full" style={{ background:"radial-gradient(45% 38% at 50% 45%, oklch(0.92 0.15 78 / 22%) 0%, oklch(0.85 0.12 72 / 8%) 50%, transparent 78%)" }} />
            <div className="pointer-events-none absolute inset-[8%] rounded-full" style={{ background:"radial-gradient(60% 55% at 50% 55%, transparent 0%, transparent 55%, oklch(0 0 0 / 32%) 100%)" }} />

            {/* CAPI emblem engraved into the felt — stronger contrast so
                the mark reads clearly while keeping the embossed feel. */}
            <img
              src={capiEmblem}
              alt=""
              aria-hidden="true"
              width={512}
              height={512}
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[5]"
              style={{
                width: "26%",
                height: "auto",
                opacity: 0.44,
                mixBlendMode: "overlay",
                filter: "drop-shadow(0 1px 0 oklch(0 0 0 / 70%)) drop-shadow(0 -1px 0 oklch(1 0 0 / 18%)) contrast(1.15)",
              }}
            />


            {/* Ambient decorations resting on the wood — corners only, never
                obstruct the seats or the empty center of the table. */}
            <AmbientDecor />

            {/* Seats — anchored to the TABLE container (percentages), sitting
                on the wooden rim just inside the table edge so every avatar
                stays in the play zone and scales with the table. */}
            <SeatSlot
              seat={seats.find((s) => s.position === "top")!}
              style={{ left: "50%", top: "6%", transform: "translate(-50%, 0)" }}
              delay={80}
              onInvite={() => setInviteOpen(true)}
            />
            <SeatSlot
              seat={seats.find((s) => s.position === "left")!}
              style={{ left: "6%", top: "50%", transform: "translate(0, -50%)" }}
              delay={180}
              onInvite={() => setInviteOpen(true)}
            />
            <SeatSlot
              seat={seats.find((s) => s.position === "right")!}
              style={{ right: "6%", top: "50%", transform: "translate(0, -50%)" }}
              delay={260}
              onInvite={() => setInviteOpen(true)}
            />
            <SeatSlot
              seat={seats.find((s) => s.position === "bottom")!}
              style={{ left: "50%", bottom: "6%", transform: "translate(-50%, 0)" }}
              isLocal
              delay={0}
              onInvite={() => setInviteOpen(true)}
            />
          </div>
        </section>



        {/* Bottom actions — a single "Je suis prêt" button; everything disappears when the table is fully ready */}
        <div className="relative z-30 mt-10 flex flex-col gap-3">
          {!isStarting && playersCount < total && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border py-2.5 text-sm font-semibold transition active:scale-[0.98] animate-fade-in"
              style={{
                background: "oklch(0.18 0.03 40 / 70%)",
                borderColor: "oklch(0.82 0.14 82 / 30%)",
                color: "oklch(0.92 0.11 85)",
                backdropFilter: "blur(8px)",
                boxShadow: "inset 0 1px 0 oklch(1 0 0 / 6%)",
              }}
            >
              <UserPlus className="h-4 w-4" />
              Inviter des joueurs
            </button>
          )}

          {!isStarting && roomFull && !localReady && (
            <button
              type="button"
              onClick={() => markReady("bottom")}
              className="group relative flex w-full items-center justify-center gap-3 overflow-hidden px-6 py-4 transition-all duration-200 ease-out active:scale-[0.985] disabled:cursor-not-allowed disabled:active:scale-100 animate-fade-in"
              style={{
                borderRadius: "1.15rem",
                background: roomFull
                  ? "linear-gradient(168deg, oklch(0.42 0.12 152) 0%, oklch(0.30 0.10 152) 48%, oklch(0.20 0.07 150) 100%)"
                  : "linear-gradient(168deg, oklch(0.24 0.03 42) 0%, oklch(0.16 0.02 40) 100%)",
                border: `1px solid ${roomFull ? "oklch(0.82 0.14 82 / 65%)" : "oklch(0.35 0.02 40 / 45%)"}`,
                boxShadow: roomFull
                  ? "0 18px 32px -14px oklch(0 0 0 / 80%), 0 8px 16px -6px oklch(0.32 0.10 152 / 55%), inset 0 1px 0 oklch(1 0 0 / 18%), inset 0 -10px 18px oklch(0 0 0 / 45%), inset 0 0 0 1px oklch(0.82 0.14 82 / 22%)"
                  : "0 12px 24px -12px oklch(0 0 0 / 72%), inset 0 1px 0 oklch(1 0 0 / 12%), inset 0 -8px 14px oklch(0 0 0 / 40%)",
                opacity: 1,
              }}
            >
              <span
                className="pointer-events-none absolute inset-0 opacity-25 mix-blend-overlay"
                style={{
                  backgroundImage:
                    "radial-gradient(oklch(1 0 0 / 8%) 0.5px, transparent 0.5px), radial-gradient(oklch(0 0 0 / 12%) 0.5px, transparent 0.5px)",
                  backgroundSize: "3px 3px, 4px 4px",
                  backgroundPosition: "0 0, 1px 2px",
                }}
              />
              <span
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-70"
                style={{
                  background:
                    "linear-gradient(180deg, oklch(1 0 0 / 18%) 0%, oklch(1 0 0 / 3%) 60%, transparent 100%)",
                }}
              />
              {roomFull && (
                <span
                  className="pointer-events-none absolute inset-[3px] rounded-[0.95rem]"
                  style={{ border: "1px solid oklch(0.82 0.14 82 / 28%)" }}
                />
              )}
              <Check
                className="relative h-4 w-4"
                style={{ color: "oklch(0.94 0.11 88)" }}
                strokeWidth={2.6}
              />
              <span
                className="relative font-serif text-base font-semibold tracking-wide"
                style={{
                  background: roomFull
                    ? "linear-gradient(180deg, oklch(0.98 0.10 88), oklch(0.72 0.14 78))"
                    : "linear-gradient(180deg, oklch(0.62 0.03 80), oklch(0.48 0.03 80))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  textShadow: "0 1px 0 oklch(0 0 0 / 45%)",
                }}
              >
                Je suis prêt
              </span>
            </button>
          )}

          {allReady && (
            <p
              className="text-center font-serif text-sm tracking-[0.25em] uppercase animate-fade-in"
              style={{ color: "oklch(0.92 0.11 85)", textShadow: "0 1px 0 oklch(0 0 0 / 50%)" }}
            >
              La partie commence…
            </p>
          )}

          {!isStarting && playersCount < total && (
            <p
              className="text-center text-[11px] uppercase tracking-[0.22em] animate-fade-in"
              style={{ color: "oklch(0.75 0.05 82 / 65%)" }}
            >
              {`${total - playersCount} place${total - playersCount > 1 ? "s" : ""} libre${total - playersCount > 1 ? "s" : ""}`}
            </p>
          )}
        </div>


      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} code={cfg.code} />

      <PremiumModal open={qrOpen} onClose={() => setQrOpen(false)} title="QR Code" subtitle="Scannez pour rejoindre">
        <div className="flex flex-col items-center gap-4">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&color=F0D68C&bgcolor=1B140E&data=${encodeURIComponent(inviteLink)}`}
            alt="QR code d'invitation"
            width={240}
            height={240}
            className="rounded-2xl"
            style={{
              border: "1px solid oklch(0.82 0.14 82 / 35%)",
              boxShadow: "0 12px 30px -12px oklch(0 0 0 / 75%)",
            }}
          />
          <span
            className="font-serif text-2xl font-bold tracking-[0.3em]"
            style={{
              color: "oklch(0.94 0.11 88)",
              textShadow: "0 1px 0 oklch(0 0 0 / 60%)",
            }}
          >
            {cfg.code}
          </span>
        </div>
      </PremiumModal>

      <style>{`
        @keyframes capi-seat-in {
          0% { opacity: 0; scale: 0.6; filter: blur(6px); }
          60% { opacity: 1; filter: blur(0); }
          100% { opacity: 1; scale: 1; filter: blur(0); }
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

function IconAction({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full transition active:scale-90"
      style={{
        background: "oklch(0.14 0.02 40 / 80%)",
        border: "1px solid oklch(0.82 0.14 82 / 30%)",
        color: "oklch(0.9 0.11 85)",
      }}
    >
      {children}
    </button>
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

function SuitMark({
  symbol,
  color,
  className,
  style,
}: {
  symbol: string;
  color: "black" | "red";
  className?: string;
  style?: React.CSSProperties;
}) {
  const isRed = color === "red";
  return (
    <span
      className={className}
      style={{
        fontFamily: "ui-serif, Georgia, serif",
        fontSize: 20,
        lineHeight: 1,
        color: isRed ? "oklch(0.48 0.18 25)" : "oklch(0.15 0.02 40)",
        textShadow: isRed
          ? "0 1px 0 oklch(0 0 0 / 25%), 0 0 6px oklch(0.5 0.2 25 / 25%)"
          : "0 1px 0 oklch(1 0 0 / 8%), 0 0 4px oklch(0 0 0 / 40%)",
        opacity: 0.85,
        ...style,
      }}
    >
      {symbol}
    </span>
  );
}

type TokenColor = "white" | "red" | "blue" | "green" | "yellow";

function tokenGradient(color: TokenColor) {
  switch (color) {
    case "white":
      return "linear-gradient(160deg, oklch(0.96 0.02 90) 0%, oklch(0.82 0.03 85) 100%)";
    case "red":
      return "linear-gradient(160deg, oklch(0.58 0.20 25) 0%, oklch(0.38 0.15 25) 100%)";
    case "blue":
      return "linear-gradient(160deg, oklch(0.50 0.15 245) 0%, oklch(0.32 0.11 250) 100%)";
    case "green":
      return "linear-gradient(160deg, oklch(0.55 0.15 152) 0%, oklch(0.36 0.11 152) 100%)";
    case "yellow":
      return "linear-gradient(160deg, oklch(0.86 0.16 95) 0%, oklch(0.66 0.15 82) 100%)";
  }
}

function ScoreRound({
  className,
  style,
  color,
}: {
  className?: string;
  style?: React.CSSProperties;
  color: TokenColor;
}) {
  return (
    <div
      className={className}
      style={{
        width: 14,
        height: 14,
        borderRadius: "9999px",
        background: tokenGradient(color),
        border: "1px solid oklch(0 0 0 / 55%)",
        boxShadow:
          "0 2px 3px oklch(0 0 0 / 55%), inset 0 1px 0 oklch(1 0 0 / 35%), inset 0 -1px 0 oklch(0 0 0 / 30%)",
        ...style,
      }}
    />
  );
}

function ScoreBarMedium({
  className,
  style,
  color,
}: {
  className?: string;
  style?: React.CSSProperties;
  color: TokenColor;
}) {
  return (
    <div
      className={className}
      style={{
        width: 26,
        height: 7,
        borderRadius: 2,
        background: tokenGradient(color),
        border: "1px solid oklch(0 0 0 / 60%)",
        boxShadow:
          "0 2px 3px oklch(0 0 0 / 55%), inset 0 1px 0 oklch(1 0 0 / 30%), inset 0 -1px 0 oklch(0 0 0 / 30%)",
        ...style,
      }}
    />
  );
}

function ScoreBarLong({
  className,
  style,
  color,
}: {
  className?: string;
  style?: React.CSSProperties;
  color: TokenColor;
}) {
  return (
    <div
      className={className}
      style={{
        width: 44,
        height: 7,
        borderRadius: 2,
        background: tokenGradient(color),
        border: "1px solid oklch(0 0 0 / 60%)",
        boxShadow:
          "0 2px 3px oklch(0 0 0 / 55%), inset 0 1px 0 oklch(1 0 0 / 30%), inset 0 -1px 0 oklch(0 0 0 / 30%)",
        ...style,
      }}
    />
  );
}



function SeatSlot({
  seat,
  style,
  isLocal,
  delay = 0,
  onInvite,
}: {
  seat: Seat;
  style?: React.CSSProperties;
  isLocal?: boolean;
  delay?: number;
  onInvite: () => void;
}) {
  const p = seat.player;

  const teamRing =
    seat.team === "A"
      ? "oklch(0.72 0.16 55 / 85%)" /* warm gold-orange for team A */
      : "oklch(0.62 0.16 240 / 85%)"; /* cool blue for team B */

  return (
    <div
      className="pointer-events-auto absolute z-20 flex flex-col items-center gap-1.5"
      style={{
        ...style,
        animation: `capi-seat-in 520ms ${delay}ms cubic-bezier(.2,.8,.25,1) both`,
      }}
    >

      {p ? (
        <>
          <div className="relative">
            <div
              className="overflow-hidden rounded-full border-2"
              style={{
                width: 65,
                height: 65,
                borderColor: teamRing,
                background:
                  "linear-gradient(160deg, oklch(0.38 0.05 40), oklch(0.24 0.04 40))",
                boxShadow: isLocal
                  ? `0 6px 16px -6px oklch(0 0 0 / 75%), 0 0 0 3px ${teamRing.replace("85%", "30%")}, 0 0 14px -2px ${teamRing.replace("85%", "45%")}`
                  : `0 6px 14px -6px oklch(0 0 0 / 70%), 0 0 0 2px oklch(0 0 0 / 45%), 0 0 10px -3px ${teamRing.replace("85%", "35%")}`,
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

            {/* Host crown */}
            {p.host && (
              <span
                className="absolute -left-1 -top-2 flex h-6 w-6 items-center justify-center rounded-full"
                style={{
                  background:
                    "linear-gradient(160deg, oklch(0.85 0.16 82), oklch(0.62 0.16 65))",
                  border: "1px solid oklch(0.35 0.06 45)",
                  boxShadow:
                    "0 2px 6px oklch(0 0 0 / 60%), 0 0 8px oklch(0.82 0.14 82 / 50%)",
                }}
                aria-label="Hôte"
              >
                <Crown
                  className="h-3 w-3"
                  strokeWidth={2.6}
                  style={{ color: "oklch(0.2 0.04 40)" }}
                />
              </span>
            )}

            {/* Ready badge (pill) */}
            <span
              className="absolute -top-2 right-0 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
              style={{
                background: p.ready
                  ? "linear-gradient(160deg, oklch(0.5 0.15 155), oklch(0.32 0.10 155))"
                  : "oklch(0.2 0.02 40 / 85%)",
                border: `1px solid ${p.ready ? "oklch(0.62 0.15 155 / 60%)" : "oklch(0.82 0.14 82 / 25%)"}`,
                color: p.ready ? "oklch(0.95 0.1 88)" : "oklch(0.8 0.05 82 / 80%)",
                letterSpacing: "0.08em",
                boxShadow: "0 2px 4px oklch(0 0 0 / 50%)",
              }}
            >
              {p.ready ? <Check className="h-2.5 w-2.5" /> : null}
              {p.ready ? "Prêt" : "…"}
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
          onClick={onInvite}
          className="group flex flex-col items-center gap-1.5 transition-transform duration-150 active:scale-95"
          aria-label="Inviter un joueur"
        >
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-full border-2"
            style={{
              width: 65,
              height: 65,
              background:
                "radial-gradient(circle at 35% 22%, oklch(0.45 0.09 45) 0%, oklch(0.28 0.07 40) 55%, oklch(0.16 0.05 35) 100%)",
              borderColor: "oklch(0.82 0.14 82 / 75%)",
              boxShadow:
                "0 6px 16px -6px oklch(0 0 0 / 75%), 0 0 0 3px oklch(0.82 0.14 82 / 18%), inset 0 1px 0 oklch(1 0 0 / 15%), inset 0 -8px 14px oklch(0 0 0 / 55%)",
            }}
          >
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

// Ambient bistro-table decorations resting on the wooden frame around the
// felt. Pure visual flourish — corners only, never over seats or the center.
function AmbientDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {/* Top-left: small stack of resting cards, slightly tilted */}
      <div className="absolute" style={{ top: "5%", left: "4%", transform: "rotate(-14deg)" }}>
        <MiniCardStack count={3} />
      </div>
      {/* Top-right: score notebook with pencil */}
      <div className="absolute" style={{ top: "6%", right: "4%", transform: "rotate(6deg)" }}>
        <MiniNotebook />
      </div>
      {/* Bottom-left: a couple of counting chips */}
      <div className="absolute" style={{ bottom: "6%", left: "5%", transform: "rotate(-8deg)" }}>
        <MiniChips />
      </div>
      {/* Bottom-right: a lone card lying flat on the wood */}
      <div className="absolute" style={{ bottom: "5%", right: "5%", transform: "rotate(18deg)" }}>
        <MiniCardStack count={1} />
      </div>
    </div>
  );
}

function MiniCardStack({ count }: { count: number }) {
  return (
    <div className="relative" style={{ width: 32, height: 46 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-[4px]"
          style={{
            transform: `translate(${i * 1.2}px, ${-i * 1.4}px) rotate(${(i - count / 2) * 3}deg)`,
            background: "linear-gradient(160deg, oklch(0.32 0.11 25) 0%, oklch(0.18 0.06 25) 100%)",
            border: "1px solid oklch(0.55 0.14 78 / 55%)",
            boxShadow:
              "0 4px 8px -3px oklch(0 0 0 / 75%), inset 0 1px 0 oklch(1 0 0 / 15%), inset 0 0 8px oklch(0 0 0 / 45%)",
          }}
        >
          <div
            className="absolute inset-[3px] rounded-[2px]"
            style={{
              border: "1px solid oklch(0.82 0.14 82 / 40%)",
              backgroundImage:
                "repeating-linear-gradient(45deg, oklch(0.72 0.14 82 / 18%) 0 1px, transparent 1px 4px)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function MiniNotebook() {
  return (
    <div
      className="relative"
      style={{
        width: 40,
        height: 30,
        borderRadius: 3,
        background: "linear-gradient(160deg, oklch(0.55 0.05 60) 0%, oklch(0.38 0.04 55) 100%)",
        border: "1px solid oklch(0.25 0.03 40)",
        boxShadow:
          "0 4px 8px -3px oklch(0 0 0 / 75%), inset 0 1px 0 oklch(1 0 0 / 20%), inset 0 -4px 6px oklch(0 0 0 / 40%)",
      }}
    >
      {/* stitching lines */}
      <div
        className="absolute inset-x-1 top-1 h-[1px]"
        style={{ background: "oklch(0.85 0.14 82 / 45%)" }}
      />
      <div
        className="absolute inset-x-1 top-2.5 h-[1px]"
        style={{ background: "oklch(0.85 0.14 82 / 35%)" }}
      />
      <div
        className="absolute inset-x-1 top-4 h-[1px]"
        style={{ background: "oklch(0.85 0.14 82 / 25%)" }}
      />
      {/* pencil */}
      <div
        className="absolute"
        style={{
          right: -10,
          top: 8,
          width: 22,
          height: 3,
          borderRadius: 1,
          background: "linear-gradient(90deg, oklch(0.85 0.14 82) 0%, oklch(0.55 0.10 60) 100%)",
          transform: "rotate(28deg)",
          boxShadow: "0 2px 3px oklch(0 0 0 / 60%)",
        }}
      />
    </div>
  );
}

function MiniChips() {
  return (
    <div className="relative" style={{ width: 34, height: 20 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: i * 9,
            top: (i % 2) * 2,
            width: 14,
            height: 14,
            borderRadius: 999,
            background:
              i === 1
                ? "radial-gradient(circle at 35% 30%, oklch(0.55 0.18 25), oklch(0.30 0.12 25) 70%)"
                : "radial-gradient(circle at 35% 30%, oklch(0.85 0.14 82), oklch(0.55 0.12 60) 70%)",
            border: "1px solid oklch(0.15 0.02 40 / 75%)",
            boxShadow:
              "0 2px 4px oklch(0 0 0 / 70%), inset 0 1px 0 oklch(1 0 0 / 25%), inset 0 -2px 3px oklch(0 0 0 / 40%)",
            transform: `rotate(${i * 12 - 12}deg)`,
          }}
        />
      ))}
    </div>
  );
}
