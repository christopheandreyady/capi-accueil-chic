export type ScoringRules = {
  /** Announced-capot bonus (500 points) when both announced and made. */
  capotAnnonce: boolean;
  /** Un-announced capot bonus (250 points) when all 8 tricks are taken. */
  capotNonAnnonce: boolean;
  /** Contré contract won → 320 points (lost → 320 to defenders). */
  contre: boolean;
  /** Surcontré contract won → 640 points (lost → 640 to defenders). */
  surcontre: boolean;
  /** Announced + contré capot made → 1000 points. */
  capotContre: boolean;
  /** Announced + surcontré capot made → 2000 points. */
  capotSurcontre: boolean;
};

export type TableConfig = {
  name: string;
  isPrivate: boolean;
  maxScore: 1000 | 1500 | 2000;
  announcements: boolean;
  contrer: boolean;
  surcontrer: boolean;
  contreVolee: boolean;
  shuffle: boolean;
  maxSpectators: 0 | 2 | 4 | 8;
  code: string;
  scoring: ScoringRules;
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

export function defaultScoringRules(): ScoringRules {
  return {
    capotAnnonce: true,
    capotNonAnnonce: true,
    contre: true,
    surcontre: true,
    capotContre: true,
    capotSurcontre: true,
  };
}

export function defaultTableConfig(): TableConfig {
  return {
    name: "Table du Bistrot",
    isPrivate: true,
    maxScore: 1500,
    announcements: true,
    contrer: true,
    surcontrer: false,
    contreVolee: true,
    shuffle: true,
    maxSpectators: 2,
    code: generateInviteCode(),
    scoring: defaultScoringRules(),
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
    const parsed = JSON.parse(raw) as TableConfig;
    return { ...parsed, scoring: { ...defaultScoringRules(), ...(parsed.scoring ?? {}) } };
  } catch {
    return null;
  }
}

export function buildInviteLink(code: string): string {
  if (typeof window === "undefined") return `https://capi.app/join/${code}`;
  return `${window.location.origin}/rejoindre-table?code=${code}`;
}
