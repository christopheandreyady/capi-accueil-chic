import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { BistrotShell } from "@/components/BistrotShell";

export const Route = createFileRoute("/solo")({
  head: () => ({
    meta: [
      { title: "Solo vs IA — CAPI" },
      {
        name: "description",
        content: "Mode solo contre l'intelligence artificielle — bientôt disponible.",
      },
      { property: "og:title", content: "Solo vs IA — CAPI" },
    ],
  }),
  component: SoloPlaceholder,
});

function SoloPlaceholder() {
  return (
    <BistrotShell title="Solo vs IA" subtitle="Bientôt disponible" backTo="/jouer">
      <section className="mt-16 flex flex-1 flex-col items-center justify-center text-center">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full"
          style={{
            background: "linear-gradient(160deg, oklch(0.44 0.13 155), oklch(0.30 0.09 155))",
            border: "1px solid oklch(0.82 0.14 82 / 35%)",
            boxShadow:
              "0 12px 30px -12px oklch(0 0 0 / 60%), 0 1px 0 0 oklch(1 0 0 / 15%) inset",
          }}
        >
          <Bot className="h-12 w-12" style={{ color: "oklch(0.92 0.12 88)" }} />
        </div>
        <h2
          className="mt-6 font-serif text-2xl font-semibold"
          style={{
            background: "linear-gradient(180deg, oklch(0.95 0.1 88), oklch(0.72 0.14 78))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Bientôt disponible
        </h2>
        <p
          className="mt-3 max-w-xs text-sm leading-relaxed"
          style={{ color: "oklch(0.88 0.06 82 / 80%)" }}
        >
          Le mode solo contre l'IA arrive prochainement. Vous pourrez vous entraîner
          contre trois adversaires virtuels à votre niveau.
        </p>
      </section>
    </BistrotShell>
  );
}
