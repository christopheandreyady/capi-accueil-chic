// Multijoueur "Entre amis" — couche réseau temps réel (Lovable Cloud).
//
// Architecture : l'hôte (créateur de la table) fait tourner le moteur de jeu
// existant et publie un instantané complet de l'état après chaque changement.
// Les invités affichent cet instantané (pivoté pour que leur siège soit en bas)
// et renvoient leurs actions (annonce, contre, carte jouée) à l'hôte.
//
// Sièges absolus : 0, 1, 2, 3 dans le sens horaire. 0 est l'hôte.
// Équipes : sièges 0/2 = équipe A, sièges 1/3 = équipe B.

import { supabase } from "@/integrations/supabase/client";
import type { TableConfig } from "@/lib/table-config";

export type LocalPosition = "bottom" | "left" | "top" | "right";
// Même ordre que le moteur de jeu (src/lib/contree.ts) pour que le lobby et la
// table utilisent exactement la même rotation de sièges.
export const CLOCKWISE_POSITIONS: LocalPosition[] = ["bottom", "left", "top", "right"];


export type RoomRow = {
  id: string;
  code: string;
  host_client_id: string;
  config: TableConfig;
  status: "lobby" | "playing" | "ended";
  fill_with_bots: boolean;
  state: unknown | null;
  state_seq: number;
  updated_at: string;
};

export type RoomPlayerRow = {
  id: string;
  room_id: string;
  seat: number;
  client_id: string;
  name: string;
  avatar: string | null;
  level: number;
  is_bot: boolean;
  is_host: boolean;
  ready: boolean;
  connected: boolean;
  last_seen: string;
};

export type RoomAction = {
  id: number;
  room_id: string;
  client_id: string;
  seat: number | null;
  type: string;
  payload: Record<string, unknown>;
};

const CLIENT_KEY = "capi:client-id";
const NAME_KEY = "capi:player-name";
const SESSION_KEY = "capi:room-session";

/** Identifiant stable de l'appareil (permet de retrouver son siège après une coupure). */
export function getClientId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(CLIENT_KEY);
  if (!id) {
    id = `c_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(CLIENT_KEY, id);
  }
  return id;
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "Joueur";
  return localStorage.getItem(NAME_KEY) || "";
}

export function setPlayerName(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NAME_KEY, name.trim().slice(0, 18));
}

export type RoomSession = { roomId: string; code: string; seat: number; isHost: boolean };

export function saveRoomSession(s: RoomSession) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

export function loadRoomSession(): RoomSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoomSession;
  } catch {
    return null;
  }
}

export function clearRoomSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

const AVATAR_POOL = [12, 5, 11, 20, 24, 32, 36, 51, 56, 65];

function randomAvatar(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `https://i.pravatar.cc/200?img=${AVATAR_POOL[h % AVATAR_POOL.length]}`;
}

/** Crée une table privée et y assoit le créateur (siège 0, hôte). */
export async function createRoom(cfg: TableConfig, name: string, fillWithBots: boolean) {
  const clientId = getClientId();
  const { data: room, error } = await supabase
    .from("rooms")
    .insert({
      code: cfg.code,
      host_client_id: clientId,
      config: cfg as unknown as never,
      status: "lobby",
      fill_with_bots: fillWithBots,
    })
    .select()
    .single();
  if (error || !room) throw error ?? new Error("Création impossible");

  const { error: pErr } = await supabase.from("room_players").insert({
    room_id: room.id,
    seat: 0,
    client_id: clientId,
    name: name || "Hôte",
    avatar: randomAvatar(clientId),
    level: 20,
    is_host: true,
    ready: true,
  });
  if (pErr) throw pErr;

  const session: RoomSession = { roomId: room.id, code: room.code, seat: 0, isHost: true };
  saveRoomSession(session);
  return session;
}

export async function findRoomByCode(code: string) {
  const { data } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  return (data as RoomRow | null) ?? null;
}

/** Rejoint une table via son code. Reprend le siège existant si l'appareil est connu. */
export async function joinRoom(code: string, name: string): Promise<RoomSession> {
  const clientId = getClientId();
  const room = await findRoomByCode(code);
  if (!room) throw new Error("Aucune table ne correspond à ce code.");

  const { data: players } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_id", room.id);
  const list = (players ?? []) as RoomPlayerRow[];

  const mine = list.find((p) => p.client_id === clientId);
  if (mine) {
    await supabase
      .from("room_players")
      .update({ connected: true, last_seen: new Date().toISOString(), name: name || mine.name })
      .eq("id", mine.id);
    const session: RoomSession = {
      roomId: room.id,
      code: room.code,
      seat: mine.seat,
      isHost: mine.is_host,
    };
    saveRoomSession(session);
    return session;
  }

  if (room.status !== "lobby") throw new Error("La partie a déjà commencé.");

  const taken = new Set(list.filter((p) => !p.is_bot).map((p) => p.seat));
  const botSeats = list.filter((p) => p.is_bot);
  let seat = [0, 1, 2, 3].find((s) => !taken.has(s) && !botSeats.some((b) => b.seat === s));
  if (seat === undefined) {
    // Une place tenue par un bot peut être reprise par un humain.
    const bot = botSeats[0];
    if (!bot) throw new Error("La table est complète.");
    await supabase.from("room_players").delete().eq("id", bot.id);
    seat = bot.seat;
  }

  const { error } = await supabase.from("room_players").insert({
    room_id: room.id,
    seat,
    client_id: clientId,
    name: name || `Joueur ${seat + 1}`,
    avatar: randomAvatar(clientId),
    level: 18,
    ready: true,
  });
  if (error) throw error;

  const session: RoomSession = { roomId: room.id, code: room.code, seat, isHost: false };
  saveRoomSession(session);
  return session;
}

