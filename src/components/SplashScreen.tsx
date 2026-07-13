import { useEffect, useRef, useState } from "react";
import capiEmblem from "@/assets/capi-emblem.png";

/**
 * CAPI splash screen — structural skeleton only.
 *
 * Renders a full-screen black overlay with a large centered CAPI coin,
 * then fades out into the app after SPLASH_DURATION_MS. Animation and
 * audio hooks below are intentional placeholders; wire real motion /
 * sound into them later without changing the mount site.
 */

const SPLASH_DURATION_MS = 1600;
const FADE_MS = 550;

// Placeholder — hook up the intro animation timeline here later.
function useSplashAnimation(_active: boolean) {
  // e.g. framer-motion sequence, canvas timeline, WebGL, etc.
}

// Placeholder — hook up intro music / SFX here later. Must remain no-op
// until the user opts in to sound (autoplay policies).
function useSplashAudio(_active: boolean) {
  // e.g. new Audio(introMp3).play() on user gesture
}

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const shownRef = useRef(false);

  useSplashAnimation(visible);
  useSplashAudio(visible);

  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    const fadeTimer = window.setTimeout(() => setFading(true), SPLASH_DURATION_MS);
    const doneTimer = window.setTimeout(() => setVisible(false), SPLASH_DURATION_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: "oklch(0 0 0)",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <img
        src={capiEmblem}
        alt="CAPI"
        width={1024}
        height={1024}
        className="h-56 w-56"
        style={{
          filter:
            "drop-shadow(0 12px 28px oklch(0 0 0 / 90%)) drop-shadow(0 0 40px oklch(0.85 0.15 82 / 55%)) contrast(1.2) saturate(1.2) brightness(1.15)",
        }}
      />
    </div>
  );
}
