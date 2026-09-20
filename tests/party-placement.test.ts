import { describe, expect, it } from 'vitest';
import {
  createExploration, deserializeExploration, requestMove, serializeExploration, stepExploration,
} from '@shards/game-core';
import type { ExplorationState } from '@shards/shared';
import { DELTAS, isWalkable, neighbors, samePoint } from '../packages/game-core/src/world/grid';

const party = ['guardian', 'priest', 'mage', 'assassin'];

function transition(state: ExplorationState, exit = state.chunk.exits[0]): ExplorationState {
  const delta = DELTAS[exit.direction];
  const approaching = {
    ...state,
    actors: state.actors.map((actor, index) => ({
      ...actor,
      ...(index === 0 ? { position: { x: exit.position.x - delta.x, y: exit.position.y - delta.y }, path: [exit.position] } : {}),
      movement: { ...actor.movement!, bonusPercent: index * 7, elapsedMs: 40 },
    })),
  };
  return stepExploration(approaching, 280);
}

describe('party placement', () => {
  it.each([1, 2, 3, 4])('spawns %i heroes north, west, east and south of solid campfires across seeds', count => {
    for (const seed of ['FIRST-CAMPFIRE', 'CAMP-FOUR-A', 'CAMP-FOUR-B', 'CAMP-FOUR-C']) {
      const ids = party.slice(0, count);
      const state = createExploration({ seed, characterIds: ids });
      const fire = state.chunk.pois.find(poi => poi.kind === 'campfire')!.position;
      const expected = [DELTAS.north, DELTAS.west, DELTAS.east, DELTAS.south]
        .slice(0, count).map(delta => ({ x: fire.x + delta.x, y: fire.y + delta.y }));
      expect(state.actors.map(actor => actor.id)).toEqual(ids);
      expect(state.actors.map(actor => actor.position)).toEqual(expected);
      expect(isWalkable(state.chunk, fire)).toBe(false);
      for (const actor of state.actors) {
        expect(isWalkable(state.chunk, actor.position)).toBe(true);
        expect(actor.path).toEqual([]);
        expect(actor.movement?.elapsedMs).toBe(0);
      }
    }
  });

  it('shares the exact inward tile of every reciprocal entrance without losing speed bonuses', () => {
    const state = createExploration({ seed: 'PARTY-GATES', characterIds: party, movementSpeeds: { guardian: 100, priest: 103, mage: 105, assassin: 110 } });
    for (const exit of state.chunk.exits) {
      const arrived = transition(state, exit);
      expect(arrived.currentChunkId).toBe(exit.targetNodeId);
      const reciprocal = arrived.chunk.exits.find(gate => gate.id === exit.returnGateId)!;
      const delta = DELTAS[exit.direction];
      const expected = { x: reciprocal.position.x + delta.x, y: reciprocal.position.y + delta.y };
      expect(isWalkable(arrived.chunk, expected)).toBe(true);
      expect(arrived.actors.map(actor => actor.position)).toEqual(party.map(() => expected));
      expect(arrived.actors[0].position).not.toBe(arrived.actors[1].position);
      expect(arrived.actors.map(actor => actor.movement)).toEqual([100, 103, 105, 110]
        .map((baseSpeed, index) => ({ baseSpeed, bonusPercent: index * 7, elapsedMs: 0 })));
      expect(arrived.actors.every(actor => !actor.path.length)).toBe(true);
      expect(stepExploration(arrived)).toBe(arrived);
    }
  });

  it('lets one hero leave and rejoin overlapping allies without moving them', () => {
    const arrived = transition(createExploration({ seed: 'FIRST-CAMPFIRE', characterIds: party }));
    const origin = arrived.actors[0].position;
    const target = neighbors(origin, arrived.chunk.size).find(point => isWalkable(arrived.chunk, point)
      && !arrived.chunk.exits.some(exit => samePoint(exit.position, point)))!;
    const leaving = requestMove(arrived, 'guardian', target);
    expect(leaving.accepted).toBe(true);
    const moved = stepExploration(leaving.state, 1000);
    expect(moved.actors[0].position).toEqual(target);
    expect(moved.actors.slice(1)).toEqual(arrived.actors.slice(1));
    const returning = requestMove(moved, 'guardian', origin);
    expect(returning.accepted).toBe(true);
    const reunited = stepExploration(returning.state, 1000);
    expect(reunited.actors.map(actor => actor.position)).toEqual(party.map(() => origin));
  });

  it('preserves overlapping arrivals and earlier saved positions on load', () => {
    const start = createExploration({ seed: 'FIRST-CAMPFIRE', characterIds: party });
    const arrived = transition(start);
    expect(deserializeExploration(serializeExploration(arrived))).toEqual(arrived);
    const previous = { ...start, actors: start.actors.map((actor, index) => ({
      ...actor, position: [{ x: 17, y: 18 }, { x: 18, y: 18 }, { x: 17, y: 19 }, { x: 16, y: 18 }][index],
    })) };
    expect(deserializeExploration(serializeExploration(previous))).toEqual(previous);
  });
});
