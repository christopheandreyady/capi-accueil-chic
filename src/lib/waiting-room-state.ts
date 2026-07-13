export type WaitingRoomPlayer = {
  ready: boolean;
};

export type WaitingRoomSeat<TPlayer extends WaitingRoomPlayer = WaitingRoomPlayer> = {
  position: string;
  player: TPlayer | null;
};

export function getWaitingRoomState<TPlayer extends WaitingRoomPlayer>(
  seats: WaitingRoomSeat<TPlayer>[],
  capacity = 4,
) {
  const playersCount = seats.reduce((count, seat) => count + (seat.player ? 1 : 0), 0);
  const readyCount = seats.reduce(
    (count, seat) => count + (seat.player?.ready === true ? 1 : 0),
    0,
  );
  const roomFull = playersCount === capacity;

  return {
    playersCount,
    readyCount,
    roomFull,
    allReady: roomFull && readyCount === capacity,
  };
}

export function markSeatReady<
  TPlayer extends WaitingRoomPlayer,
  TSeat extends WaitingRoomSeat<TPlayer>,
>(
  seats: TSeat[],
  position: string,
): TSeat[] {
  return seats.map((seat) =>
    seat.position === position && seat.player && !seat.player.ready
      ? { ...seat, player: { ...seat.player, ready: true } }
      : seat,
  ) as TSeat[];
}

export function setSeatPlayer<
  TPlayer extends WaitingRoomPlayer,
  TSeat extends WaitingRoomSeat<TPlayer>,
>(
  seats: TSeat[],
  position: string,
  player: TPlayer | null,
): TSeat[] {
  return seats.map((seat) =>
    seat.position === position ? { ...seat, player } : seat,
  ) as TSeat[];
}