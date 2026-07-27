import { useEffect, useRef, useState } from "react";
import capiEmblem from "@/assets/capi-emblem.png";
import bistrotTable from "@/assets/capi-bistrot-table.jpg";

/**
 * CAPI intro — "La Contrée Royale" signature opening (~5s).
 *
 * Timeline:
 *   0.00s  full black
 *   0.30s  soft golden ray of light fades in
 *   0.60s  gold CAPI coin appears (tiny), begins spinning fast
 *   2.20s  spin decelerates
 *   2.80s  coin drops onto the felt with a natural bounce
 *   3.10s  wordmark "LA CONTRÉE ROYALE" fades up
 *   3.20s  a few cards glide softly around the coin
 *   4.60s  everything fades gently into the main menu
 *
 * A single tap/click skips instantly. Set
 *   localStorage["capi-intro-disabled"] = "1"
 * to disable entirely.
 *
 * All sound is generated procedurally with WebAudio (no assets, no network).
 */

const TOTAL_MS = 5000;
const FADE_MS = 550;

// -- WebAudio helpers -------------------------------------------------------

type AC = AudioContext;

function noiseBuf(ctx: AC, seconds: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Metallic shimmer while the coin spins: rapid tiny bell partials with
// tremolo — reads as a spinning gold coin catching light.
function playCoinSpin(ctx: AC, dest: GainNode, t0: number, dur: number) {
  const partials = [2637, 3136, 3520, 4186];
  partials.forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.035, t0 + 0.25);
    g.gain.linearRampToValueAtTime(0.02, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    // Slow tremolo per partial so the shimmer breathes
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 7 + i * 1.7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(g.gain);
    o.connect(g).connect(dest);
    o.start(t0);
    lfo.start(t0);
    o.stop(t0 + dur + 0.05);
    lfo.stop(t0 + dur + 0.05);
  });
}

// Coin lands: soft thud + metallic ring with 2 bounces.
function playCoinDrop(ctx: AC, dest: GainNode, t0: number) {
  const bounces = [0, 0.14, 0.24];
  bounces.forEach((off, i) => {
    const amp = 1 - i * 0.55;
    const t = t0 + off;
    // Thud body
    const thud = ctx.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(180, t);
    thud.frequency.exponentialRampToValueAtTime(70, t + 0.12);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.exponentialRampToValueAtTime(0.32 * amp, t + 0.008);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    thud.connect(tg).connect(dest);
    thud.start(t); thud.stop(t + 0.22);
    // Metallic ring
    [2200, 3300].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = "sine"; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 * amp, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(dest);
      o.start(t); o.stop(t + 0.4);
    });
  });
}

function playCardShuffle(ctx: AC, dest: GainNode, t0: number) {
  // Pattern of 6 short paper-brush noises = riffle shuffle.
  for (let i = 0; i < 6; i++) {
    const t = t0 + i * 0.06;
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf(ctx, 0.08);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 2400 + i * 200; bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    n.connect(bp).connect(g).connect(dest);
    n.start(t); n.stop(t + 0.1);
  }
}

function playChipsClink(ctx: AC, dest: GainNode, t0: number) {
  [0, 0.06, 0.12].forEach((off, i) => {
    const t = t0 + off;
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf(ctx, 0.04);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 3800;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 5200 + i * 420; bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(hp).connect(bp).connect(g).connect(dest);
    n.start(t); n.stop(t + 0.06);
  });
}

// -- Music: soft piano + acoustic guitar + upright bass + subtle accordion --

function pianoNote(ctx: AC, dest: GainNode, freq: number, t: number, dur: number, vel = 0.2) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 2500;
  g.connect(lp).connect(dest);
  const partials: [OscillatorType, number, number][] = [
    ["sine", 1, 1], ["triangle", 2, 0.28], ["sine", 3, 0.09],
  ];
  for (const [type, mult, amp] of partials) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq * mult;
    const pg = ctx.createGain(); pg.gain.value = amp;
    o.connect(pg).connect(g);
    o.start(t); o.stop(t + dur + 0.05);
  }
}

