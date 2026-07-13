import { createFileRoute } from "@tanstack/react-router";
import { Bot, Users, Globe2 } from "lucide-react";
import { BistrotShell, PremiumCard } from "@/components/BistrotShell";

export const Route = createFileRoute("/jouer")({
  head: () => ({
    meta: [
      { title: "Choisir un mode — CAPI" },
      {
        name: "description",
        content: "Choisissez votre mode de jeu : solo contre l'IA, entre amis ou en ligne.",
      },
      { property: "og:title", content: "Choisir un mode — CAPI" },
      {
        property: "og:description",
        content: "Solo, entre amis ou en ligne : lancez votre partie de Contrée sur CAPI.",
      },
    ],
  }),
  component: GameModeSelection,
});

function GameModeSelection() {
  return (
    <BistrotShell title="Mode de jeu" subtitle="Comment souhaitez-vous jouer ?" backTo="/">
      <section className="mt-10 flex flex-col gap-3.5" aria-label="Modes de jeu">
        <PremiumCard
          to="/solo"
          title="Solo vs IA"
          subtitle="Entraînez-vous contre l'intelligence artificielle"
          icon={<Bot className="h-6 w-6" strokeWidth={2} />}
          gradient="linear-gradient(160deg, oklch(0.44 0.13 155) 0%, oklch(0.30 0.09 155) 100%)"
          edge="oklch(0.55 0.14 155 / 60%)"
          glow="oklch(0.42 0.13 155 / 40%)"
        />
        <PremiumCard
          to="/amis"
          title="Jouer entre amis"
          subtitle="Créez ou rejoignez une table privée"
          icon={<Users className="h-6 w-6" strokeWidth={2} />}
          gradient="linear-gradient(160deg, oklch(0.62 0.17 55) 0%, oklch(0.44 0.14 45) 100%)"
          edge="oklch(0.72 0.17 60 / 55%)"
          glow="oklch(0.60 0.17 55 / 40%)"
        />
        <PremiumCard
          to="/en-ligne"
          title="Multijoueur en ligne"
          subtitle="Défiez des joueurs du monde entier"
          icon={<Globe2 className="h-6 w-6" strokeWidth={2} />}
          gradient="linear-gradient(160deg, oklch(0.48 0.12 240) 0%, oklch(0.32 0.09 245) 100%)"
          edge="oklch(0.60 0.13 240 / 55%)"
          glow="oklch(0.46 0.12 240 / 40%)"
        />
      </section>
    </BistrotShell>
  );
}
