import { describe, expect, it } from 'vitest';
import {
  createCombat, createExpedition, createExploration, deserializeExpedition, deserializeExploration,
  generateChunk, leaveEncounter, requestMove, runCombat, serializeExpedition, serializeExploration,
} from '@shards/game-core';
import { gameContent } from '@shards/game-data';

const seed = 'HOUSE-SAVE-COMPATIBILITY';
const characterIds = ['guardian', 'priest', 'mage'];

describe('settlement layout save compatibility', () => {
  it('loads unversioned saves with their original geometry and in-flight routes', () => {
    const initial = createExploration({ seed, characterIds, structureVersion: 1 });
    const walking = requestMove(initial, characterIds[0], initial.chunk.exits[0].position).state;
    expect(walking.actors[0].path.length).toBeGreaterThan(0);
    const oldSave = JSON.parse(serializeExploration(walking));
    delete oldSave.structureVersion;
    const restored = deserializeExploration(JSON.stringify(oldSave));
    expect(restored).toEqual(walking);
    expect(JSON.parse(serializeExploration(restored)).structureVersion).toBe(1);
    const neighbor = initial.chunk.exits[0].targetNodeId;
    expect(generateChunk(restored.graph, neighbor)).toEqual(generateChunk(initial.graph, neighbor));
  });

  it('records the legacy layout when saving a world already running before the update', () => {
    const live = createExploration({ seed, characterIds, structureVersion: 1 });
    delete live.graph.structureVersion;
    const snapshot = serializeExploration(live);
    expect(JSON.parse(snapshot).structureVersion).toBe(1);
    expect(deserializeExploration(snapshot).chunk).toEqual(live.chunk);
  });

  it.each([1, 2] as const)('keeps layout version %i across expedition saves and defeat', structureVersion => {
    const expedition = createExpedition(seed, characterIds, gameContent);
    expedition.world = createExploration({ seed, characterIds, structureVersion,
      movementSpeeds: Object.fromEntries(gameContent.characters.map(character => [character.id, character.movementSpeed ?? 100])) });
    const restored = deserializeExpedition(serializeExpedition(expedition, gameContent), gameContent);
    // Legacy exploration actors gain anatomy, without changing geometry or routes.
    expect(restored.world.chunk).toEqual(expedition.world.chunk);
    expect(restored.world.graph).toEqual(expedition.world.graph);
    expect(restored.world.actors.map(({ body: _body, ...actor }) => actor)).toEqual(expedition.world.actors);
    const defeat = runCombat(createCombat({ seed: 'defeat', characterIds: ['mage'], encounterId: 'warden_grove' }, gameContent), gameContent);
    expect(defeat.status).toBe('defeat');
    const respawned = leaveEncounter({ ...restored, combat: defeat });
    expect(respawned.failed).toBe(true);
    expect(respawned.world.graph.structureVersion).toBe(structureVersion);
    expect(respawned.world.chunk).toEqual(expedition.world.chunk);
    if (structureVersion === 1) {
      delete restored.world.graph.structureVersion;
      expect(leaveEncounter({ ...restored, combat: defeat }).world.chunk).toEqual(expedition.world.chunk);
    }
  });

  it('uses varied settlements in new worlds and rejects unknown layout versions', () => {
    const state = createExploration({ seed, characterIds });
    expect(state.graph.structureVersion).toBe(2);
    expect(deserializeExploration(serializeExploration(state))).toEqual(state);
    const snapshot = JSON.parse(serializeExploration(state));
    for (const structureVersion of [null, 0, 3, '2', {}, true]) {
      expect(() => deserializeExploration(JSON.stringify({ ...snapshot, structureVersion }))).toThrow('Unsupported structure generator version');
    }
    expect(() => deserializeExploration(JSON.stringify({ ...snapshot, extra: 2 }))).toThrow('Invalid exploration save fields');
  });
});
