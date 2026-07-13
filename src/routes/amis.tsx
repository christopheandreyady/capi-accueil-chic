import { createFileRoute } from "@tanstack/react-router";
import { PlusCircle, LogIn } from "lucide-react";
import { BistrotShell, PremiumCard } from "@/components/BistrotShell";

export const Route = createFileRoute("/amis")({
  head: () => ({
    meta: [
      { title: "Jouer entre amis — CAPI" },
      {
        name: "description",
        content: "Créez une nouvelle table ou rejoignez celle d'un ami pour jouer à la Contrée.",
      },
      { property: "og:title", content: "Jouer entre amis — CAPI" },
      {
        property: "og:description",
        content: "Créez ou rejoignez une table privée sur CAPI.",
      },
    ],
  }),
  component: FriendsChoice,
});

function FriendsChoice() {
  return (
    <BistrotShell title="Entre amis" subtitle="Créer ou rejoindre" backTo="/jouer">
      <section className="mt-10 flex flex-col gap-3.5" aria-label="Options de table">
        <PremiumCard
          to="/creer-table"
          title="Créer une table"
          subtitle="Ouvrez votre propre salon et invitez vos amis"
          icon={<PlusCircle className="h-6 w-6" strokeWidth={2} />}
          gradient="linear-gradient(160deg, oklch(0.44 0.13 155) 0%, oklch(0.30 0.09 155) 100%)"
          edge="oklch(0.55 0.14 155 / 60%)"
          glow="oklch(0.42 0.13 155 / 40%)"
        />
        <PremiumCard
          to="/rejoindre-table"
          title="Rejoindre une table"
          subtitle="Entrez le code partagé par votre ami"
          icon={<LogIn className="h-6 w-6" strokeWidth={2} />}
          gradient="linear-gradient(160deg, oklch(0.46 0.14 310) 0%, oklch(0.30 0.10 305) 100%)"
          edge="oklch(0.58 0.14 310 / 55%)"
          glow="oklch(0.44 0.14 310 / 40%)"
        />
      </section>
    </BistrotShell>
  );
}
