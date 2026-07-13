import type { ReactNode } from "react";
import { useEffect } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function PremiumModal({ open, onClose, title, subtitle, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ animation: "capi-modal-fade 200ms ease-out both" }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute inset-0 h-full w-full cursor-default"
        style={{
          background: "oklch(0.06 0.02 40 / 65%)",
          backdropFilter: "blur(10px)",
        }}
      />
      <div
        className="relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-3xl"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.22 0.04 40 / 96%) 0%, oklch(0.14 0.03 40 / 98%) 100%)",
          border: "1px solid oklch(0.82 0.14 82 / 30%)",
          boxShadow:
            "0 30px 60px -20px oklch(0 0 0 / 80%), 0 0 40px -10px oklch(0.82 0.14 82 / 15%), inset 0 1px 0 oklch(1 0 0 / 8%)",
          animation: "capi-modal-slide 320ms cubic-bezier(.2,.8,.25,1) both",
        }}
      >
        {/* Golden handle */}
        <div className="flex justify-center pt-3 sm:hidden">
          <span
            className="h-1 w-10 rounded-full"
            style={{ background: "oklch(0.82 0.14 82 / 45%)" }}
          />
        </div>

        <header className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div>
            <h2
              className="font-serif text-lg font-semibold tracking-wide"
              style={{
                background: "linear-gradient(180deg, oklch(0.95 0.1 88), oklch(0.72 0.14 78))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {title}
            </h2>
            {subtitle ? (
              <p
                className="mt-0.5 text-[11px] uppercase tracking-[0.22em]"
                style={{ color: "oklch(0.8 0.08 82 / 75%)" }}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95"
            style={{
              background: "oklch(0.15 0.02 40 / 70%)",
              border: "1px solid oklch(0.82 0.14 82 / 25%)",
              color: "oklch(0.9 0.1 85)",
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-6 pb-7">{children}</div>
      </div>

      <style>{`
        @keyframes capi-modal-fade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes capi-modal-slide {
          0% { opacity: 0; transform: translateY(24px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
