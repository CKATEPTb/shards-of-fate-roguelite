import { deserializeExpedition, isBodyAlive, serializeExpedition } from '@shards/game-core';
import type { ExpeditionState, GameContent } from '@shards/shared';

export const SESSION_STORAGE_KEY = 'shards-of-fate:session:v1';
const LEGACY_KEYS = ['shards-of-fate:expedition:v1', 'shards-of-fate:expedition:v2', 'shards-of-fate:expedition:v3'];
export interface SessionIdentity { id: string; startedAt: number }
export interface SavedSession extends SessionIdentity { savedAt: number; state: ExpeditionState }
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
  if (!value || value.version !== 1 || typeof value.id !== 'string' || !value.id.length
    || !Number.isFinite(value.startedAt) || !Number.isFinite(value.savedAt) || typeof value.snapshot !== 'string') throw new Error('Invalid session');
  const state = deserializeExpedition(value.snapshot, content);
  if (state.world.actors.length !== 1) throw new Error('A local session must have one player');
  if (sessionEnded(state)) { storage.removeItem(SESSION_STORAGE_KEY); return null; }
  return { id: value.id, startedAt: value.startedAt, savedAt: value.savedAt, state };
}

/** One atomic replacement: failed writes leave the previous checkpoint intact. */
export function saveSession(storage: SessionStorage, identity: SessionIdentity, state: ExpeditionState, content: GameContent, now = Date.now()): SavedSession | null {
  if (sessionEnded(state)) { storage.removeItem(SESSION_STORAGE_KEY); return null; }
  if (state.world.actors.length !== 1) throw new Error('A local session must have one player');
  const snapshot = serializeExpedition(state, content);
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ version: 1, id: identity.id, startedAt: identity.startedAt, savedAt: now, snapshot }));
  return { id: identity.id, startedAt: identity.startedAt, savedAt: now, state };
}

export function needsCheckpoint(previous: ExpeditionState, next: ExpeditionState): boolean {
  return previous.world.currentChunkId !== next.world.currentChunkId
    || !!previous.combat && !next.combat
    || next.combat?.status === 'victory' && previous.combat?.status !== 'victory';
}
