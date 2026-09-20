import { describe, expect, it } from 'vitest';
import { generateChunk, generateWorld } from '@shards/game-core';
import { houseVisibility } from '../apps/client/src/world/house-visibility';
import { RoamingVisibility, victoryChanceColor } from '../apps/client/src/world/roaming-visibility';

const graph = generateWorld('FIRST-CAMPFIRE');
const chunk = generateChunk(graph, graph.startId);
const house = houseVisibility(chunk.structures.find(structure => structure.kind === 'house')!);
const inside = { x: house.interior.x + 16, y: house.interior.y + 16 };
const body = { x: inside.x, y: inside.y - 16 };
const entrance = house.entrances[0];
const doorway = { x: entrance.x + 16, y: entrance.y + 16 };

describe('roaming enemy house privacy', () => {
  it('does not expose or inspect an enemy inside a house while all heroes remain outside', () => {
    const visibility = new RoamingVisibility(chunk);
    visibility.updateHeroes([{ x: house.interior.x - 48, y: house.interior.y + 16 }]);
    expect(visibility.hidesInterior(inside)).toBe(true);
    expect(visibility.coversPoint(body, inside)).toBe(true);
    // Standing alongside the wall cannot grant vision through the roof either.
    visibility.updateHeroes([{ x: house.interior.x - 1, y: house.interior.y + 16 }]);
    expect(visibility.hidesInterior(inside)).toBe(true);
  });

  it('makes mobs inspectable as soon as a hero enters the real doorway, and closes again on leaving', () => {
    const visibility = new RoamingVisibility(chunk);
    visibility.updateHeroes([doorway]);
    expect(visibility.hidesInterior(inside)).toBe(false);
    expect(visibility.coversPoint(body, inside)).toBe(false);
    visibility.updateHeroes([inside]);
    expect(visibility.hidesInterior(inside)).toBe(false);
    visibility.updateHeroes([]);
    expect(visibility.hidesInterior(inside)).toBe(true);
    expect(visibility.coversPoint(body, inside)).toBe(true);
  });

  it('blocks only painted roof pixels in front of outdoor mobs', () => {
    const visibility = new RoamingVisibility(chunk);
    const roof = house.roofSilhouettes[0];
    const feet = { x: roof.x + roof.width / 2, y: house.interior.y - 48 };
    expect(visibility.hidesInterior(feet)).toBe(false);
    expect(visibility.coversPoint({ x: roof.x + 1, y: roof.y + 1 }, feet)).toBe(true);
    expect(visibility.coversPoint({ x: roof.x - 1, y: roof.y + 1 }, feet)).toBe(false);
    expect(visibility.coversPoint({ x: roof.x + 1, y: roof.y + 1 }, { ...feet, y: house.roofBase.y + 1 })).toBe(false);
  });
});

describe('victory percentage colors', () => {
  it('uses strong red at zero, amber in the middle and green at certainty', () => {
    expect(victoryChanceColor(0)).toBe('#f35a5a');
    expect(victoryChanceColor(50)).toBe('#edc165');
    expect(victoryChanceColor(100)).toBe('#6fdf84');
    expect(victoryChanceColor(25)).not.toBe(victoryChanceColor(75));
    expect(victoryChanceColor(-1)).toBe(victoryChanceColor(0));
    expect(victoryChanceColor(101)).toBe(victoryChanceColor(100));
  });
});
