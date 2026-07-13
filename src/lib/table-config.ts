export type TableConfig = {
  name: string;
  isPrivate: boolean;
  maxScore: 1000 | 1500 | 2000;
  announcements: boolean;
  contrer: boolean;
  surcontrer: boolean;
  shuffle: boolean;
  maxSpectators: 0 | 2 | 4 | 8;
  code: string;
};

const KEY = "capi.table.config";

export function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function defaultTableConfig(): TableConfig {
  return {
    name: "Table du Bistrot",
    isPrivate: true,
    maxScore: 1500,
    announcements: true,
    contrer: true,
    surcontrer: false,
    shuffle: true,
    maxSpectators: 2,
    code: generateInviteCode(),
  };
}

export function saveTableConfig(cfg: TableConfig) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    /* noop */
  }
}

export function loadTableConfig(): TableConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TableConfig;
  } catch {
    return null;
  }
}

export function buildInviteLink(code: string): string {
  if (typeof window === "undefined") return `https://capi.app/join/${code}`;
  return `${window.location.origin}/rejoindre-table?code=${code}`;
}
