import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, ArrowLeft, Play, Crown, Check, Copy, QrCode, Share2, UserPlus } from "lucide-react";
import bistrotTable from "@/assets/capi-bistrot-table.jpg";
import capiEmblem from "@/assets/capi-emblem.png";
import { InviteModal } from "@/components/InviteModal";
import { PremiumModal } from "@/components/PremiumModal";
import { buildInviteLink, defaultTableConfig, loadTableConfig, type TableConfig } from "@/lib/table-config";

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
      ready: false,
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

  useEffect(() => {
    const stored = loadTableConfig();
    if (stored) setCfg(stored);
    // Dev helper: auto-fill any empty seat with a ready AI bot so we can
    // start a game without waiting for real players. Skip the bottom seat
    // (that's always the human using the app).
    setSeats((prev) =>
      prev.map((seat) => {
        if (seat.player || seat.position === "bottom") return seat;
        const bot = DEV_BOTS[seat.position];
        return bot ? { ...seat, player: bot } : seat;
      }),
    );
  }, []);

  const inviteLink = useMemo(() => buildInviteLink(cfg.code), [cfg.code]);
  const playersCount = seats.filter((s) => s.player).length;
  const total = 4;
  const readyCount = seats.filter((s) => s.player?.ready).length;
  const allReady = playersCount === total && readyCount === total;

  function toggleReady(pos: Position) {
    setSeats((s) =>
      s.map((seat) =>
        seat.position === pos && seat.player
          ? { ...seat, player: { ...seat.player, ready: !seat.player.ready } }
          : seat,
      ),
    );
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
            "radial-gradient(60% 35% at 50% 0%, oklch(0.85 0.14 75 / 34%) 0%, oklch(0.7 0.12 65 / 12%) 40%, transparent 70%)",
        }}
      />
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 50%, transparent 0%, oklch(0 0 0 / 42%) 60%, oklch(0.08 0.02 40 / 92%) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.12 0.03 40 / 72%) 0%, transparent 20%, transparent 55%, oklch(0.08 0.02 40 / 92%) 100%)",
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
            className="h-10 w-10"
            style={{
              filter:
                "drop-shadow(0 4px 8px oklch(0 0 0 / 60%)) drop-shadow(0 0 8px oklch(0.82 0.14 82 / 25%))",
            }}
          />
        </header>

        {/* Invite code bar */}
        <div
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
        </div>

        {/* Table area */}
        <section className="relative mt-6 flex-1">
          <div className="relative mx-auto aspect-square w-full max-w-[400px]">
            {/* Wooden bistro table — solid oak/walnut, rounded-square */}
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
              {/* Wood grain — flowing veins */}
              <div
                className="pointer-events-none absolute inset-0 opacity-70 mix-blend-overlay"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(92deg, oklch(0 0 0 / 10%) 0 1px, transparent 1px 5px), repeating-linear-gradient(88deg, oklch(1 0 0 / 4%) 0 1px, transparent 1px 11px), repeating-linear-gradient(94deg, oklch(0 0 0 / 6%) 0 2px, transparent 2px 34px)",
                }}
              />
              {/* Grain waves */}
              <div
                className="pointer-events-none absolute inset-0 opacity-55 mix-blend-overlay"
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse 140% 8% at 50% 18%, oklch(0.6 0.10 55 / 45%) 0%, transparent 60%), radial-gradient(ellipse 140% 6% at 50% 38%, oklch(0.22 0.06 38 / 55%) 0%, transparent 60%), radial-gradient(ellipse 140% 10% at 50% 58%, oklch(0.58 0.10 55 / 30%) 0%, transparent 60%), radial-gradient(ellipse 140% 6% at 50% 78%, oklch(0.22 0.06 38 / 50%) 0%, transparent 60%)",
                }}
              />
              {/* Wood knots & imperfections */}
              <div
                className="pointer-events-none absolute inset-0 opacity-55 mix-blend-multiply"
                style={{
                  backgroundImage:
                    "radial-gradient(circle 5px at 20% 66%, oklch(0.16 0.05 32) 0%, oklch(0.22 0.06 38 / 60%) 40%, transparent 75%), radial-gradient(circle 4px at 80% 24%, oklch(0.18 0.05 32) 0%, transparent 75%), radial-gradient(circle 3px at 65% 82%, oklch(0.18 0.05 32) 0%, transparent 75%), radial-gradient(circle 2px at 34% 12%, oklch(0.18 0.05 32) 0%, transparent 75%)",
                }}
              />
              {/* Satin sheen */}
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  background:
                    "linear-gradient(150deg, oklch(1 0 0 / 8%) 0%, transparent 35%, transparent 65%, oklch(0 0 0 / 18%) 100%)",
                }}
              />
              {/* Bevel */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  boxShadow:
                    "inset 0 0 0 1px oklch(0 0 0 / 55%), inset 0 0 0 2px oklch(1 0 0 / 7%)",
                }}
              />
            </div>

            {/* Playing mat — flat felt cloth, simply laid on the table */}
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
              {/* Faint printed suits — 12% opacity, integrated in fabric */}
              <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.12 }}>
                <IntegratedSuit symbol="♠" color="black" style={{ left: "6%", top: "5%", fontSize: 58, transform: "rotate(-14deg)" }} />
                <IntegratedSuit symbol="♥" color="red" style={{ right: "6%", top: "5%", fontSize: 58, transform: "rotate(12deg)" }} />
                <IntegratedSuit symbol="♦" color="red" style={{ left: "6%", bottom: "5%", fontSize: 58, transform: "rotate(10deg)" }} />
                <IntegratedSuit symbol="♣" color="black" style={{ right: "6%", bottom: "5%", fontSize: 58, transform: "rotate(-10deg)" }} />
              </div>

              {/* Felt fiber texture — fine, matte */}
              <div
                className="pointer-events-none absolute inset-0 opacity-70 mix-blend-overlay"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, oklch(1 0 0 / 4%) 0 1px, transparent 1px 2px), repeating-linear-gradient(-45deg, oklch(0 0 0 / 8%) 0 1px, transparent 1px 2px), radial-gradient(oklch(1 0 0 / 5%) 0.5px, transparent 0.5px), radial-gradient(oklch(0 0 0 / 7%) 0.5px, transparent 0.5px)",
                  backgroundSize: "auto, auto, 2px 2px, 3px 3px",
                }}
              />

              {/* Subtle worn spots */}
              <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                  background:
                    "radial-gradient(ellipse 22% 7% at 38% 62%, oklch(0 0 0 / 22%), transparent 70%), radial-gradient(ellipse 14% 5% at 68% 42%, oklch(1 0 0 / 5%), transparent 70%), radial-gradient(ellipse 10% 4% at 22% 32%, oklch(0 0 0 / 18%), transparent 70%)",
                }}
              />
            </div>

            {/* Score tokens — Team A pile, bottom-right on the wood */}
            <div className="absolute" style={{ right: "5%", bottom: "6%", width: 78, height: 68 }}>
              <ScoreBarLong className="absolute" style={{ left: 0, top: 0, transform: "rotate(-8deg)" }} color="white" />
              <ScoreBarLong className="absolute" style={{ left: 4, top: 10, transform: "rotate(-3deg)" }} color="green" />
              <ScoreBarMedium className="absolute" style={{ left: 2, top: 24, transform: "rotate(5deg)" }} color="blue" />
              <ScoreBarMedium className="absolute" style={{ left: 22, top: 30, transform: "rotate(-4deg)" }} color="red" />
              <ScoreRound className="absolute" style={{ left: 48, top: 8 }} color="yellow" />
              <ScoreRound className="absolute" style={{ left: 58, top: 22 }} color="white" />
              <ScoreRound className="absolute" style={{ left: 46, top: 36 }} color="red" />
            </div>

            {/* Score tokens — Team B pile, top-left on the wood */}
            <div className="absolute" style={{ left: "5%", top: "6%", width: 78, height: 68 }}>
              <ScoreBarLong className="absolute" style={{ left: 0, top: 0, transform: "rotate(9deg)" }} color="white" />
              <ScoreBarMedium className="absolute" style={{ left: 4, top: 16, transform: "rotate(-5deg)" }} color="green" />
              <ScoreBarMedium className="absolute" style={{ left: 24, top: 22, transform: "rotate(4deg)" }} color="yellow" />
              <ScoreRound className="absolute" style={{ left: 50, top: 4 }} color="red" />
              <ScoreRound className="absolute" style={{ left: 60, top: 18 }} color="blue" />
              <ScoreRound className="absolute" style={{ left: 46, top: 32 }} color="white" />
            </div>

            {/* Seats */}
            <SeatSlot
              seat={seats.find((s) => s.position === "top")!}
              className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2"
              delay={80}
              onToggleReady={toggleReady}
              onInvite={() => setInviteOpen(true)}
            />
            <SeatSlot
              seat={seats.find((s) => s.position === "left")!}
              className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2"
              delay={180}
              onToggleReady={toggleReady}
              onInvite={() => setInviteOpen(true)}
            />
            <SeatSlot
              seat={seats.find((s) => s.position === "right")!}
              className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2"
              delay={260}
              onToggleReady={toggleReady}
              onInvite={() => setInviteOpen(true)}
            />
            <SeatSlot
              seat={seats.find((s) => s.position === "bottom")!}
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2"
              isLocal
              delay={0}
              onToggleReady={toggleReady}
              onInvite={() => setInviteOpen(true)}
            />
          </div>
        </section>

        {/* Bottom actions — always above the table; lobby chrome hidden once 4 players are seated */}
        <div className="relative z-30 mt-10 flex flex-col gap-3">
          {playersCount < total && (

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

          <button
            type="button"
            disabled={!allReady}
            onClick={() => allReady && navigate({ to: "/partie" })}
            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden px-6 py-3.5 transition-all duration-200 ease-out active:scale-[0.985] disabled:cursor-not-allowed disabled:active:scale-100"
            style={{
              borderRadius: "1rem",
              background: allReady
                ? "linear-gradient(168deg, oklch(0.38 0.11 152) 0%, oklch(0.28 0.09 152) 50%, oklch(0.20 0.07 150) 100%)"
                : "linear-gradient(168deg, oklch(0.22 0.03 42) 0%, oklch(0.16 0.02 40) 100%)",
              border: `1px solid ${allReady ? "oklch(0.78 0.14 82 / 55%)" : "oklch(0.35 0.02 40 / 45%)"}`,
              boxShadow: allReady
                ? "0 14px 26px -14px oklch(0 0 0 / 75%), 0 6px 12px -6px oklch(0.32 0.10 152 / 55%), inset 0 1px 0 oklch(1 0 0 / 14%), inset 0 -8px 14px oklch(0 0 0 / 40%), inset 0 0 0 1px oklch(0.82 0.14 82 / 18%)"
                : "0 6px 14px -8px oklch(0 0 0 / 70%), inset 0 1px 0 oklch(1 0 0 / 6%), inset 0 -6px 10px oklch(0 0 0 / 35%)",
              opacity: allReady ? 1 : 0.75,
              animation: allReady ? "capi-glow 3s ease-in-out infinite" : undefined,
            }}
          >
            {/* Top satin highlight */}
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-70"
              style={{
                background:
                  "linear-gradient(180deg, oklch(1 0 0 / 14%) 0%, oklch(1 0 0 / 3%) 60%, transparent 100%)",
              }}
            />
            {/* Inner gold hairline */}
            {allReady && (
              <span
                className="pointer-events-none absolute inset-[3px] rounded-[0.85rem]"
                style={{
                  border: "1px solid oklch(0.82 0.14 82 / 22%)",
                }}
              />
            )}
            {allReady && (
              <span
                className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, oklch(1 0 0 / 20%), transparent)",
                  animation: "capi-sheen 3.4s ease-in-out infinite",
                }}
              />
            )}
            <Play
              className="relative h-4 w-4"
              style={{
                color: allReady ? "oklch(0.94 0.11 88)" : "oklch(0.55 0.03 80)",
                filter: allReady
                  ? "drop-shadow(0 1px 2px oklch(0 0 0 / 60%)) drop-shadow(0 0 6px oklch(0.82 0.14 82 / 45%))"
                  : "none",
              }}
              strokeWidth={2.2}
              fill="currentColor"
            />
            <span
              className="relative font-serif text-base font-semibold tracking-wide"
              style={{
                background: allReady
                  ? "linear-gradient(180deg, oklch(0.97 0.10 88), oklch(0.74 0.14 78))"
                  : "linear-gradient(180deg, oklch(0.62 0.03 80), oklch(0.48 0.03 80))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                textShadow: "0 1px 0 oklch(0 0 0 / 40%)",
              }}
            >
              {allReady ? "Commencer la partie" : "En attente des joueurs…"}
            </span>
          </button>
          {!allReady && (
            <p
              className="text-center text-[11px] uppercase tracking-[0.22em] animate-fade-in"
              style={{ color: "oklch(0.75 0.05 82 / 65%)" }}
            >
              {playersCount < total
                ? `${total - playersCount} place${total - playersCount > 1 ? "s" : ""} libre${total - playersCount > 1 ? "s" : ""}`
                : `${total - readyCount} joueur${total - readyCount > 1 ? "s" : ""} pas encore prêt${total - readyCount > 1 ? "s" : ""}`}
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
  className,
  isLocal,
  delay = 0,
  onToggleReady,
  onInvite,
}: {
  seat: Seat;
  className?: string;
  isLocal?: boolean;
  delay?: number;
  onToggleReady: (pos: Position) => void;
  onInvite: () => void;
}) {
  const p = seat.player;
  const pos = seat.position;

  const seatTransform =
    pos === "top"
      ? "translate(-50%, -50%)"
      : pos === "bottom"
        ? "translate(-50%, 50%)"
        : pos === "left"
          ? "translate(-50%, -50%)"
          : "translate(50%, -50%)";

  const teamRing =
    seat.team === "A"
      ? "oklch(0.72 0.16 55 / 85%)" /* warm gold-orange for team A */
      : "oklch(0.62 0.16 240 / 85%)"; /* cool blue for team B */

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

          {/* Ready toggle button per player (only local is directly actionable; others too for demo) */}
          <button
            type="button"
            onClick={() => onToggleReady(pos)}
            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition active:scale-95"
            style={{
              background: p.ready
                ? "oklch(0.2 0.02 40 / 70%)"
                : "linear-gradient(160deg, oklch(0.5 0.15 155), oklch(0.32 0.10 155))",
              border: `1px solid ${p.ready ? "oklch(0.82 0.14 82 / 25%)" : "oklch(0.62 0.15 155 / 60%)"}`,
              color: p.ready ? "oklch(0.85 0.05 82 / 85%)" : "oklch(0.95 0.1 88)",
              boxShadow: "0 2px 6px oklch(0 0 0 / 45%), inset 0 1px 0 oklch(1 0 0 / 10%)",
            }}
          >
            {p.ready ? "Annuler" : "Je suis prêt"}
          </button>
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
