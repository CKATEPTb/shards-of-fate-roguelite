import { describe, expect, it } from 'vitest';
import {
  createCombat, createExpedition, deserializeExpedition, deserializeSnapshot, moveExpedition,
  serializeExpedition, serializeSnapshot, stepCombat, stepExpedition, stepExpeditionCombat,
} from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import type { ExpeditionState } from '@shards/shared';
import { hashValue } from '../packages/game-core/src/canonical';

const party = ['guardian', 'priest', 'mage'];
const legacyContent = structuredClone(gameContent);
for (const definition of [...legacyContent.characters, ...legacyContent.enemies]) delete definition.movementSpeed;

function legacyExpedition(state: ExpeditionState): string {
  const snapshot = JSON.parse(serializeExpedition(state, legacyContent));
  const world = JSON.parse(snapshot.world);
  for (const actor of world.actors) delete actor.movement;
  snapshot.world = JSON.stringify(world);
  if (snapshot.combat) {
    const combat = JSON.parse(snapshot.combat);
    combat.contentHash = hashValue(legacyContent);
    snapshot.combat = JSON.stringify(combat);
  }
  return JSON.stringify(snapshot);
}

function encounter(): ExpeditionState {
  const initial = createExpedition('FIRST-CAMPFIRE', party, gameContent);
  // These fixtures predate roaming and exercise the original occupied-POI save format.
  delete initial.roaming;
  const poi = initial.world.chunk.pois.find(candidate => candidate.kind === 'encounter')!;
  let state = moveExpedition(initial, party[0], poi.position).state;
  for (let tick = 0; tick < 1300 && !state.combat; tick++) state = stepExpedition(state, gameContent);
  expect(state.combat).not.toBeNull();
  return state;
}

describe('movement attribute save migration', () => {
  it('restores an older expedition with the current individual base speeds', () => {
    const initial = createExpedition('FIRST-CAMPFIRE', party, gameContent);
    const restored = deserializeExpedition(legacyExpedition(initial), gameContent);
    expect(restored).toEqual(initial);
    expect(restored.world.actors.map(actor => actor.movement?.baseSpeed))
      .toEqual(party.map(id => gameContent.characters.find(unit => unit.id === id)!.movementSpeed));
    expect(restored.world.actors.every(actor => actor.movement?.bonusPercent === 0 && actor.movement.elapsedMs === 0)).toBe(true);
  });

  it.each(['ready', 'running'] as const)('restores an older %s combat without changing battle progress', status => {
    const initial = createCombat({ seed: 'movement-migration', characterIds: party, encounterId: 'mossy_path' }, legacyContent);
    const oldCombat = status === 'running' ? stepCombat(initial, legacyContent) : initial;
    const restored = deserializeSnapshot(serializeSnapshot(oldCombat), gameContent);
    expect(restored).toEqual({ ...oldCombat, contentHash: hashValue(gameContent) });
    expect(stepCombat(restored, gameContent)).toEqual({ ...stepCombat(oldCombat, legacyContent), contentHash: hashValue(gameContent) });
  });

  it.each(['ready', 'running'] as const)('restores an older expedition during a %s encounter', status => {
    const initial = encounter();
    const current = status === 'running' ? stepExpeditionCombat(initial, gameContent) : initial;
    expect(deserializeExpedition(legacyExpedition(current), gameContent)).toEqual(current);
  });

  it('preserves equipped speed bonuses and partial movement progress in current saves', () => {
    const initial = createExpedition('FIRST-CAMPFIRE', party, gameContent);
    const poi = initial.world.chunk.pois.find(candidate => candidate.kind === 'encounter')!;
    const walking = moveExpedition(initial, party[0], poi.position).state;
    walking.world.actors[0].movement = { baseSpeed: 100, bonusPercent: 25, elapsedMs: 80 };
    const encoded = serializeExpedition(walking, gameContent);
    const restored = deserializeExpedition(encoded, gameContent);
    expect(restored).toEqual(walking);
    expect(serializeExpedition(restored, gameContent)).toBe(encoded);
    expect(stepExpedition(restored, gameContent, 40)).toEqual(stepExpedition(walking, gameContent, 40));
  });

  it('fills missing class defaults without replacing an existing movement bonus', () => {
    const state = createExpedition('FIRST-CAMPFIRE', party, gameContent);
    state.world.actors[0].movement = { baseSpeed: 100, bonusPercent: 15, elapsedMs: 0 };
    const snapshot = JSON.parse(serializeExpedition(state, gameContent));
    const world = JSON.parse(snapshot.world);
    delete world.actors[1].movement;
    delete world.actors[2].movement;
    snapshot.world = JSON.stringify(world);
    const restored = deserializeExpedition(JSON.stringify(snapshot), gameContent);
    expect(restored).toEqual(state);
  });

  it('still rejects unknown hashes, changed combat content and modified combat stats', () => {
    const expedition = createExpedition('FIRST-CAMPFIRE', party, gameContent);
    const combat = createCombat({ seed: 'movement-validation', characterIds: party, encounterId: 'mossy_path' }, legacyContent);
    const changedContent = structuredClone(gameContent);
    changedContent.characters[0].stats.power += 1;
    expect(() => deserializeSnapshot(serializeSnapshot(combat), changedContent)).toThrow(/contentHash/);
    expect(() => deserializeExpedition(legacyExpedition(expedition), changedContent)).toThrow(/contentHash/);
    expect(() => deserializeSnapshot(serializeSnapshot({ ...combat, contentHash: 'unknown' }), gameContent)).toThrow(/contentHash/);
    const unknown = JSON.parse(legacyExpedition(expedition));
    unknown.contentHash = 'unknown';
    expect(() => deserializeExpedition(JSON.stringify(unknown), gameContent)).toThrow(/contentHash/);
    const damagedReady = { ...combat, units: combat.units.map((unit, index) => index ? unit : { ...unit, hp: unit.hp - 1 }) };
    expect(() => deserializeSnapshot(serializeSnapshot(damagedReady), gameContent)).toThrow(/units\[0\]\.hp/);
    combat.units[0].stats.power += 1;
    expect(() => deserializeSnapshot(serializeSnapshot(combat), gameContent)).toThrow(/stats/);
  });
});
