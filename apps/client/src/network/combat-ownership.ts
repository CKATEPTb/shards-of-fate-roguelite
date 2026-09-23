import type { RoomState } from '@shards/protocol';

/** A disconnected participant's hero remains playable by the host until reclaimed. */
export function resolveControllableHeroIds(room: RoomState | null, memberId: string | null, heroIds: readonly string[], hostControlsUnclaimed = true): string[] {
  const own = room?.members.find(member => member.id === memberId)?.heroId;
  if (!own) return [];
  if (!hostControlsUnclaimed || room?.hostId !== memberId) return [own];
  const claimed = new Set(room.members.filter(member => member.ready).map(member => member.heroId));
  return heroIds.filter(id => id === own || !claimed.has(id));
}
