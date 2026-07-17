import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Play, RefreshCw, Shield, Sparkles, Trophy, Users } from "lucide-react";
import { BistrotShell } from "@/components/BistrotShell";
import {
  defaultTableConfig,
  generateInviteCode,
  saveTableConfig,
  type TableConfig,
} from "@/lib/table-config";

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
  const [cfg, setCfg] = useState<TableConfig>(() => defaultTableConfig());

  const update = <K extends keyof TableConfig>(key: K, value: TableConfig[K]) =>
    setCfg((c) => ({ ...c, [key]: value }));

  const scoreOptions: TableConfig["maxScore"][] = useMemo(() => [1000, 1500, 2000], []);
  const spectatorOptions: TableConfig["maxSpectators"][] = useMemo(
    () => [0, 2, 4, 8],
    [],
  );

  function submit() {
    saveTableConfig(cfg);
    navigate({ to: "/salle-attente" });
  }

  return (
    <BistrotShell title="Créer une table" subtitle="Nouveau salon" backTo="/amis" variant="scroll">
      <section className="mt-6 flex flex-1 flex-col gap-4 pb-2">
        {/* Identity card */}
        <Card>
          <Label>Nom de la table</Label>
          <input
            value={cfg.name}
            onChange={(e) => update("name", e.target.value)}
            maxLength={32}
            className="mt-2 w-full bg-transparent font-serif text-lg outline-none"
            style={{
              color: "oklch(0.94 0.09 88)",
              borderBottom: "1px solid oklch(0.82 0.14 82 / 35%)",
              paddingBottom: "0.5rem",
            }}
          />

          <Divider />

          <Row
            title="Table privée"
            hint={cfg.isPrivate ? "Accessible uniquement via code" : "Visible dans le salon public"}
            icon={<Shield className="h-4 w-4" />}
          >
            <Toggle checked={cfg.isPrivate} onChange={(v) => update("isPrivate", v)} />
          </Row>

          <Divider />

          <Label>Code d'invitation</Label>
          <div className="mt-2 flex items-center gap-2">
            <div
              className="flex flex-1 items-center gap-1"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              {cfg.code.split("").map((c, i) => (
                <span
                  key={i}
                  className="flex h-10 w-8 items-center justify-center text-lg font-bold"
                  style={{
                    borderRadius: "0.5rem",
                    background: "linear-gradient(180deg, oklch(0.22 0.04 40), oklch(0.13 0.03 40))",
                    border: "1px solid oklch(0.82 0.14 82 / 40%)",
                    color: "oklch(0.94 0.11 88)",
                    textShadow: "0 1px 0 oklch(0 0 0 / 60%)",
                    boxShadow:
                      "0 3px 8px oklch(0 0 0 / 45%), inset 0 1px 0 oklch(1 0 0 / 10%)",
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => update("code", generateInviteCode())}
              className="flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95"
              style={{
                background: "oklch(0.2 0.03 40 / 75%)",
                border: "1px solid oklch(0.82 0.14 82 / 35%)",
                color: "oklch(0.9 0.1 85)",
              }}
              aria-label="Régénérer le code"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </Card>

        {/* Score card */}
        <Card>
          <Row
            title="Score maximum"
            hint="Fin de partie au premier atteint"
            icon={<Trophy className="h-4 w-4" />}
          />
          <SegmentedGroup
            className="mt-3"
            value={cfg.maxScore}
            options={scoreOptions.map((v) => ({ value: v, label: String(v) }))}
            onChange={(v) => update("maxScore", v)}
          />
        </Card>

        {/* Options card */}
        <Card>
          <Row
            title="Options de jeu"
            hint="Réglages classiques d'une table de Contrée"
            icon={<Sparkles className="h-4 w-4" />}
          />
          <div className="mt-2 flex flex-col">
            <SwitchRow
              label="Annonces"
              value={cfg.announcements}
              onChange={(v) => update("announcements", v)}
            />
            <SwitchRow
              label="Contrer"
              value={cfg.contrer}
              onChange={(v) => update("contrer", v)}
            />
            <SwitchRow
              label="Surcontrer"
              value={cfg.surcontrer}
              onChange={(v) => update("surcontrer", v)}
              disabled={!cfg.contrer}
            />
            <SwitchRow
              label="Mélange avant distribution"
              value={cfg.shuffle}
              onChange={(v) => update("shuffle", v)}
              last
            />
          </div>
        </Card>

        {/* Spectators card */}
        <Card>
          <Row
            title="Spectateurs maximum"
            hint="Nombre d'observateurs autorisés"
            icon={<Users className="h-4 w-4" />}
          />
          <SegmentedGroup
            className="mt-3"
            value={cfg.maxSpectators}
            options={spectatorOptions.map((v) => ({
              value: v,
              label: v === 0 ? "Aucun" : String(v),
            }))}
            onChange={(v) => update("maxSpectators", v)}
          />
        </Card>

        {/* Create button */}
        <div className="mt-3">
          <button
            type="button"
            onClick={submit}
            className="relative flex w-full items-center justify-center gap-2 overflow-hidden py-3.5 transition-all duration-200 active:scale-[0.98]"
            style={{
              borderRadius: "1rem",
              background:
                "linear-gradient(160deg, oklch(0.5 0.15 155) 0%, oklch(0.32 0.10 155) 100%)",
              border: "1px solid oklch(0.62 0.15 155 / 60%)",
              boxShadow:
                "0 10px 22px -12px oklch(0.42 0.13 155 / 55%), 0 0 20px -4px oklch(0.6 0.18 155 / 35%), 0 1px 0 0 oklch(1 0 0 / 15%) inset, 0 -8px 16px -8px oklch(0 0 0 / 40%) inset",
              animation: "capi-breathe 3.4s ease-in-out infinite",
            }}
          >
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-60"
              style={{
                background:
                  "linear-gradient(180deg, oklch(1 0 0 / 20%) 0%, oklch(1 0 0 / 4%) 60%, transparent 100%)",
              }}
            />
            <span
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg]"
              style={{
                background:
                  "linear-gradient(90deg, transparent, oklch(1 0 0 / 20%), transparent)",
                animation: "capi-sheen-btn 3.4s ease-in-out infinite",
              }}
            />
            <Play
              className="h-4 w-4"
              style={{ color: "oklch(0.94 0.11 88)" }}
              strokeWidth={2.2}
              fill="currentColor"
            />
            <span
              className="font-serif text-[16px] font-semibold tracking-wide"
              style={{
                background: "linear-gradient(180deg, oklch(0.96 0.1 88), oklch(0.76 0.14 78))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                textShadow: "0 1px 0 oklch(0 0 0 / 30%)",
              }}
            >
              Créer la table
            </span>
          </button>
        </div>
      </section>

      <style>{`
        @keyframes capi-breathe {
          0%, 100% { transform: scale(1); box-shadow:
            0 10px 22px -12px oklch(0.42 0.13 155 / 55%),
            0 0 20px -4px oklch(0.6 0.18 155 / 35%),
            0 1px 0 0 oklch(1 0 0 / 15%) inset,
            0 -8px 16px -8px oklch(0 0 0 / 40%) inset; }
          50% { transform: scale(1.012); box-shadow:
            0 12px 26px -12px oklch(0.42 0.13 155 / 65%),
            0 0 28px -4px oklch(0.65 0.2 155 / 50%),
            0 1px 0 0 oklch(1 0 0 / 18%) inset,
            0 -8px 16px -8px oklch(0 0 0 / 40%) inset; }
        }
        @keyframes capi-sheen-btn {
          0% { left: -35%; }
          65%, 100% { left: 120%; }
        }
      `}</style>
    </BistrotShell>
  );
}

/* ---------- UI primitives (local, match existing identity) ---------- */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: "oklch(0.18 0.03 40 / 60%)",
        borderColor: "oklch(0.82 0.14 82 / 22%)",
        backdropFilter: "blur(10px)",
        boxShadow:
          "0 14px 32px -22px oklch(0 0 0 / 75%), inset 0 1px 0 oklch(1 0 0 / 5%)",
      }}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[11px] uppercase tracking-[0.25em]"
      style={{ color: "oklch(0.8 0.08 82 / 75%)" }}
    >
      {children}
    </span>
  );
}

