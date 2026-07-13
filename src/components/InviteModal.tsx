import { useMemo, useState } from "react";
import { PremiumModal } from "./PremiumModal";
import { Users, Users2, Hash, Link2, Copy, Check, Share2 } from "lucide-react";
import { buildInviteLink } from "@/lib/table-config";

type Tab = "friend" | "group" | "code" | "link";

const FRIENDS = [
  { id: "1", name: "Antoine", photo: "https://i.pravatar.cc/120?img=15" },
  { id: "2", name: "Claire", photo: "https://i.pravatar.cc/120?img=45" },
  { id: "3", name: "Théo", photo: "https://i.pravatar.cc/120?img=33" },
  { id: "4", name: "Sophie", photo: "https://i.pravatar.cc/120?img=48" },
  { id: "5", name: "Marc", photo: "https://i.pravatar.cc/120?img=52" },
];

const GROUPS = [
  { id: "g1", name: "Les copains du dimanche", count: 6 },
  { id: "g2", name: "Bureau", count: 12 },
  { id: "g3", name: "Vacances Bretagne", count: 4 },
];

type Props = {
  open: boolean;
  onClose: () => void;
  code: string;
};

export function InviteModal({ open, onClose, code }: Props) {
  const [tab, setTab] = useState<Tab>("friend");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [invited, setInvited] = useState<Record<string, boolean>>({});
  const link = useMemo(() => buildInviteLink(code), [code]);

  async function copy(text: string, which: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* noop */
    }
  }

  async function share() {
    const shareData = {
      title: "Rejoignez ma table CAPI",
      text: `Rejoignez ma table de Contrée avec le code ${code}`,
      url: link,
    };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* fallthrough */
      }
    }
    copy(link, "link");
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "friend", label: "Amis", icon: <Users className="h-3.5 w-3.5" /> },
    { id: "group", label: "Groupes", icon: <Users2 className="h-3.5 w-3.5" /> },
    { id: "code", label: "Code", icon: <Hash className="h-3.5 w-3.5" /> },
    { id: "link", label: "Lien", icon: <Link2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <PremiumModal open={open} onClose={onClose} title="Inviter des joueurs" subtitle="Autour de votre table">
      {/* Tabs */}
      <div
        className="mb-5 flex gap-1 rounded-full p-1"
        style={{
          background: "oklch(0.12 0.02 40 / 80%)",
          border: "1px solid oklch(0.82 0.14 82 / 18%)",
        }}
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition active:scale-95"
              style={{
                background: active
                  ? "linear-gradient(160deg, oklch(0.38 0.09 55), oklch(0.26 0.07 45))"
                  : "transparent",
                color: active ? "oklch(0.94 0.11 85)" : "oklch(0.78 0.05 82 / 75%)",
                boxShadow: active
                  ? "0 4px 10px -6px oklch(0 0 0 / 60%), inset 0 1px 0 oklch(1 0 0 / 12%)"
                  : "none",
                border: active ? "1px solid oklch(0.82 0.14 82 / 35%)" : "1px solid transparent",
              }}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "friend" && (
        <ul className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
          {FRIENDS.map((f) => {
            const done = invited[f.id];
            return (
              <li key={f.id}>
                <div
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                  style={{
                    background: "oklch(0.16 0.03 40 / 75%)",
                    border: "1px solid oklch(0.82 0.14 82 / 15%)",
                  }}
                >
                  <img
                    src={f.photo}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                    style={{ border: "1px solid oklch(0.82 0.14 82 / 45%)" }}
                    loading="lazy"
                  />
                  <span
                    className="flex-1 font-serif text-sm"
                    style={{ color: "oklch(0.94 0.06 85)" }}
                  >
                    {f.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setInvited((s) => ({ ...s, [f.id]: true }))}
                    disabled={done}
                    className="rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition active:scale-95 disabled:opacity-70"
                    style={{
                      background: done
                        ? "linear-gradient(160deg, oklch(0.44 0.13 155), oklch(0.3 0.09 155))"
                        : "linear-gradient(160deg, oklch(0.38 0.09 55), oklch(0.26 0.07 45))",
                      color: "oklch(0.95 0.1 85)",
                      border: "1px solid oklch(0.82 0.14 82 / 40%)",
                      boxShadow: "inset 0 1px 0 oklch(1 0 0 / 12%)",
                    }}
                  >
                    {done ? "Invité" : "Inviter"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {tab === "group" && (
        <ul className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
          {GROUPS.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => setInvited((s) => ({ ...s, [g.id]: true }))}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition active:scale-[0.98]"
                style={{
                  background: "oklch(0.16 0.03 40 / 75%)",
                  border: "1px solid oklch(0.82 0.14 82 / 15%)",
                }}
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{
                    background:
                      "linear-gradient(160deg, oklch(0.38 0.09 55), oklch(0.24 0.06 45))",
                    color: "oklch(0.94 0.11 85)",
                    border: "1px solid oklch(0.82 0.14 82 / 35%)",
                  }}
                >
                  <Users2 className="h-4 w-4" />
                </span>
                <span className="flex flex-1 flex-col">
                  <span
                    className="font-serif text-sm"
                    style={{ color: "oklch(0.94 0.06 85)" }}
                  >
                    {g.name}
                  </span>
                  <span
                    className="text-[11px] uppercase tracking-[0.18em]"
                    style={{ color: "oklch(0.78 0.05 82 / 70%)" }}
                  >
                    {g.count} membres
                  </span>
                </span>
                {invited[g.id] ? (
                  <Check className="h-4 w-4" style={{ color: "oklch(0.75 0.19 145)" }} />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === "code" && (
        <div className="flex flex-col items-center gap-4">
          <p
            className="text-center text-[12px] leading-relaxed"
            style={{ color: "oklch(0.85 0.05 82 / 80%)" }}
          >
            Partagez ce code à vos amis. Ils peuvent le saisir depuis
            <br />
            l'écran <em>Rejoindre une table</em>.
          </p>
          <div
            className="flex items-center gap-1"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            {code.split("").map((c, i) => (
              <span
                key={i}
                className="flex h-12 w-9 items-center justify-center text-2xl font-bold"
                style={{
                  borderRadius: "0.6rem",
                  background: "linear-gradient(180deg, oklch(0.22 0.04 40), oklch(0.13 0.03 40))",
                  border: "1px solid oklch(0.82 0.14 82 / 40%)",
                  color: "oklch(0.94 0.11 88)",
                  textShadow: "0 1px 0 oklch(0 0 0 / 60%)",
                  boxShadow:
                    "0 4px 10px oklch(0 0 0 / 50%), inset 0 1px 0 oklch(1 0 0 / 10%)",
                }}
              >
                {c}
              </span>
            ))}
          </div>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&color=F0D68C&bgcolor=1B140E&data=${encodeURIComponent(link)}`}
            alt="QR code d'invitation"
            width={200}
            height={200}
            className="mt-1 rounded-2xl"
            style={{
              border: "1px solid oklch(0.82 0.14 82 / 35%)",
              boxShadow: "0 8px 20px -8px oklch(0 0 0 / 70%)",
            }}
          />
          <div className="grid w-full grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => copy(code, "code")}
              className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition active:scale-[0.98]"
              style={{
                background: "linear-gradient(160deg, oklch(0.30 0.06 45), oklch(0.20 0.04 40))",
                border: "1px solid oklch(0.82 0.14 82 / 35%)",
                color: "oklch(0.94 0.11 85)",
                boxShadow: "inset 0 1px 0 oklch(1 0 0 / 10%)",
              }}
            >
              {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === "code" ? "Copié" : "Copier"}
            </button>
            <button
              type="button"
              onClick={share}
              className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition active:scale-[0.98]"
              style={{
                background: "linear-gradient(160deg, oklch(0.44 0.13 155), oklch(0.30 0.09 155))",
                border: "1px solid oklch(0.82 0.14 82 / 40%)",
                color: "oklch(0.95 0.1 85)",
                boxShadow: "inset 0 1px 0 oklch(1 0 0 / 12%)",
              }}
            >
              <Share2 className="h-4 w-4" />
              Partager
            </button>
          </div>
        </div>
      )}

      {tab === "link" && (
        <div className="flex flex-col gap-3">
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: "oklch(0.85 0.05 82 / 80%)" }}
          >
            Un lien direct qui ouvre CAPI et rejoint votre table.
          </p>
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{
              background: "oklch(0.12 0.02 40 / 80%)",
              border: "1px solid oklch(0.82 0.14 82 / 25%)",
            }}
          >
            <Link2 className="h-4 w-4 shrink-0" style={{ color: "oklch(0.82 0.14 82)" }} />
            <span
              className="flex-1 truncate text-[12.5px]"
              style={{ color: "oklch(0.9 0.05 82)" }}
            >
              {link}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => copy(link, "link")}
              className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition active:scale-[0.98]"
              style={{
                background: "linear-gradient(160deg, oklch(0.30 0.06 45), oklch(0.20 0.04 40))",
                border: "1px solid oklch(0.82 0.14 82 / 35%)",
                color: "oklch(0.94 0.11 85)",
                boxShadow: "inset 0 1px 0 oklch(1 0 0 / 10%)",
              }}
            >
              {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === "link" ? "Copié" : "Copier le lien"}
            </button>
            <button
              type="button"
              onClick={share}
              className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition active:scale-[0.98]"
              style={{
                background: "linear-gradient(160deg, oklch(0.44 0.13 155), oklch(0.30 0.09 155))",
                border: "1px solid oklch(0.82 0.14 82 / 40%)",
                color: "oklch(0.95 0.1 85)",
                boxShadow: "inset 0 1px 0 oklch(1 0 0 / 12%)",
              }}
            >
              <Share2 className="h-4 w-4" />
              Partager
            </button>
          </div>
        </div>
      )}
    </PremiumModal>
  );
}
