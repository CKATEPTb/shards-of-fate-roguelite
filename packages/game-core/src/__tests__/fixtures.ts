import type { GameContent, Stats, UnitDefinition } from '@shards/shared';

export const stats: Stats = { maxHp: 100, power: 10, armor: 0, initiative: 100, crit: 0, evasion: 0, healing: 10 };
export function hero(id = 'hero'): UnitDefinition {
  return { schemaVersion: 1, id, name: id, title: id, description: id, role: 'damage', color: '#ffffff', sprite: id, stats: { ...stats }, basicAttack: { type: 'damage', scaling: 'power' }, skillIds: [], effectIds: [], modifiers: {}, tags: [] };
}
export function contentFixture(): GameContent {
  return {
    schemaVersion: 1, characters: [hero()], enemies: [{ ...hero('enemy'), stats: { ...stats, initiative: -100 }, rank: 'NORMAL', encounterCost: 1 }], skills: [], effects: [], statuses: [],
    encounters: [{ schemaVersion: 1, id: 'test', name: 'test', description: 'test', biome: 'spring', difficulty: 'normal', enemyIds: ['enemy'] }],
    balance: { maxRounds: 50, maxTriggerDepth: 16, maxEventsPerStep: 512, armorFactor: 1, critMultiplier: 2, healThreshold: 0.75, maxDamageReduction: 0.9, partyScaling: { 1: { hp: 1, damage: 1 }, 2: { hp: 1, damage: 1 }, 3: { hp: 1, damage: 1 }, 4: { hp: 1, damage: 1 } } },
  };
}
export const options = { seed: 'test-seed', characterIds: ['hero'], encounterId: 'test' };

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); }
  return value;
}