function bassNote(ctx: AC, dest: GainNode, freq: number, t: number, dur: number) {
  const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}

function guitarPluck(ctx: AC, dest: GainNode, freq: number, t: number) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuf(ctx, 0.03);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  n.connect(bp).connect(g).connect(dest);
  n.start(t); n.stop(t + 0.05);
  const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = freq;
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  o.connect(og).connect(dest);
  o.start(t); o.stop(t + 0.85);
}

// Subtle accordion-ish pad: two sawtooth voices detuned + slow lowpass
function accordionPad(ctx: AC, dest: GainNode, freq: number, t: number, dur: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.06, t + 0.35);
  g.gain.linearRampToValueAtTime(0.04, t + dur - 0.4);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 1300;
  g.connect(lp).connect(dest);
  [-6, 6].forEach((cents) => {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq * Math.pow(2, cents / 1200);
    const og = ctx.createGain(); og.gain.value = 0.5;
    o.connect(og).connect(g);
    o.start(t); o.stop(t + dur + 0.05);
  });
}

function scheduleMusic(ctx: AC, dest: GainNode, t0: number) {
  const N: Record<string, number> = {
    D3: 146.83, G3: 196.0, C4: 261.63, D4: 293.66, E4: 329.63,
    F4: 349.23, G4: 392.0, A4: 440.0, C5: 523.25, D5: 587.33,
  };
  // Warm Dm7 -> G -> C progression
  bassNote(ctx, dest, N.D3, t0 + 0.0, 1.8);
  bassNote(ctx, dest, N.G3, t0 + 1.8, 1.6);
  accordionPad(ctx, dest, N.F4, t0 + 0.0, 3.2);
  accordionPad(ctx, dest, N.A4, t0 + 0.0, 3.2);
  pianoNote(ctx, dest, N.F4, t0 + 0.1, 1.6, 0.18);
  pianoNote(ctx, dest, N.A4, t0 + 0.1, 1.6, 0.14);
  pianoNote(ctx, dest, N.D5, t0 + 0.5, 1.2, 0.12);
  pianoNote(ctx, dest, N.G4, t0 + 1.85, 1.4, 0.16);
  pianoNote(ctx, dest, N.D4, t0 + 1.85, 1.4, 0.12);
  [0.25, 0.6, 0.95, 1.3, 1.9, 2.25, 2.6].forEach((off, i) => {
    const seq = [N.A4, N.D4, N.F4, N.A4, N.G4, N.D4, N.E4];
    guitarPluck(ctx, dest, seq[i % seq.length], t0 + off);
  });
}

// -- Component --------------------------------------------------------------

