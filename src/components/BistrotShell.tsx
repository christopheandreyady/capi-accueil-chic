import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import bistrotTable from "@/assets/capi-bistrot-table.jpg";
import capiEmblem from "@/assets/capi-emblem.png";

type BistrotShellProps = {
  title: string;
  subtitle?: string;
  backTo: string;
  children: ReactNode;
};

export function BistrotShell({ title, subtitle, backTo, children }: BistrotShellProps) {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background">
      <img
        src={bistrotTable}
        alt=""
        width={1024}
        height={1536}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
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

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pt-6 pb-8">
        <header className="flex items-center justify-between">
          <Link
            to={backTo}
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
              {title}
            </h1>
            {subtitle ? (
              <span
                className="mt-0.5 text-[11px] uppercase tracking-[0.25em]"
                style={{ color: "oklch(0.8 0.08 82 / 75%)" }}
              >
                {subtitle}
              </span>
            ) : null}
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

        {children}
      </div>
    </main>
  );
}

type PremiumCardProps = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  to?: string;
  onClick?: () => void;
  gradient: string;
  edge: string;
  glow: string;
};

export function PremiumCard({ title, subtitle, icon, to, onClick, gradient, edge, glow }: PremiumCardProps) {
  const Comp: React.ElementType = to ? Link : "button";
  const compProps = to ? { to } : { type: "button" as const, onClick };

  return (
    <Comp
      {...compProps}
      className="group relative flex w-full items-center gap-4 overflow-hidden px-5 py-4 text-left transition-all duration-200 ease-out active:scale-[0.98] active:brightness-95"
      style={{
        borderRadius: "1.1rem",
        background: gradient,
        border: `1px solid ${edge}`,
        boxShadow: `
          0 10px 22px -12px ${glow},
          0 1px 0 0 oklch(1 0 0 / 15%) inset,
          0 -8px 16px -8px oklch(0 0 0 / 40%) inset
        `,
      }}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-60"
        style={{
          background: "linear-gradient(180deg, oklch(1 0 0 / 20%) 0%, oklch(1 0 0 / 4%) 60%, transparent 100%)",
        }}
      />
      <span
        className="pointer-events-none absolute inset-0 opacity-[0.1] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(oklch(1 0 0) 1px, transparent 1px), radial-gradient(oklch(0 0 0) 1px, transparent 1px)",
          backgroundSize: "3px 3px, 4px 4px",
          backgroundPosition: "0 0, 1px 2px",
        }}
      />

      <span
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
        style={{
          background: "oklch(0.15 0.02 40 / 55%)",
          border: "1px solid oklch(0.82 0.14 82 / 35%)",
          color: "oklch(0.92 0.12 88)",
          boxShadow: "0 4px 10px oklch(0 0 0 / 40%) inset",
        }}
      >
        {icon}
      </span>

      <span className="relative flex flex-col">
        <span
          className="font-serif text-[17px] font-semibold tracking-wide"
          style={{
            background: "linear-gradient(180deg, oklch(0.95 0.1 88), oklch(0.75 0.14 78))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 1px 0 oklch(0 0 0 / 30%)",
          }}
        >
          {title}
        </span>
        <span className="mt-0.5 text-[12.5px]" style={{ color: "oklch(0.88 0.06 82 / 85%)" }}>
          {subtitle}
        </span>
      </span>
    </Comp>
  );
}
