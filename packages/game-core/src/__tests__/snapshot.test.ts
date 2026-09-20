import { describe, expect, it } from 'vitest';
import { createCombat, deserializeSnapshot, hashState, runCombat, serializeSnapshot, stepCombat } from '../index';
import { contentFixture, options } from './fixtures';

describe('versioned combat snapshots', () => {
  it('round-trips ready, active and terminal states and resumes the same future', () => {
    const content = contentFixture();
    const ready = createCombat(options, content);
    const active = stepCombat(stepCombat(ready, content), content);
    const terminal = runCombat(ready, content);
    for (const state of [ready, active, terminal]) {
      const restored = deserializeSnapshot(serializeSnapshot(state), content);
      expect(restored).toEqual(state);
      expect(hashState(restored)).toBe(hashState(state));
      expect(runCombat(restored, content)).toEqual(terminal);
    }
  });

  it.each([
    ['future version', (state: any) => { state.schemaVersion = 2; }],
    ['unknown character', (state: any) => { state.characterIds[0] = 'missing'; }],
    ['unknown encounter', (state: any) => { state.encounterId = 'missing'; }],
    ['unknown unit', (state: any) => { state.units[0].definitionId = 'missing'; }],
    ['invalid HP', (state: any) => { state.units[0].hp = -1; }],
    ['invalid stats', (state: any) => { state.units[0].stats.power = 1000; }],
    ['unknown field', (state: any) => { state.extra = true; }],
    ['missing RNG stream', (state: any) => { delete state.rng.streams.LOOT; }],
    ['zero RNG state', (state: any) => { state.rng.streams.COMBAT.state = 0; }],
    ['invalid RNG counter', (state: any) => { state.rng.streams.COMBAT.counter = -1; }],
    ['unknown event target', (state: any) => { state.events[0].targetId = 'missing'; }],
    ['event sequence gap', (state: any) => { state.events[0].sequence = 999; }],
    ['impossible round', (state: any) => { state.round = 500; }],
    ['duplicate initiative actor', (state: any) => { state.turnOrder[1] = state.turnOrder[0]; }],
    ['unknown status', (state: any) => { state.units[0].statuses.push({ id: 'missing', sourceId: state.units[0].id, remaining: 2, appliedTurn: 0 }); }],
    ['fake terminal state', (state: any) => { state.status = 'victory'; }],
  ])('rejects %s', (_label, corrupt) => {
    const content = contentFixture();
    const state = stepCombat(createCombat(options, content), content);
    corrupt(state);
    expect(() => deserializeSnapshot(JSON.stringify(state), content)).toThrow();
  });

  it('rejects malformed JSON and array/null roots', () => {
    for (const input of ['{', 'null', '[]', '1']) expect(() => deserializeSnapshot(input, contentFixture())).toThrow();
  });

  it('rejects stale saves after a content action changes even when stats stay identical', () => {
    const content = contentFixture();
    const snapshot = serializeSnapshot(stepCombat(createCombat(options, content), content));
    content.characters[0].basicAttack.factor = 0.5;
    expect(() => deserializeSnapshot(snapshot, content)).toThrow(/contentHash/);
  });

  it('restores terminal-trigger children and the final outcome after a lethal end effect', () => {
    const content = contentFixture();
    content.characters[0].stats.power = 1000;
    content.characters[0].effectIds = ['last-price'];
    content.effects.push({ schemaVersion: 1, id: 'last-price', name: 'Last price', description: 'Last price', trigger: 'COMBAT_ENDED', conditions: ['ownerAlive'], target: 'self', actions: [{ type: 'damage', scaling: 'power' }], priority: 1, internalCooldown: 0, tags: [] });
    const final = runCombat(createCombat(options, content), content);
    expect(final.status).toBe('draw');
    expect(final.units.every(unit => unit.hp === 0)).toBe(true);
    expect(deserializeSnapshot(serializeSnapshot(final), content)).toEqual(final);
  });

  it('hashes property order consistently without ignoring RNG or combat changes', () => {
    const state = createCombat(options, contentFixture());
    const reordered = Object.fromEntries(Object.entries(state).reverse()) as typeof state;
    expect(hashState(reordered)).toBe(hashState(state));
    const changed = structuredClone(state);
    changed.rng.streams.EVENT.counter++;
    expect(hashState(changed)).not.toBe(hashState(state));
  });
});