export function SplashScreen() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("capi-intro-disabled") !== "1";
  });
  // 0 black · 1 ray · 2 coin spinning · 3 coin landed · 4 fade
  const [step, setStep] = useState(0);
  const shownRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const ctxRef = useRef<AC | null>(null);

  useEffect(() => {
    if (!visible || shownRef.current) return;
    shownRef.current = true;

    const AudioCtor: typeof AudioContext | undefined =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtor) {
      try {
        const ctx = new AudioCtor();
        ctxRef.current = ctx;
        const master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination);
        const musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
        const sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
        const schedule = () => {
          const t = ctx.currentTime + 0.05;
          playCoinSpin(ctx, sfxBus, t + 0.55, 2.25);       // spin shimmer
          playCoinDrop(ctx, sfxBus, t + 2.80);              // land + bounce
          playCardShuffle(ctx, sfxBus, t + 3.30);           // cards glide
          playChipsClink(ctx, sfxBus, t + 3.60);            // subtle chips
          scheduleMusic(ctx, musicBus, t + 0.90);           // warm bistrot music
        };
        if (ctx.state === "suspended") ctx.resume().then(schedule).catch(schedule);
        else schedule();
      } catch { /* silent */ }
    }

    const push = (fn: () => void, at: number) => { timersRef.current.push(window.setTimeout(fn, at)); };
    push(() => setStep(1), 300);   // ray of light
    push(() => setStep(2), 600);   // coin spinning
    push(() => setStep(3), 2800);  // coin lands, wordmark + cards
    push(() => setStep(4), TOTAL_MS - FADE_MS);
    push(() => setVisible(false), TOTAL_MS);
  }, [visible]);

  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
    const ctx = ctxRef.current;
    if (ctx) setTimeout(() => { try { ctx.close(); } catch { /* noop */ } }, 400);
  }, []);

  const skip = () => {
    setStep(4);
    window.setTimeout(() => setVisible(false), FADE_MS);
  };

  if (!visible) return null;

  const rayOpacity = step >= 1 ? 1 : 0;
  const feltOpacity = step >= 3 ? 0.65 : 0;
  const wordmarkOn = step >= 3 && step < 4;
  const rootOpacity = step >= 4 ? 0 : 1;

  return (
    <div
      onClick={skip}
      onTouchStart={skip}
      role="button"
      aria-label="Passer l'introduction"
      className="fixed inset-0 z-[9999] overflow-hidden flex items-center justify-center"
      style={{
        background: "#000",
        opacity: rootOpacity,
        transition: `opacity ${FADE_MS}ms ease-out`,
        cursor: "pointer",
        perspective: "1200px",
      }}
    >
      {/* Local keyframes */}
      <style>{`
        @keyframes capi-spin {
          0%   { transform: translate(-50%, -50%) scale(0.35) rotateY(0deg); }
          55%  { transform: translate(-50%, -60%) scale(1.05) rotateY(1800deg); }
          85%  { transform: translate(-50%, -55%) scale(1.02) rotateY(2340deg); }
          100% { transform: translate(-50%, -50%) scale(1.00) rotateY(2520deg); }
        }
        @keyframes capi-land {
          0%   { transform: translate(-50%, -50%) scale(1.00) rotateY(2520deg); }
          40%  { transform: translate(-50%, -38%) scale(1.06) rotateY(2520deg); }
          65%  { transform: translate(-50%, -50%) scale(0.96) rotateY(2520deg); }
          82%  { transform: translate(-50%, -46%) scale(1.02) rotateY(2520deg); }
          100% { transform: translate(-50%, -50%) scale(1.00) rotateY(2520deg); }
        }
        @keyframes capi-card-l {
          0%   { transform: translate(-50%, -50%) translateX(-40px) rotate(-24deg); opacity: 0; }
          100% { transform: translate(-50%, -50%) translateX(-140px) rotate(-14deg); opacity: 0.85; }
        }
        @keyframes capi-card-r {
          0%   { transform: translate(-50%, -50%) translateX(40px) rotate(24deg); opacity: 0; }
          100% { transform: translate(-50%, -50%) translateX(140px) rotate(14deg); opacity: 0.85; }
        }
        @keyframes capi-ray-in {
          0% { opacity: 0; transform: scaleY(0.6); }
          100% { opacity: 1; transform: scaleY(1); }
        }
      `}</style>

      {/* Golden ray of light from above */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          width: "min(90vw, 720px)",
          height: "100%",
          background:
            "radial-gradient(60% 55% at 50% 45%, oklch(0.95 0.16 82 / 32%) 0%, oklch(0.85 0.14 74 / 12%) 40%, transparent 72%)",
          opacity: rayOpacity,
          transition: "opacity 900ms ease-out",
          mixBlendMode: "screen",
          transformOrigin: "50% 0%",
          animation: step >= 1 ? "capi-ray-in 900ms ease-out both" : undefined,
        }}
      />

      {/* Felt/table hint appearing when coin lands */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `url(${bistrotTable})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: feltOpacity,
          transform: `scale(${step >= 3 ? 1.02 : 1.08})`,
          transition: "opacity 1200ms ease-out, transform 1600ms ease-out",
          filter: "brightness(0.5) saturate(1.05)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 55%, transparent 0%, transparent 55%, #000 100%)",
        }}
      />

      {/* Cards gliding out from under the coin when it lands */}
      {step >= 3 && (
        <>
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2"
            style={{
              width: 54, height: 78,
              borderRadius: 6,
              background: "linear-gradient(155deg, oklch(0.28 0.04 40), oklch(0.16 0.03 38))",
              border: "1px solid oklch(0.55 0.12 82 / 55%)",
              boxShadow: "0 10px 22px oklch(0 0 0 / 65%)",
              transformOrigin: "center",
              animation: "capi-card-l 900ms cubic-bezier(0.22,0.7,0.25,1) both",
              animationDelay: "80ms",
              zIndex: 2,
            }}
          />
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2"
            style={{
              width: 54, height: 78,
              borderRadius: 6,
              background: "linear-gradient(155deg, oklch(0.28 0.04 40), oklch(0.16 0.03 38))",
              border: "1px solid oklch(0.55 0.12 82 / 55%)",
              boxShadow: "0 10px 22px oklch(0 0 0 / 65%)",
              transformOrigin: "center",
              animation: "capi-card-r 900ms cubic-bezier(0.22,0.7,0.25,1) both",
              animationDelay: "180ms",
              zIndex: 2,
            }}
          />
        </>
      )}

      {/* The coin */}
      {step >= 2 && (
        <img
          src={capiEmblem}
          alt=""
          width={512}
          height={512}
          className="absolute left-1/2 top-1/2"
          style={{
            width: "min(38vw, 200px)",
            height: "min(38vw, 200px)",
            transformStyle: "preserve-3d",
            willChange: "transform",
            filter:
              "drop-shadow(0 14px 32px oklch(0 0 0 / 85%)) drop-shadow(0 0 40px oklch(0.85 0.16 82 / 55%)) contrast(1.15) brightness(1.1)",
            animation:
              step < 3
                ? "capi-spin 2200ms cubic-bezier(0.18, 0.55, 0.20, 1.0) both"
                : "capi-land 900ms cubic-bezier(0.22, 0.9, 0.25, 1.0) both",
            zIndex: 3,
          }}
        />
      )}

      {/* Wordmark */}
      <div
        className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-2 text-center px-6"
        style={{
          bottom: "22%",
          opacity: wordmarkOn ? 1 : 0,
          transform: `translateY(${wordmarkOn ? 0 : 14}px)`,
          transition: "opacity 900ms ease-out, transform 1100ms ease-out",
          zIndex: 4,
        }}
      >
        <div
          className="tracking-[0.32em]"
          style={{
            fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
            fontWeight: 500,
            fontSize: "clamp(20px, 4.8vw, 36px)",
            color: "oklch(0.92 0.09 82)",
            textShadow:
              "0 1px 0 oklch(0 0 0 / 80%), 0 0 26px oklch(0.85 0.14 78 / 50%)",
          }}
        >
          LA CONTRÉE ROYALE
        </div>
        <div
          className="tracking-[0.42em]"
          style={{
            fontSize: "10px",
            color: "oklch(0.78 0.08 78 / 70%)",
          }}
        >
          ENTRE AMIS, AUTOUR DE LA TABLE
        </div>
      </div>

      {/* Skip hint */}
      <div
        className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.3em]"
        style={{
          color: "oklch(0.8 0.03 78 / 45%)",
          opacity: step >= 2 && step < 4 ? 1 : 0,
          transition: "opacity 500ms ease-out",
          zIndex: 5,
        }}
      >
        TOUCHER POUR PASSER
      </div>
    </div>
  );
}
