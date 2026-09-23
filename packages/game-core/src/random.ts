import { RNG_STREAMS, type RngState, type RngStream } from '@shards/shared';
import { drawRoomRandom, reserveRoomDice, validateDiceOwner } from './room-random';

/** FNV-1a over UTF-16 code units. Kept explicit so browser and headless runs agree. */
export function hashString(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return hash >>> 0;
}

export function createRng(seed: string): RngState {
  if (typeof seed !== 'string' || !seed.length || seed.length > 256) throw new Error('Seed must contain 1–256 characters');
  const streams = Object.fromEntries(RNG_STREAMS.map(name => [name, { state: hashString(`${seed}:${name}`) || 1, counter: 0 }])) as RngState['streams'];
  return { seed, streams };
}

export function createRoomRng(seed: string, diceIndex = 0): RngState & { diceIndex: number } {
  const rng = { ...createRng(seed), diceIndex };
  reserveRoomDice(rng, 0);
  return rng;
}

export function createEntityRng(seed: string, owner: string, diceIndex = 0): RngState & { diceIndex: number; diceOwner: string } {
  validateDiceOwner(owner);
  return { ...createRoomRng(seed, diceIndex), diceOwner: owner };
}

/** Retain only this battle's entities; unrelated room counters never enter a combat snapshot. */
export function createCombatEntityRng(seed: string, owners: Record<string, string>, counters: Record<string, number>, diceIndex = 0): RngState & { diceIndex: number; entityDice: NonNullable<RngState['entityDice']> } {
  const rng = createRoomRng(seed, diceIndex);
  if (!owners || typeof owners !== 'object' || Array.isArray(owners)
    || !counters || typeof counters !== 'object' || Array.isArray(counters)) throw new Error('Invalid entity dice maps');
  const entries = Object.entries(owners);
  for (const [id, owner] of entries) {
    if (!id.length || id.length > 256) throw new Error('Combatant ID must contain 1–256 characters');
    validateDiceOwner(owner);
  }
  const selected = [...new Set(entries.map(([, owner]) => owner))].map(owner => {
    const counter = Object.hasOwn(counters, owner) ? counters[owner] : 0;
    if (!Number.isSafeInteger(counter) || counter < 0) throw new Error('Invalid entity dice counter');
    return [owner, counter] as const;
  });
  return { ...rng, entityDice: { owners: Object.fromEntries(entries), counters: Object.fromEntries(selected) } };
}

/** Internal mutation is restricted to the private, cloned state of a step. */
export function drawRandom(rng: RngState, stream: RngStream): number {
  if (rng.diceIndex !== undefined) return drawRoomRandom(rng);
  const current = rng.streams[stream];
  let state = current.state;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  current.state = state >>> 0;
  current.counter++;
  return current.state / 4294967296;
}

export function nextRandom(rng: RngState, stream: RngStream = 'COMBAT'): { value: number; rng: RngState } {
  const updated = structuredClone(rng);
  return { value: drawRandom(updated, stream), rng: updated };
}