function Divider() {
  return (
    <div
      className="my-4 h-px w-full"
      style={{ background: "oklch(0.82 0.14 82 / 12%)" }}
    />
  );
}

function Row({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon ? (
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{
            background: "oklch(0.14 0.02 40 / 75%)",
            border: "1px solid oklch(0.82 0.14 82 / 28%)",
            color: "oklch(0.9 0.1 85)",
          }}
        >
          {icon}
        </span>
      ) : null}
      <div className="flex flex-1 flex-col">
        <span
          className="font-serif text-[15px] font-semibold"
          style={{ color: "oklch(0.94 0.06 85)" }}
        >
          {title}
        </span>
        {hint ? (
          <span className="text-[12px]" style={{ color: "oklch(0.8 0.05 82 / 70%)" }}>
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative h-7 w-12 rounded-full transition disabled:opacity-40"
      style={{
        background: checked
          ? "linear-gradient(160deg, oklch(0.5 0.15 155), oklch(0.32 0.10 155))"
          : "oklch(0.25 0.02 40 / 80%)",
        border: `1px solid ${checked ? "oklch(0.62 0.15 155 / 60%)" : "oklch(0.82 0.14 82 / 25%)"}`,
        boxShadow: checked
          ? "0 0 12px -4px oklch(0.6 0.18 155 / 50%), inset 0 1px 0 oklch(1 0 0 / 12%)"
          : "inset 0 1px 2px oklch(0 0 0 / 50%)",
      }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full transition-all duration-200"
        style={{
          left: checked ? "1.5rem" : "0.15rem",
          background: "linear-gradient(180deg, oklch(0.95 0.1 88), oklch(0.72 0.14 78))",
          boxShadow: "0 2px 4px oklch(0 0 0 / 55%), inset 0 1px 0 oklch(1 0 0 / 30%)",
        }}
      />
    </button>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
  disabled,
  last,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-2.5"
      style={{
        borderBottom: last ? "none" : "1px solid oklch(0.82 0.14 82 / 10%)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        className="text-[14px]"
        style={{ color: "oklch(0.92 0.05 85)", fontFamily: "ui-serif, Georgia, serif" }}
      >
        {label}
      </span>
      <Toggle checked={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function SegmentedGroup<T extends string | number>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-1 rounded-full p-1 ${className ?? ""}`}
      style={{
        background: "oklch(0.12 0.02 40 / 80%)",
        border: "1px solid oklch(0.82 0.14 82 / 18%)",
        boxShadow: "inset 0 1px 2px oklch(0 0 0 / 45%)",
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className="flex-1 rounded-full py-2 text-[12.5px] font-semibold tracking-wide transition active:scale-95"
            style={{
              background: active
                ? "linear-gradient(160deg, oklch(0.38 0.09 55), oklch(0.26 0.07 45))"
                : "transparent",
              color: active ? "oklch(0.95 0.11 85)" : "oklch(0.78 0.05 82 / 78%)",
              border: active
                ? "1px solid oklch(0.82 0.14 82 / 40%)"
                : "1px solid transparent",
              boxShadow: active
                ? "0 4px 10px -6px oklch(0 0 0 / 55%), inset 0 1px 0 oklch(1 0 0 / 12%)"
                : "none",
              fontFamily: "ui-serif, Georgia, serif",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
