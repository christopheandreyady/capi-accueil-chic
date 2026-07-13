import { createFileRoute } from "@tanstack/react-router";
import { Spade, Trophy, Users, User } from "lucide-react";
import bistrotTable from "@/assets/capi-bistrot-table.jpg";

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
  gradient: string;
  glow: string;
};

const buttons: Btn[] = [
  { label: "Jouer", icon: Spade, gradient: "var(--btn-green)", glow: "oklch(0.42 0.13 155 / 50%)" },
  { label: "Tournois", icon: Trophy, gradient: "var(--btn-orange)", glow: "oklch(0.62 0.17 55 / 50%)" },
  { label: "Amis", icon: Users, gradient: "var(--btn-blue)", glow: "oklch(0.48 0.12 240 / 50%)" },
  { label: "Profil", icon: User, gradient: "var(--btn-purple)", glow: "oklch(0.45 0.14 310 / 50%)" },
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
      {/* Vignette + warmth overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 40%, oklch(0 0 0 / 0%) 0%, oklch(0 0 0 / 45%) 55%, oklch(0.1 0.03 40 / 88%) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.15 0.03 40 / 55%) 0%, transparent 25%, transparent 55%, oklch(0.1 0.03 40 / 85%) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pt-16 pb-10">
        {/* Logo + Slogan */}
        <header className="flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div
              className="absolute inset-0 -z-10 rounded-full blur-2xl"
              style={{ background: "oklch(0.82 0.14 85 / 35%)" }}
            />
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full border"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, oklch(0.95 0.08 88), oklch(0.68 0.14 78) 60%, oklch(0.4 0.08 70))",
                borderColor: "oklch(0.9 0.1 85 / 60%)",
                boxShadow:
                  "0 10px 30px -10px oklch(0 0 0 / 70%), 0 0 0 1px oklch(0.4 0.08 70 / 40%) inset",
              }}
            >
              <Spade className="h-11 w-11" style={{ color: "oklch(0.2 0.04 40)" }} strokeWidth={2.4} />
            </div>
          </div>

          <h1
            className="text-gold-gradient font-serif text-6xl font-bold tracking-tight"
            style={{ letterSpacing: "0.02em" }}
          >
            CAPI
          </h1>

          <div className="mt-3 flex items-center gap-3">
            <span
              className="h-px w-8"
              style={{ background: "linear-gradient(90deg, transparent, oklch(0.78 0.14 82))" }}
            />
            <p
              className="font-serif text-sm italic tracking-wide"
              style={{ color: "oklch(0.88 0.08 85)" }}
            >
              La Contrée entre amis
            </p>
            <span
              className="h-px w-8"
              style={{ background: "linear-gradient(90deg, oklch(0.78 0.14 82), transparent)" }}
            />
          </div>
        </header>

        {/* Buttons */}
        <nav className="mt-auto grid grid-cols-2 gap-4 pt-14" aria-label="Menu principal">
          {buttons.map(({ label, icon: Icon, gradient, glow }) => (
            <button
              key={label}
              type="button"
              className="btn-premium btn-premium-hover group relative flex aspect-square flex-col items-center justify-center gap-3 p-4"
              style={{
                background: gradient,
                boxShadow: `var(--shadow-premium), 0 12px 30px -12px ${glow}`,
              }}
            >
              {/* Top gloss */}
              <span
                className="pointer-events-none absolute inset-x-3 top-2 h-1/3 rounded-2xl opacity-40"
                style={{
                  background:
                    "linear-gradient(180deg, oklch(1 0 0 / 35%), oklch(1 0 0 / 0%))",
                }}
              />
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 30% 25%, oklch(0.95 0.08 88 / 95%), oklch(0.68 0.14 78 / 90%) 70%, oklch(0.4 0.08 70 / 80%))",
                  boxShadow:
                    "0 4px 10px -2px oklch(0 0 0 / 50%), 0 0 0 1px oklch(0.4 0.08 70 / 60%) inset",
                }}
              >
                <Icon
                  className="h-6 w-6"
                  style={{ color: "oklch(0.2 0.04 40)" }}
                  strokeWidth={2.2}
                />
              </span>
              <span
                className="text-gold-gradient font-serif text-lg font-semibold tracking-wide"
              >
                {label}
              </span>
            </button>
          ))}
        </nav>

        <p
          className="mt-8 text-center text-[11px] uppercase tracking-[0.3em]"
          style={{ color: "oklch(0.7 0.06 80 / 70%)" }}
        >
          · Belote · Coinche · Contrée ·
        </p>
      </div>
    </main>
  );
}
