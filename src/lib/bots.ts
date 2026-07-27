// Bot library — evolutionary registry of AI opponents used by CAPI.
// Add/remove entries here; the rest of the app picks 3 unique bots at random
// for each new game (see `pickRandomBots`) and stores that trio for the
// duration of the session so waiting room and gameplay stay consistent.

export type Bot = {
  id: string;
  name: string;
  level: number;
  photo: string;
};

// Distinct pravatar avatars per bot. Swap `photo` freely without touching
// game logic — anything that uses a Bot reads from this registry.
export const BOT_LIBRARY: Bot[] = [
  { id: "capi",      name: "CAPI",      level: 30, photo: "https://i.pravatar.cc/200?img=8"  },
  { id: "blond",     name: "Blond",     level: 24, photo: "https://i.pravatar.cc/200?img=13" },
  { id: "goudry",    name: "Goudry",    level: 22, photo: "https://i.pravatar.cc/200?img=14" },
  { id: "nono",      name: "Nono",      level: 19, photo: "https://i.pravatar.cc/200?img=15" },
  { id: "patou",     name: "Patou",     level: 21, photo: "https://i.pravatar.cc/200?img=33" },
  { id: "jade",      name: "Jade",      level: 20, photo: "https://i.pravatar.cc/200?img=47" },
  { id: "louna",     name: "Louna",     level: 17, photo: "https://i.pravatar.cc/200?img=49" },
  { id: "ethan",     name: "Ethan",     level: 18, photo: "https://i.pravatar.cc/200?img=52" },
  { id: "charlotte", name: "Charlotte", level: 23, photo: "https://i.pravatar.cc/200?img=44" },
  { id: "laura",     name: "Laura",     level: 25, photo: "https://i.pravatar.cc/200?img=45" },
  { id: "jimmy",     name: "Jimmy",     level: 16, photo: "https://i.pravatar.cc/200?img=53" },
  { id: "louis",     name: "Louis",     level: 22, photo: "https://i.pravatar.cc/200?img=57" },
  { id: "stephane",  name: "Stéphane",  level: 26, photo: "https://i.pravatar.cc/200?img=60" },
];

export function pickRandomBots(count = 3, exclude: string[] = []): Bot[] {
  const pool = BOT_LIBRARY.filter((b) => !exclude.includes(b.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const STORAGE_KEY = "capi:current-bots";

// Session-scoped trio so the same bots appear in the waiting room and in the
// actual game. Cleared automatically at the end of a session, giving each
// new session a fresh set of opponents.
export function saveCurrentBots(bots: Bot[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bots.map((b) => b.id)));
  } catch {
    /* storage unavailable — non-blocking */
  }
}

export function loadCurrentBots(): Bot[] | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const ids = JSON.parse(raw) as string[];
    const bots = ids
      .map((id) => BOT_LIBRARY.find((b) => b.id === id))
      .filter((b): b is Bot => Boolean(b));
    return bots.length ? bots : null;
  } catch {
    return null;
  }
}

// Convenience: return the current trio if present, otherwise pick a fresh one
// and persist it. Used by any screen that needs the game's opponents.
export function getOrPickBots(count = 3): Bot[] {
  const existing = loadCurrentBots();
  if (existing && existing.length === count) return existing;
  const picked = pickRandomBots(count);
  saveCurrentBots(picked);
  return picked;
}

export function refreshBots(count = 3): Bot[] {
  const picked = pickRandomBots(count);
  saveCurrentBots(picked);
  return picked;
}
