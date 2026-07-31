import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { BistrotShell } from "@/components/BistrotShell";
import { getPlayerName, joinRoom, setPlayerName } from "@/lib/multiplayer";

type JoinSearch = { code?: string };

export const Route = createFileRoute("/rejoindre-table")({
  validateSearch: (search: Record<string, unknown>): JoinSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Rejoindre une table — CAPI" },
      {
        name: "description",
        content: "Entrez le code d'invitation pour rejoindre la table de vos amis.",
      },
      { property: "og:title", content: "Rejoindre une table — CAPI" },
      {
        property: "og:description",
        content: "Un pseudo, un code, et vous êtes assis à la table de Contrée.",
      },
    ],
  }),
  component: JoinTable,
});

function JoinTable() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/rejoindre-table" });
  const [code, setCode] = useState((search.code ?? "").toUpperCase());
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(getPlayerName());
  }, []);

  const canJoin = code.trim().length >= 4 && name.trim().length >= 2 && !busy;

  async function handleJoin() {
    if (!canJoin) return;
    setBusy(true);
    setError(null);
    try {
      setPlayerName(name);
      await joinRoom(code, name.trim());
      navigate({ to: "/salle-attente" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de rejoindre cette table.");
      setBusy(false);
    }
  }

  return (
    <BistrotShell title="Rejoindre" subtitle="Code d'invitation" backTo="/amis">
      <section className="mt-8 flex flex-1 flex-col gap-4">
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
            Votre pseudo
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 18))}
            placeholder="Ex. Marcel"
            className="mt-2 w-full bg-transparent text-center font-serif text-xl outline-none"
            style={{
              color: "oklch(0.94 0.09 88)",
              borderBottom: "1px solid oklch(0.82 0.14 82 / 35%)",
              paddingBottom: "0.5rem",
            }}
          />
        </div>

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
            Code de la table
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
            placeholder="AB7K9X"
            maxLength={12}
            className="mt-2 w-full bg-transparent text-center font-serif text-2xl tracking-[0.35em] outline-none"
            style={{
              color: "oklch(0.94 0.09 88)",
              borderBottom: "1px solid oklch(0.82 0.14 82 / 35%)",
              paddingBottom: "0.5rem",
            }}
          />
        </div>

        {error && (
          <p className="text-center text-sm" style={{ color: "oklch(0.72 0.18 25)" }}>
            {error}
          </p>
        )}

        <div className="mt-auto">
          <button
            type="button"
            disabled={!canJoin}
            onClick={handleJoin}
            className="relative flex w-full items-center justify-center gap-2 overflow-hidden py-4 transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
            style={{
              borderRadius: "1.1rem",
              background: canJoin
                ? "linear-gradient(160deg, oklch(0.46 0.14 310) 0%, oklch(0.30 0.10 305) 100%)"
                : "linear-gradient(160deg, oklch(0.28 0.02 40) 0%, oklch(0.18 0.02 40) 100%)",
              border: `1px solid ${canJoin ? "oklch(0.58 0.14 310 / 55%)" : "oklch(0.5 0.02 40 / 40%)"}`,
              boxShadow:
                "0 10px 22px -12px oklch(0 0 0 / 60%), 0 1px 0 0 oklch(1 0 0 / 12%) inset, 0 -8px 16px -8px oklch(0 0 0 / 40%) inset",
            }}
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "oklch(0.92 0.12 88)" }} />
            ) : (
              <LogIn className="h-5 w-5" style={{ color: "oklch(0.92 0.12 88)" }} />
            )}
            <span
              className="font-serif text-[16px] font-semibold tracking-wide"
              style={{
                background: "linear-gradient(180deg, oklch(0.95 0.1 88), oklch(0.75 0.14 78))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {busy ? "Connexion…" : "Rejoindre la table"}
            </span>
          </button>
        </div>
      </section>
    </BistrotShell>
  );
}
