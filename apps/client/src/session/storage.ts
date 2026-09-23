import { coopView, deserializeCoop, deserializeExpedition, hashValue, isBodyAlive, restoreContentHash, serializeCoop, serializeExpedition } from '@shards/game-core';
import type { CoopState, ExpeditionState, GameContent } from '@shards/shared';

export const SESSION_STORAGE_KEY = 'shards-of-fate:session:v1';
const LEGACY_KEYS = ['shards-of-fate:expedition:v1', 'shards-of-fate:expedition:v2', 'shards-of-fate:expedition:v3'];
export interface SessionIdentity { id: string; startedAt: number }
interface SavedSessionBase extends SessionIdentity { savedAt: number; state: ExpeditionState }
export interface SavedSoloSession extends SavedSessionBase { cooperative?: undefined; hostHeroId?: undefined }
export interface SavedNetworkSession extends SavedSessionBase { cooperative: CoopState; hostHeroId: string }
export type SavedSession = SavedSoloSession | SavedNetworkSession;
export interface SessionStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

/**
 * `crypto.randomUUID()` is only exposed by secure contexts in some mobile
 * browsers. The game is also served over a local HTTP address during
 * development, so keep session creation available there with a small
 * collision-resistant fallback.
 */
export function createSessionId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === 'function') cryptoApi.getRandomValues(bytes);
  else bytes.forEach((_value, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${Date.now().toString(36)}-${hex}`;
}

/** A death invalidates the checkpoint immediately, even before the battle result is dismissed. */
export function sessionEnded(state: ExpeditionState): boolean {
  if (state.cooperative) return state.cooperative.failed;
  if (state.failed) return true;
  if (state.combat) return state.combat.status === 'defeat' || state.combat.status === 'draw'
    || state.combat.units.some(unit => unit.team === 'heroes' && (unit.hp <= 0 || !!unit.body && !isBodyAlive(unit.body)));
  return state.world.actors.some(actor => !!actor.body && !isBodyAlive(actor.body));
}

export function clearPrototypeSaves(storage: SessionStorage): void {
  for (const key of LEGACY_KEYS) storage.removeItem(key);
}

export function readSession(storage: SessionStorage, content: GameContent): SavedSession | null {
  const raw = storage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  if (raw.length > 32_000_000) throw new Error('Session too large');
  const value = JSON.parse(raw);
  if (!value || typeof value.id !== 'string' || !value.id.length
    || !Number.isFinite(value.startedAt) || !Number.isFinite(value.savedAt) || typeof value.snapshot !== 'string') throw new Error('Invalid session');
  if (value.version === 2 && value.kind === 'network') {
    if (typeof value.hostHeroId !== 'string') throw new Error('Incompatible network session');
    restoreContentHash(value.contentHash, content, 'session.contentHash');
    const cooperative = deserializeCoop(value.snapshot, content);
    if (!cooperative.actors.some(actor => actor.id === value.hostHeroId)) throw new Error('Unknown saved host hero');
    if (cooperative.failed) { storage.removeItem(SESSION_STORAGE_KEY); return null; }
    const state = coopView(cooperative, value.hostHeroId, content);
    return { id: value.id, startedAt: value.startedAt, savedAt: value.savedAt, state, cooperative, hostHeroId: value.hostHeroId };
  }
  if (value.version !== 1) throw new Error('Unsupported session version');
  const state = deserializeExpedition(value.snapshot, content);
  if (state.world.actors.length !== 1) throw new Error('A local session must have one player');
  if (sessionEnded(state)) { storage.removeItem(SESSION_STORAGE_KEY); return null; }
  return { id: value.id, startedAt: value.startedAt, savedAt: value.savedAt, state };
}

/** One atomic replacement: failed writes leave the previous checkpoint intact. */
export function saveSession(storage: SessionStorage, identity: SessionIdentity, state: ExpeditionState, content: GameContent, now = Date.now()): SavedSoloSession | null {
  if (sessionEnded(state)) { storage.removeItem(SESSION_STORAGE_KEY); return null; }
  if (state.world.actors.length !== 1) throw new Error('A local session must have one player');
  const snapshot = serializeExpedition(state, content);
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ version: 1, id: identity.id, startedAt: identity.startedAt, savedAt: now, snapshot }));
  return { id: identity.id, startedAt: identity.startedAt, savedAt: now, state };
}

/** The host owns the whole checkpoint; a single fallen hero does not erase the room. */
export function saveNetworkSession(storage: SessionStorage, identity: SessionIdentity, cooperative: CoopState, content: GameContent, hostHeroId: string, now = Date.now()): SavedNetworkSession | null {
  if (!cooperative.actors.some(actor => actor.id === hostHeroId)) throw new Error('Unknown saved host hero');
  if (cooperative.failed) { storage.removeItem(SESSION_STORAGE_KEY); return null; }
  const snapshot = serializeCoop(cooperative);
  const state = coopView(cooperative, hostHeroId, content);
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ version: 2, kind: 'network', id: identity.id, startedAt: identity.startedAt, savedAt: now, hostHeroId, contentHash: hashValue(content), snapshot }));
  return { id: identity.id, startedAt: identity.startedAt, savedAt: now, state, cooperative, hostHeroId };
}

export function needsCheckpoint(previous: ExpeditionState, next: ExpeditionState): boolean {
  return previous.bosses !== next.bosses || previous.completed !== next.completed || previous.progression !== next.progression
    || Math.floor(previous.world.tick / 125) !== Math.floor(next.world.tick / 125)
    || previous.world.currentChunkId !== next.world.currentChunkId
    || !!next.combat && next.combat.nextSequence !== previous.combat?.nextSequence
    || !!previous.combat && !next.combat
    || next.combat?.status === 'victory' && previous.combat?.status !== 'victory';
}
