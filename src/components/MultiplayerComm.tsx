import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Mic, MicOff, Volume2, VolumeX, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Multiplayer communication layer for CAPI.
//
// Two independent systems, both gated to multiplayer games (the bot mode is
// intentionally left untouched):
//   1. Quick preset messages — a floating 💬 button opens a categorised
//      picker; sending emits an "emote" event so the parent can float a
//      bubble above the local avatar. 5s cooldown per player.
//   2. Optional voice chat — off by default, per-player toggle, master
//      mute, master volume, and a "disable feature" switch. We wire the
//      local mic (getUserMedia) so the "speaking" halo works today; the
//      actual peer transport is left to the multiplayer backend.
//
// The component renders nothing outside multiplayer, so nothing changes in
// the bot mode.
// ---------------------------------------------------------------------------

export type EmotePayload = { id: string; text: string; ts: number };

const GREETINGS = ["Bonjour !", "Bonsoir !", "Salut !", "Bienvenue !", "Bonne partie !", "Amusez-vous bien !"];
const BIDDING = ["À toi !", "Je passe.", "Belle annonce !", "Bien joué !", "Je réfléchis..."];
const PLAY = ["Bien joué !", "Beau pli !", "Jolie carte !", "Bravo !", "Oups !", "Quel coup !", "Magnifique !"];
const END = ["Merci pour la partie !", "Belle revanche !", "À bientôt !", "Encore une ?"];
const EMOJIS = ["👍", "👏", "😊", "😄", "😎", "🤝", "🍀", "❤️", "🎉", "☕", "🃏"];

const COOLDOWN_MS = 5000;

type VoiceState = {
  enabled: boolean;   // master switch (feature on/off)
  micOn: boolean;     // local mic broadcasting
  muteAll: boolean;   // silence remote players
  volume: number;     // 0..1
};

const DEFAULT_VOICE: VoiceState = { enabled: false, micOn: false, muteAll: false, volume: 0.8 };

