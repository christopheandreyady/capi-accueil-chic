import { useEffect, useRef, useState } from "react";
import capiEmblem from "@/assets/capi-emblem.png";
import bistrotTable from "@/assets/capi-bistrot-table.jpg";

/**
 * CAPI intro sequence — "La Contrée Royale" signature opening.
 *
 * Timeline (~4.5s):
 *   0.0s  full black
 *   0.2s  soft card-on-felt SFX
 *   0.5s  bistrot table fades in under warm key light
 *   0.9s  chip clink SFX
 *   1.4s  wordmark "LA CONTRÉE ROYALE" fades up
 *   1.6s  piano+guitar+bass motif enters (very soft)
 *   3.5s  hold
 *   4.0s  everything fades to the app
 *
 * A single tap anywhere skips the intro immediately. It can also be
 * disabled by setting `localStorage["capi-intro-disabled"] = "1"`.
 * All sound is generated procedurally with WebAudio — no assets, no
 * network — so it survives offline and starts as soon as an
 * AudioContext is allowed by the browser.
 */

const TOTAL_MS = 4200;
const FADE_MS = 550;

// -- WebAudio helpers -------------------------------------------------------

type AC = AudioContext;

function makeNoiseBuffer(ctx: AC, seconds: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function playCardDrop(ctx: AC, master: GainNode, t: number) {
  // Short filtered noise burst = paper-on-felt slap, plus a low thud body.
  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, 0.18);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.35, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  noise.connect(bp).connect(g).connect(master);
  noise.start(t); noise.stop(t + 0.2);

  const thud = ctx.createOscillator();
  thud.type = "sine"; thud.frequency.setValueAtTime(140, t);
  thud.frequency.exponentialRampToValueAtTime(60, t + 0.12);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t);
  tg.gain.exponentialRampToValueAtTime(0.28, t + 0.008);
  tg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  thud.connect(tg).connect(master);
  thud.start(t); thud.stop(t + 0.2);
}

function playChipsSlide(ctx: AC, master: GainNode, t: number) {
  // Two/three tiny high-freq clicks with slight pitch spread = chips clink.
  const clicks = [0, 0.055, 0.11];
  clicks.forEach((offset, i) => {
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.04);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 3500;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 5200 + i * 400; bp.Q.value = 3;
    const g = ctx.createGain();
    const at = t + offset;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.22, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
    noise.connect(hp).connect(bp).connect(g).connect(master);
    noise.start(at); noise.stop(at + 0.06);
  });
}

function playPianoNote(ctx: AC, dest: GainNode, freq: number, t: number, dur: number, vel = 0.22) {
  // Soft "felted piano" — sine fundamental + triangle 2nd harmonic + tiny 3rd,
  // with a lowpass and a slow-ish envelope so it reads as intimate/warm.
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 2600; lp.Q.value = 0.3;
  g.connect(lp).connect(dest);

  const partials: [OscillatorType, number, number][] = [
    ["sine", 1, 1.0],
    ["triangle", 2, 0.28],
    ["sine", 3, 0.10],
  ];
  for (const [type, mult, amp] of partials) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq * mult;
    const pg = ctx.createGain(); pg.gain.value = amp;
    o.connect(pg).connect(g);
    o.start(t); o.stop(t + dur + 0.05);
  }
}

function playBassNote(ctx: AC, dest: GainNode, freq: number, t: number, dur: number) {
  const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}

function playGuitarPluck(ctx: AC, dest: GainNode, freq: number, t: number) {
  // Karplus-Strong-lite: filtered noise burst tuned by delay through a
  // bandpass — reads as a soft acoustic pluck without a real sample.
  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, 0.03);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  noise.connect(bp).connect(g).connect(dest);
  noise.start(t); noise.stop(t + 0.05);

  const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = freq;
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  o.connect(og).connect(dest);
  o.start(t); o.stop(t + 0.85);
}

function startCafeAmbience(ctx: AC, dest: GainNode, t: number) {
  // Barely-there pink-ish noise bed — sits far below everything else.
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 5);
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 700;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.025, t + 1.4);
  src.connect(lp).connect(g).connect(dest);
  src.start(t);
  return src;
}

// A gentle Dm7 → G → C motif (French bistrot flavor, no heroics).
function scheduleMusic(ctx: AC, dest: GainNode, t0: number) {
  const P = (n: string) => {
    const map: Record<string, number> = {
      "D3": 146.83, "A3": 220.00, "F3": 174.61, "G3": 196.00, "C3": 130.81, "E3": 164.81,
      "D4": 293.66, "F4": 349.23, "A4": 440.00, "C5": 523.25, "E4": 329.63, "G4": 392.00,
    };
    return map[n];
  };
  // Bass line: root notes, very sparse
  playBassNote(ctx, dest, P("D3"), t0 + 0.00, 1.6);
  playBassNote(ctx, dest, P("G3"), t0 + 1.60, 1.6);
  // Piano voicing — soft, spread
  playPianoNote(ctx, dest, P("F4"), t0 + 0.05, 1.4, 0.18);
  playPianoNote(ctx, dest, P("A4"), t0 + 0.05, 1.4, 0.14);
  playPianoNote(ctx, dest, P("C5"), t0 + 0.40, 1.1, 0.12);
  playPianoNote(ctx, dest, P("D4"), t0 + 1.65, 1.4, 0.18);
  playPianoNote(ctx, dest, P("G4"), t0 + 1.65, 1.4, 0.14);
  // Acoustic guitar arpeggio on top
  [0.20, 0.55, 0.90, 1.25, 1.80, 2.15, 2.50].forEach((off, i) => {
    const notes = [P("A4"), P("D4"), P("F4"), P("A4"), P("G4"), P("D4"), P("E4")];
    playGuitarPluck(ctx, dest, notes[i % notes.length], t0 + off);
  });
}

