import { createFileRoute, Link } from "@tanstack/react-router";
import { Spade, Trophy, Users, User } from "lucide-react";

type RoutePath = "/salle-attente" | undefined;
import bistrotTable from "@/assets/capi-bistrot-table.jpg";
import capiEmblem from "@/assets/capi-emblem.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CAPI — La Contrée entre amis" },
      {
        name: "description",
        content:
          "CAPI, l'application premium pour jouer à la Contrée entre amis. Parties, tournois et classements dans une ambiance bistrot français.",
      },
      { property: "og:title", content: "CAPI — La Contrée entre amis" },
      {
        property: "og:description",
        content: "L'app premium de Contrée : jouez, organisez des tournois, retrouvez vos amis.",
      },
    ],
  }),
  component: Home,
});

type Btn = {
  label: string;
  icon: typeof Spade;
  base: string;
  edge: string;
  glow: string;
  to?: RoutePath;
};

const buttons: Btn[] = [
  {
    label: "Jouer",
    icon: Spade,
    base: "linear-gradient(160deg, oklch(0.44 0.13 155) 0%, oklch(0.30 0.09 155) 100%)",
    edge: "oklch(0.55 0.14 155 / 60%)",
    glow: "oklch(0.42 0.13 155 / 40%)",
    to: "/salle-attente",
  },
  {
    label: "Tournois",
    icon: Trophy,
    base: "linear-gradient(160deg, oklch(0.62 0.17 55) 0%, oklch(0.44 0.14 45) 100%)",
    edge: "oklch(0.72 0.17 60 / 55%)",
    glow: "oklch(0.60 0.17 55 / 40%)",
  },
  {
    label: "Amis",
    icon: Users,
    base: "linear-gradient(160deg, oklch(0.48 0.12 240) 0%, oklch(0.32 0.09 245) 100%)",
    edge: "oklch(0.60 0.13 240 / 55%)",
    glow: "oklch(0.46 0.12 240 / 40%)",
  },
  {
    label: "Profil",
    icon: User,
    base: "linear-gradient(160deg, oklch(0.46 0.14 310) 0%, oklch(0.30 0.10 305) 100%)",
    edge: "oklch(0.58 0.14 310 / 55%)",
    glow: "oklch(0.44 0.14 310 / 40%)",
  },
];

function Home() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Background photo */}
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
            "radial-gradient(120% 80% at 50% 45%, transparent 0%, oklch(0 0 0 / 35%) 60%, oklch(0.08 0.02 40 / 90%) 100%)",
        }}
      />
      {/* Top/bottom darkening for legibility */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.12 0.03 40 / 55%) 0%, transparent 22%, transparent 55%, oklch(0.08 0.02 40 / 88%) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pt-14 pb-10">
        {/* Emblem + Slogan */}
        <header className="flex flex-col items-center text-center">
          <div className="relative">
            {/* Warm glow behind emblem */}
            <div
              className="absolute inset-0 -z-10 rounded-full blur-3xl"
              style={{ background: "oklch(0.82 0.15 82 / 45%)", transform: "scale(1.15)" }}
            />
            <img
              src={capiEmblem}
              alt="CAPI"
              width={1024}
              height={1024}
              className="h-32 w-32 select-none"
              style={{
                filter:
                  "drop-shadow(0 12px 20px oklch(0 0 0 / 65%)) drop-shadow(0 2px 4px oklch(0 0 0 / 40%))",
              }}
              draggable={false}
            />
          </div>

          <div className="mt-5 flex items-center gap-3">
            <span
              className="h-px w-10"
              style={{ background: "linear-gradient(90deg, transparent, oklch(0.82 0.14 82 / 80%))" }}
            />
            <p
              className="font-serif text-lg italic tracking-wide"
              style={{
                color: "oklch(0.94 0.09 88)",
                textShadow: "0 1px 2px oklch(0 0 0 / 70%), 0 0 20px oklch(0.82 0.14 82 / 25%)",
              }}
            >
              La Contrée entre amis
            </p>
            <span
              className="h-px w-10"
              style={{ background: "linear-gradient(90deg, oklch(0.82 0.14 82 / 80%), transparent)" }}
            />
          </div>
        </header>

        {/* Buttons */}
        <nav className="mt-auto grid grid-cols-2 gap-3.5 pt-12" aria-label="Menu principal">
          {buttons.map(({ label, icon: Icon, base, edge, glow, to }) => {
            const Comp: React.ElementType = to ? Link : "button";
            const compProps = to ? { to } : { type: "button" as const };
            return (
            <Comp
              key={label}
              {...compProps}
              className="group relative flex flex-col items-center justify-center gap-2.5 overflow-hidden px-3 py-5 transition-all duration-200 ease-out active:scale-[0.97] active:brightness-95"
              style={{
                borderRadius: "1.1rem",
                background: base,
                border: `1px solid ${edge}`,
                boxShadow: `
                  0 8px 18px -10px ${glow},
                  0 1px 0 0 oklch(1 0 0 / 15%) inset,
                  0 -8px 16px -8px oklch(0 0 0 / 40%) inset
                `,
              }}
            >
              {/* Glass sheen */}
              <span
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-60"
                style={{
                  background:
                    "linear-gradient(180deg, oklch(1 0 0 / 22%) 0%, oklch(1 0 0 / 4%) 60%, transparent 100%)",
                }}
              />
              {/* Subtle leather grain */}
              <span
                className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay"
                style={{
                  backgroundImage:
                    "radial-gradient(oklch(1 0 0) 1px, transparent 1px), radial-gradient(oklch(0 0 0) 1px, transparent 1px)",
                  backgroundSize: "3px 3px, 4px 4px",
                  backgroundPosition: "0 0, 1px 2px",
                }}
              />
              {/* Bottom highlight */}
              <span
                className="pointer-events-none absolute inset-x-4 bottom-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, oklch(1 0 0 / 25%), transparent)",
                }}
              />

              <Icon
                className="h-6 w-6 transition-transform duration-200 group-active:scale-95"
                style={{
                  color: "oklch(0.92 0.12 88)",
                  filter:
                    "drop-shadow(0 1px 0 oklch(0 0 0 / 50%)) drop-shadow(0 0 6px oklch(0.82 0.14 82 / 35%))",
                }}
                strokeWidth={2}
              />
              <span
                className="font-serif text-[15px] font-semibold tracking-wide"
                style={{
                  background:
                    "linear-gradient(180deg, oklch(0.95 0.1 88), oklch(0.75 0.14 78))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  textShadow: "0 1px 0 oklch(0 0 0 / 30%)",
                }}
              >
                {label}
              </span>
            </Comp>
          );
          })}
        </nav>

        <p
          className="mt-6 text-center text-[11px] uppercase tracking-[0.3em]"
          style={{ color: "oklch(0.75 0.08 82 / 70%)" }}
        >
          · Belote · Coinche · Contrée ·
        </p>
      </div>
    </main>
  );
}
