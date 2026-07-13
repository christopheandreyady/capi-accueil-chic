import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Play } from "lucide-react";
import { BistrotShell } from "@/components/BistrotShell";

export const Route = createFileRoute("/creer-table")({
  head: () => ({
    meta: [
      { title: "Créer une table — CAPI" },
      {
        name: "description",
        content: "Créez votre table de Contrée et invitez vos amis à vous rejoindre.",
      },
      { property: "og:title", content: "Créer une table — CAPI" },
    ],
  }),
  component: CreateTable,
});

function CreateTable() {
  const navigate = useNavigate();
  const [name, setName] = useState("Table du Bistrot");
  const [privateTable, setPrivateTable] = useState(true);

  return (
    <BistrotShell title="Créer une table" subtitle="Nouveau salon" backTo="/amis">
      <section className="mt-8 flex flex-1 flex-col gap-5">
        <div
          className="rounded-2xl border p-5"
          style={{
            background: "oklch(0.18 0.03 40 / 55%)",
            borderColor: "oklch(0.82 0.14 82 / 25%)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 12px 30px -18px oklch(0 0 0 / 70%)",
          }}
        >
          <label
            className="text-[11px] uppercase tracking-[0.25em]"
            style={{ color: "oklch(0.8 0.08 82 / 75%)" }}
          >
            Nom de la table
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full bg-transparent font-serif text-lg outline-none"
            style={{
              color: "oklch(0.94 0.09 88)",
              borderBottom: "1px solid oklch(0.82 0.14 82 / 35%)",
              paddingBottom: "0.5rem",
            }}
          />

          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm" style={{ color: "oklch(0.88 0.06 82 / 85%)" }}>
              Table privée
            </span>
            <button
              type="button"
              onClick={() => setPrivateTable((v) => !v)}
              className="relative h-7 w-12 rounded-full transition"
              style={{
                background: privateTable
                  ? "linear-gradient(160deg, oklch(0.62 0.17 55), oklch(0.44 0.14 45))"
                  : "oklch(0.25 0.02 40 / 80%)",
                border: "1px solid oklch(0.82 0.14 82 / 30%)",
              }}
              aria-pressed={privateTable}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
                style={{
                  left: privateTable ? "1.5rem" : "0.15rem",
                  background:
                    "linear-gradient(180deg, oklch(0.95 0.1 88), oklch(0.72 0.14 78))",
                  boxShadow: "0 2px 4px oklch(0 0 0 / 50%)",
                }}
              />
            </button>
          </div>
        </div>

        <div className="mt-auto">
          <button
            type="button"
            onClick={() => navigate({ to: "/salle-attente" })}
            className="relative flex w-full items-center justify-center gap-2 overflow-hidden py-4 transition-all duration-200 active:scale-[0.98]"
            style={{
              borderRadius: "1.1rem",
              background: "linear-gradient(160deg, oklch(0.44 0.13 155) 0%, oklch(0.30 0.09 155) 100%)",
              border: "1px solid oklch(0.55 0.14 155 / 60%)",
              boxShadow:
                "0 10px 22px -12px oklch(0.42 0.13 155 / 50%), 0 1px 0 0 oklch(1 0 0 / 15%) inset, 0 -8px 16px -8px oklch(0 0 0 / 40%) inset",
            }}
          >
            <Play className="h-5 w-5" style={{ color: "oklch(0.92 0.12 88)" }} />
            <span
              className="font-serif text-[16px] font-semibold tracking-wide"
              style={{
                background: "linear-gradient(180deg, oklch(0.95 0.1 88), oklch(0.75 0.14 78))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Créer la table
            </span>
          </button>
        </div>
      </section>
    </BistrotShell>
  );
}