export async function leaveRoom(roomId: string) {
  const clientId = getClientId();
  await supabase.from("room_players").delete().eq("room_id", roomId).eq("client_id", clientId);
  clearRoomSession();
}

export async function fetchRoom(roomId: string) {
  const { data } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
  return (data as RoomRow | null) ?? null;
}

export async function fetchPlayers(roomId: string) {
  const { data } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_id", roomId)
    .order("seat");
  return (data ?? []) as RoomPlayerRow[];
}

export async function heartbeat(roomId: string) {
  const clientId = getClientId();
  await supabase
    .from("room_players")
    .update({ connected: true, last_seen: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("client_id", clientId);
}

export async function setFillWithBots(roomId: string, value: boolean) {
  await supabase.from("rooms").update({ fill_with_bots: value }).eq("id", roomId);
}

/** L'hôte complète les places libres avec des bots puis lance la partie. */
export async function startGame(roomId: string, bots: { name: string; level: number; photo: string }[]) {
  const room = await fetchRoom(roomId);
  if (!room) throw new Error("Table introuvable");
  const players = await fetchPlayers(roomId);
  const taken = new Set(players.map((p) => p.seat));
  const free = [0, 1, 2, 3].filter((s) => !taken.has(s));

  if (free.length > 0) {
    if (!room.fill_with_bots) throw new Error("Il manque des joueurs.");
    const rows = free.map((seat, i) => {
      const bot = bots[i % Math.max(bots.length, 1)];
      return {
        room_id: roomId,
        seat,
        client_id: `bot_${roomId}_${seat}`,
        name: bot?.name ?? `Bot ${seat + 1}`,
        avatar: bot?.photo ?? null,
        level: bot?.level ?? 18,
        is_bot: true,
        ready: true,
      };
    });
    const { error } = await supabase.from("room_players").insert(rows);
    if (error) throw error;
  }

  await supabase
    .from("rooms")
    .update({ status: "playing", updated_at: new Date().toISOString() })
    .eq("id", roomId);
}

/** Publication d'un instantané complet par l'hôte (source de vérité unique). */
export async function publishState(roomId: string, state: unknown, seq: number) {
  await supabase
    .from("rooms")
    .update({ state: state as never, state_seq: seq, updated_at: new Date().toISOString() })
    .eq("id", roomId);
}

/** Action envoyée par un invité vers l'hôte. */
export async function sendAction(
  roomId: string,
  seat: number,
  type: string,
  payload: Record<string, unknown> = {},
) {
  await supabase.from("room_actions").insert({
    room_id: roomId,
    client_id: getClientId(),
    seat,
    type,
    payload: payload as never,
  });
}

type RoomEvents = {
  onRoom?: (room: RoomRow) => void;
  onPlayers?: (players: RoomPlayerRow[]) => void;
  onAction?: (action: RoomAction) => void;
};

/** Abonnement temps réel : table, joueurs et actions. Retourne la fonction d'arrêt. */
export function subscribeRoom(roomId: string, events: RoomEvents) {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      (payload) => {
        const row = payload.new as RoomRow;
        if (row?.id) events.onRoom?.(row);
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` },
      () => {
        void fetchPlayers(roomId).then((p) => events.onPlayers?.(p));
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "room_actions", filter: `room_id=eq.${roomId}` },
      (payload) => {
        events.onAction?.(payload.new as RoomAction);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Convertit un siège absolu en position locale (mon siège est toujours en bas). */
export function seatToLocal(seat: number, mySeat: number): LocalPosition {
  return CLOCKWISE_POSITIONS[(seat - mySeat + 4) % 4];
}

/** Conversion inverse : position affichée -> siège absolu. */
export function localToSeat(pos: LocalPosition, mySeat: number): number {
  return (CLOCKWISE_POSITIONS.indexOf(pos) + mySeat) % 4;
}

/** Un joueur est considéré déconnecté après 25 s sans signe de vie. */
export function isStale(lastSeen: string, ms = 25000) {
  return Date.now() - new Date(lastSeen).getTime() > ms;
}