function loadVoice(): VoiceState {
  if (typeof localStorage === "undefined") return DEFAULT_VOICE;
  try {
    const raw = localStorage.getItem("capi-voice-settings");
    if (!raw) return DEFAULT_VOICE;
    return { ...DEFAULT_VOICE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_VOICE;
  }
}

function saveVoice(v: VoiceState) {
  try { localStorage.setItem("capi-voice-settings", JSON.stringify(v)); } catch { /* ignore */ }
}

export function MultiplayerComm({
  isMultiplayer,
  onEmote,
  onSpeakingChange,
  isMobile,
}: {
  isMultiplayer: boolean;
  onEmote: (payload: EmotePayload) => void;
  /** Fires with true/false as the local player's mic crosses the speech threshold. */
  onSpeakingChange?: (speaking: boolean) => void;
  isMobile?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voice, setVoice] = useState<VoiceState>(loadVoice);
  const lastEmoteRef = useRef(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => { saveVoice(voice); }, [voice]);

  // Countdown ticker so the composer disables while cooling down.
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, COOLDOWN_MS - (Date.now() - lastEmoteRef.current));
      setCooldownLeft(left);
      if (left === 0) window.clearInterval(id);
    }, 200);
    return () => window.clearInterval(id);
  }, [cooldownLeft]);

  const sendEmote = useCallback((text: string) => {
    const now = Date.now();
    if (now - lastEmoteRef.current < COOLDOWN_MS) return;
    lastEmoteRef.current = now;
    setCooldownLeft(COOLDOWN_MS);
    onEmote({ id: `${now}-${Math.random().toString(36).slice(2, 7)}`, text, ts: now });
    setPickerOpen(false);
  }, [onEmote]);

  // Local mic — feeds the speaking indicator. Actual peer streaming is the
  // multiplayer transport's job; this covers the "am I currently talking"
  // visual for the local seat.
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const speakingRef = useRef(false);

  const stopMic = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    if (speakingRef.current) {
      speakingRef.current = false;
      onSpeakingChange?.(false);
    }
  }, [onSpeakingChange]);

  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const AC: typeof AudioContext = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new AC();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        const speaking = rms > 0.06;
        if (speaking !== speakingRef.current) {
          speakingRef.current = speaking;
          onSpeakingChange?.(speaking);
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      // Permission denied or unsupported — silently roll back the toggle.
      setVoice((v) => ({ ...v, micOn: false }));
    }
  }, [onSpeakingChange]);

  useEffect(() => {
    if (!isMultiplayer) { stopMic(); return; }
    if (voice.enabled && voice.micOn) {
      startMic();
      return () => stopMic();
    }
    stopMic();
  }, [isMultiplayer, voice.enabled, voice.micOn, startMic, stopMic]);

  const categories = useMemo(() => ([
    { label: "Salutations", items: GREETINGS },
    { label: "Annonces", items: BIDDING },
    { label: "Pendant la partie", items: PLAY },
    { label: "Fin de partie", items: END },
  ]), []);

  if (!isMultiplayer) return null;

  const btnBase = "flex h-11 w-11 items-center justify-center rounded-full border transition active:scale-95";
  const btnStyle = {
    background: "oklch(0.2 0.03 40 / 78%)",
    borderColor: "oklch(0.82 0.14 82 / 40%)",
    backdropFilter: "blur(8px)",
    color: "oklch(0.94 0.1 85)",
  } as const;

  return (
    <>
      {/* Floating actions — bottom-right, above safe area so mobile hands
          don't collide. */}
      <div
        className="pointer-events-none absolute z-50 flex flex-col gap-2"
        style={{
          right: isMobile ? 10 : 18,
          bottom: `calc(${isMobile ? 96 : 24}px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <button
          type="button"
          onClick={() => { setPickerOpen((v) => !v); setVoiceOpen(false); }}
          className={`${btnBase} pointer-events-auto`}
          style={btnStyle}
          aria-label="Messages rapides"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => { setVoiceOpen((v) => !v); setPickerOpen(false); }}
          className={`${btnBase} pointer-events-auto`}
          style={{
            ...btnStyle,
            borderColor: voice.enabled && voice.micOn ? "oklch(0.82 0.18 145 / 70%)" : btnStyle.borderColor,
          }}
          aria-label="Chat vocal"
        >
          {voice.enabled && voice.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 opacity-80" />}
        </button>
      </div>

      {/* Quick messages picker */}
      {pickerOpen && (
        <div
          className="absolute z-[60] flex max-h-[70vh] w-[min(320px,86vw)] flex-col overflow-hidden rounded-2xl border shadow-2xl animate-scale-in"
          style={{
            right: isMobile ? 10 : 18,
            bottom: `calc(${isMobile ? 156 : 84}px + env(safe-area-inset-bottom, 0px))`,
            background: "oklch(0.17 0.03 40 / 96%)",
            borderColor: "oklch(0.82 0.14 82 / 30%)",
            backdropFilter: "blur(14px)",
            color: "oklch(0.94 0.1 85)",
          }}
        >
          <div className="flex items-center justify-between border-b px-3 py-2 text-[13px] font-medium" style={{ borderColor: "oklch(0.82 0.14 82 / 20%)" }}>
            <span>Messages rapides</span>
            <button onClick={() => setPickerOpen(false)} aria-label="Fermer" className="rounded-full p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-3 py-2 text-[13px]">
            {categories.map((cat) => (
              <div key={cat.label} className="mb-3">
                <div className="mb-1 text-[11px] uppercase tracking-wider opacity-60">{cat.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {cat.items.map((msg) => (
                    <button
                      key={msg}
                      onClick={() => sendEmote(msg)}
                      disabled={cooldownLeft > 0}
                      className="rounded-full border px-3 py-1 text-[12px] transition hover:brightness-125 active:scale-95 disabled:opacity-40"
                      style={{ background: "oklch(0.22 0.03 40 / 80%)", borderColor: "oklch(0.82 0.14 82 / 30%)" }}
                    >
                      {msg}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="mb-1 text-[11px] uppercase tracking-wider opacity-60">Emojis</div>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => sendEmote(e)}
                  disabled={cooldownLeft > 0}
                  className="rounded-full border px-2.5 py-1 text-[18px] leading-none transition hover:brightness-125 active:scale-95 disabled:opacity-40"
                  style={{ background: "oklch(0.22 0.03 40 / 80%)", borderColor: "oklch(0.82 0.14 82 / 30%)" }}
                >
                  {e}
                </button>
              ))}
            </div>
            {cooldownLeft > 0 && (
              <div className="pt-1 text-center text-[11px] opacity-60">
                Patientez {Math.ceil(cooldownLeft / 1000)}s avant le prochain message
              </div>
            )}
          </div>
        </div>
      )}

      {/* Voice settings panel */}
      {voiceOpen && (
        <div
          className="absolute z-[60] flex w-[min(300px,86vw)] flex-col gap-3 rounded-2xl border p-3 shadow-2xl animate-scale-in"
          style={{
            right: isMobile ? 10 : 18,
            bottom: `calc(${isMobile ? 156 : 84}px + env(safe-area-inset-bottom, 0px))`,
            background: "oklch(0.17 0.03 40 / 96%)",
            borderColor: "oklch(0.82 0.14 82 / 30%)",
            backdropFilter: "blur(14px)",
            color: "oklch(0.94 0.1 85)",
          }}
        >
          <div className="flex items-center justify-between text-[13px] font-medium">
            <span>Chat vocal</span>
            <button onClick={() => setVoiceOpen(false)} aria-label="Fermer" className="rounded-full p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="flex items-center justify-between text-[12px]">
            <span>Activer la fonctionnalité</span>
            <input
              type="checkbox"
              checked={voice.enabled}
              onChange={(e) => setVoice((v) => ({ ...v, enabled: e.target.checked, micOn: e.target.checked ? v.micOn : false }))}
              className="h-4 w-4 accent-amber-400"
            />
          </label>

          <button
            type="button"
            disabled={!voice.enabled}
            onClick={() => setVoice((v) => ({ ...v, micOn: !v.micOn }))}
            className="flex items-center justify-between rounded-lg border px-3 py-2 text-[12px] transition disabled:opacity-40"
            style={{ background: "oklch(0.22 0.03 40 / 80%)", borderColor: "oklch(0.82 0.14 82 / 30%)" }}
          >
            <span>{voice.micOn ? "Couper mon micro" : "Activer mon micro"}</span>
            {voice.micOn ? <Mic className="h-4 w-4 text-emerald-300" /> : <MicOff className="h-4 w-4 opacity-70" />}
          </button>

          <button
            type="button"
            disabled={!voice.enabled}
            onClick={() => setVoice((v) => ({ ...v, muteAll: !v.muteAll }))}
            className="flex items-center justify-between rounded-lg border px-3 py-2 text-[12px] transition disabled:opacity-40"
            style={{ background: "oklch(0.22 0.03 40 / 80%)", borderColor: "oklch(0.82 0.14 82 / 30%)" }}
          >
            <span>{voice.muteAll ? "Réactiver les autres joueurs" : "Couper les autres joueurs"}</span>
            {voice.muteAll ? <VolumeX className="h-4 w-4 opacity-70" /> : <Volume2 className="h-4 w-4 text-emerald-300" />}
          </button>

          <label className={`flex flex-col gap-1 text-[12px] ${voice.enabled ? "" : "opacity-40"}`}>
            <div className="flex items-center justify-between">
              <span>Volume</span>
              <span className="tabular-nums opacity-70">{Math.round(voice.volume * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
              value={voice.volume}
              disabled={!voice.enabled}
              onChange={(e) => setVoice((v) => ({ ...v, volume: parseFloat(e.target.value) }))}
              className="w-full accent-amber-400"
            />
          </label>

          <p className="text-[10.5px] leading-snug opacity-60">
            Le chat vocal n'est disponible qu'en multijoueur. Vos réglages restent enregistrés sur cet appareil.
          </p>
        </div>
      )}
    </>
  );
}

/** Small floating bubble anchored above an avatar; auto-hides. */
export function EmoteBubble({ text, x, y }: { text: string; x: number; y: number }) {
  return (
    <div
      className="pointer-events-none absolute z-[70] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-2xl border px-3 py-1.5 text-[13px] font-medium shadow-lg animate-fade-in"
      style={{
        left: x,
        top: y - 8,
        background: "oklch(0.18 0.03 40 / 94%)",
        borderColor: "oklch(0.82 0.14 82 / 45%)",
        color: "oklch(0.96 0.1 85)",
        backdropFilter: "blur(8px)",
      }}
    >
      {text}
    </div>
  );
}