// -- React component --------------------------------------------------------

export function SplashScreen() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("capi-intro-disabled") !== "1";
  });
  const [step, setStep] = useState(0); // 0=black, 1=table, 2=logo, 3=fade-out
  const shownRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const ctxRef = useRef<AC | null>(null);
  const ambienceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (!visible || shownRef.current) return;
    shownRef.current = true;

    // Best-effort audio: create context, try to resume; if the browser
    // blocks autoplay, wait for the first user gesture (which also skips).
    const AudioCtor: typeof AudioContext | undefined =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtor) {
      try {
        const ctx = new AudioCtor();
        ctxRef.current = ctx;
        const master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(ctx.destination);
        const musicBus = ctx.createGain();
        musicBus.gain.value = 0.55; // music sits below SFX
        musicBus.connect(master);
        const ambienceBus = ctx.createGain();
        ambienceBus.gain.value = 0.6;
        ambienceBus.connect(master);

        const schedule = () => {
          const t = ctx.currentTime + 0.05;
          playCardDrop(ctx, master, t + 0.20);
          playChipsSlide(ctx, master, t + 0.85);
          ambienceRef.current = startCafeAmbience(ctx, ambienceBus, t + 0.30);
          scheduleMusic(ctx, musicBus, t + 1.55);
        };
        if (ctx.state === "suspended") {
          ctx.resume().then(schedule).catch(schedule);
        } else {
          schedule();
        }
      } catch {
        /* silent — visual intro still runs */
      }
    }

    const push = (fn: () => void, at: number) => {
      timersRef.current.push(window.setTimeout(fn, at));
    };
    push(() => setStep(1), 400);   // table lights up
    push(() => setStep(2), 1500);  // wordmark
    push(() => setStep(3), TOTAL_MS - FADE_MS); // begin fade
    push(() => setVisible(false), TOTAL_MS);    // unmount
  }, [visible]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      try { ambienceRef.current?.stop(); } catch { /* noop */ }
      const ctx = ctxRef.current;
      if (ctx) {
        // Fade out then close so the tail doesn't click.
        try {
          const now = ctx.currentTime;
          const g = ctx.createGain(); // no-op guard if already closed
          g.gain.setValueAtTime(1, now);
        } catch { /* noop */ }
        setTimeout(() => { try { ctx.close(); } catch { /* noop */ } }, 400);
      }
    };
  }, []);

  const skip = () => {
    setStep(3);
    window.setTimeout(() => setVisible(false), FADE_MS);
  };

  if (!visible) return null;

  const tableOpacity = step >= 1 ? 1 : 0;
  const logoOpacity = step === 2 ? 1 : step > 2 ? 0.85 : 0;
  const rootOpacity = step >= 3 ? 0 : 1;

  return (
    <div
      onClick={skip}
      onTouchStart={skip}
      role="button"
      aria-label="Passer l'introduction"
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: "oklch(0 0 0)",
        opacity: rootOpacity,
        transition: `opacity ${FADE_MS}ms ease-out`,
        cursor: "pointer",
      }}
    >
      {/* Bistrot table revealed under a warm key light */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${bistrotTable})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: tableOpacity * 0.75,
          transform: `scale(${step >= 1 ? 1.02 : 1.08})`,
          transition: "opacity 1400ms ease-out, transform 3200ms ease-out",
          filter: "brightness(0.55) saturate(1.05)",
        }}
      />
      {/* Warm overhead key light */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 45% at 50% 42%, oklch(0.94 0.14 78 / 28%) 0%, oklch(0.85 0.12 70 / 10%) 40%, transparent 75%)",
          opacity: tableOpacity,
          transition: "opacity 1600ms ease-out",
          mixBlendMode: "screen",
        }}
      />
      {/* Vignette to keep focus on the wordmark */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 55%, transparent 0%, transparent 55%, oklch(0 0 0 / 78%) 100%)",
        }}
      />

      {/* Wordmark + emblem */}
      <div
        className="relative flex flex-col items-center gap-4 px-6 text-center"
        style={{
          opacity: logoOpacity,
          transform: `translateY(${step >= 2 ? 0 : 12}px)`,
          transition: "opacity 900ms ease-out, transform 1200ms ease-out",
        }}
      >
        <img
          src={capiEmblem}
          alt=""
          width={512}
          height={512}
          className="h-24 w-24"
          style={{
            filter:
              "drop-shadow(0 8px 22px oklch(0 0 0 / 85%)) drop-shadow(0 0 30px oklch(0.85 0.15 82 / 55%)) contrast(1.15) brightness(1.1)",
          }}
        />
        <div
          className="tracking-[0.32em]"
          style={{
            fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
            fontWeight: 500,
            fontSize: "clamp(20px, 4.6vw, 34px)",
            color: "oklch(0.92 0.09 82)",
            textShadow:
              "0 1px 0 oklch(0 0 0 / 80%), 0 0 24px oklch(0.85 0.14 78 / 45%)",
          }}
        >
          LA CONTRÉE ROYALE
        </div>
        <div
          className="tracking-[0.42em]"
          style={{
            fontSize: "10px",
            color: "oklch(0.78 0.08 78 / 70%)",
            letterSpacing: "0.42em",
          }}
        >
          ENTRE AMIS, AUTOUR DE LA TABLE
        </div>
      </div>

      {/* Tiny skip hint */}
      <div
        className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.3em]"
        style={{
          color: "oklch(0.8 0.03 78 / 45%)",
          opacity: step >= 2 && step < 3 ? 1 : 0,
          transition: "opacity 500ms ease-out",
        }}
      >
        TOUCHER POUR PASSER
      </div>
    </div>
  );
}
