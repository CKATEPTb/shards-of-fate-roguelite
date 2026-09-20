import { describe, expect, it } from 'vitest';
import { gameContent } from '@shards/game-data';
import { BODY_PARTS, type ExpeditionState } from '@shards/shared';
import { approachCampfire, campfireAvailability, createCombat, createExpedition, deserializeExpedition, effectiveMovementSpeed,
  estimateVictoryChance, findPath, isBodyAlive, leaveEncounter, moveExpedition, partyBodies, restAtCampfire,
  serializeExpedition, startHeroBody, stepExpedition, withMovementBonus } from '@shards/game-core';
import { beginRoamingBattle } from '../packages/game-core/src/expedition/roaming';
import { DELTAS } from '../packages/game-core/src/world/grid';
import { advanceActor } from '../packages/game-core/src/world/movement';

const ids = ['guardian', 'priest', 'mage'];
const create = () => createExpedition('FIRST-CAMPFIRE', ids, gameContent);
const fireId = (state: ExpeditionState) => state.world.chunk.pois.find(poi => poi.kind === 'campfire')!.id;
const restore = (state: ExpeditionState) => deserializeExpedition(serializeExpedition(state, gameContent), gameContent);

describe('persistent anatomy and campfire recovery', () => {
  it('carries exact battle wounds through leaving, saving, and the next encounter', () => {
    const state = create();
    const combat = createCombat({ seed: 'wounds', characterIds: ids, encounterId: 'roaming', enemyIds: ['rat'] }, gameContent);
    const hero = combat.units[0];
    hero.body!.leftLeg.current = 0; hero.body!.torso.current -= 13;
    combat.status = 'victory';
    const wounded = leaveEncounter({ ...state, combat });
    expect(wounded.world.actors[0].body).toEqual(hero.body);
    const saved = restore(wounded);
    expect(saved.world.actors[0].body).toEqual(hero.body);
    const group = saved.roaming!.chunks[saved.world.currentChunkId][0];
    const next = beginRoamingBattle(saved, { groupIds: [group.id], mobId: group.members[0].id, actorId: ids[0], enemyIds: group.members.map(mob => mob.definitionId) }, gameContent);
    expect(next.combat!.units[0].body).toEqual(hero.body);
    next.combat!.units[0].body!.torso.current--;
    expect(saved.world.actors[0].body!.torso.current).toBe(hero.body!.torso.current);
  });

  it('requires arrival next to a solid fire, then heals living allies without regrowth', () => {
    let state = create();
    state.roaming!.chunks[state.world.currentChunkId] = [];
    const fire = state.world.chunk.pois.find(poi => poi.kind === 'campfire')!;
    const actor = state.world.actors[0];
    actor.position = { x: 17, y: 15 };
    actor.body!.leftLeg.current = 0; actor.body!.torso.current = 10;
    state.world.actors[1].body!.head.current = 5;
    state.world.actors[2].body!.head.current = 0;
    expect(moveExpedition(state, ids[0], fire.position).accepted).toBe(false);
    expect(restAtCampfire(state, ids[0], fire.id)).toBe(state);
    const command = approachCampfire(state, ids[0], fire.id);
    expect(command.accepted).toBe(true); state = command.state;
    expect(state.world.actors[0].path).not.toContainEqual(fire.position);
    for (let tick = 0; tick < 100 && state.world.actors[0].path.length; tick++) state = stepExpedition(state, gameContent, 40);
    expect(campfireAvailability(state, ids[0], fire.id)?.canRest).toBe(true);
    const rested = restAtCampfire(state, ids[0], fire.id);
    expect(rested.world.actors[0].body!.torso.current).toBe(rested.world.actors[0].body!.torso.max);
    expect(rested.world.actors[0].body!.leftLeg.current).toBe(0);
    expect(rested.world.actors[1].body!.head.current).toBe(rested.world.actors[1].body!.head.max);
    expect(rested.world.actors[2].body).toEqual(state.world.actors[2].body);
    expect(restore(rested)).toEqual(rested);
  });

  it('refuses rest during pursuit or combat and never resurrects a lost expedition', () => {
    const state = create(); const id = fireId(state);
    state.roaming!.chunks[state.world.currentChunkId][0].mode = 'chase';
    expect(campfireAvailability(state, ids[0], id)?.canRest).toBe(false);
    expect(restAtCampfire(state, ids[0], id)).toBe(state);
    state.roaming!.chunks[state.world.currentChunkId][0].mode = 'patrol';
    const combat = createCombat({ seed: 'lost', characterIds: ids, encounterId: 'roaming', enemyIds: ['rat'] }, gameContent);
    for (const hero of combat.units.filter(unit => unit.team === 'heroes')) { hero.body!.head.current = 0; hero.hp = 0; }
    expect(restAtCampfire({ ...state, combat }, ids[0], id).combat).toBe(combat);
    combat.status = 'defeat';
    const lost = leaveEncounter({ ...state, combat });
    expect(lost.failed).toBe(true);
    expect(lost.world.actors.every(actor => !isBodyAlive(actor.body!))).toBe(true);
    expect(lost.world.actors.map(actor => actor.position)).toEqual(state.world.actors.map(actor => actor.position));
    expect(stepExpedition(lost, gameContent)).toBe(lost);
    expect(restAtCampfire(lost, ids[0], id)).toBe(lost);
    expect(restore(lost)).toEqual(lost);
  });

  it('preserves wounds and amputations across a joint chunk transition', () => {
    let state = create(); state.roaming!.chunks[state.world.currentChunkId] = [];
    const exit = state.world.chunk.exits[0]; const delta = DELTAS[exit.direction];
    const actor = state.world.actors[0];
    actor.position = { x: exit.position.x - delta.x, y: exit.position.y - delta.y };
    actor.body!.leftArm.current = 0; actor.body!.rightLeg.current -= 10;
    const bodies = structuredClone(partyBodies(state.world.actors));
    state = moveExpedition(state, ids[0], exit.position).state;
    for (let tick = 0; tick < 50 && state.world.currentChunkId === '0,0'; tick++) state = stepExpedition(state, gameContent, 40);
    expect(state.world.currentChunkId).toBe(exit.targetNodeId);
    expect(partyBodies(state.world.actors)).toEqual(bodies);
    expect(restore(state)).toEqual(state);
  });

  it('migrates pre-anatomy worlds once and rejects edited part capacity', () => {
    const state = create(); const json = JSON.parse(serializeExpedition(state, gameContent));
    const world = JSON.parse(json.world);
    world.actors.forEach((actor: { body?: unknown }) => { delete actor.body; });
    json.world = JSON.stringify(world);
    const migrated = deserializeExpedition(JSON.stringify(json), gameContent);
    expect(migrated.world.actors[0].body).toEqual(startHeroBody(gameContent.characters[0]));
    migrated.world.actors[0].body!.head.max++;
    expect(() => restore(migrated)).toThrow();
  });
});

describe('wounded travel and forecast', () => {
  it('saves the boots share separately from other speed bonuses and does not create dead movement clocks', () => {
    const state = create(); const actor = state.world.actors[0];
    actor.body!.leftLeg.current = 0; actor.body!.rightLeg.current = 0;
    state.world.actors[0] = withMovementBonus(actor, 100, undefined, 60);
    const loaded = restore(state).world.actors[0];
    expect(loaded.movement?.bootsBonusPercent).toBe(60);
    expect(effectiveMovementSpeed(loaded)).toBeCloseTo(14);
    loaded.body!.head.current = 0;
    expect(withMovementBonus(loaded, 120).movement?.elapsedMs).toBe(0);
  });

  it('uses both leg fractions, slows one-legged walking, and crawls without equipment speed bonuses', () => {
    const actor = create().world.actors[0]; const body = actor.body!;
    body.leftLeg.current = body.leftLeg.max * 0.8;
    expect(effectiveMovementSpeed(actor)).toBeCloseTo(90);
    body.leftLeg.current = 0;
    expect(effectiveMovementSpeed(actor)).toBe(50);
    body.rightLeg.current = 0; actor.movement!.bonusPercent = 100; actor.movement!.bootsBonusPercent = 100;
    expect(effectiveMovementSpeed(actor)).toBe(10);
    actor.movement!.bonusPercent = 150;
    expect(effectiveMovementSpeed(actor)).toBe(15);
    body.leftArm.current = 0; body.rightArm.current = 0;
    expect(effectiveMovementSpeed(actor)).toBe(0);
  });

  it('advances a wounded walker at the same timing used by rendering and never moves a dead hero', () => {
    const state = create(); const actor = state.world.actors[0];
    actor.body!.leftLeg.current = 0;
    actor.path = findPath(state.world.chunk, actor.position, { x: 17, y: 15 });
    expect(actor.path).toHaveLength(1);
    const midway = advanceActor(actor, state.world.chunk, 280);
    expect(midway.position).toEqual(actor.position);
    expect(advanceActor(midway, state.world.chunk, 280).position).toEqual(actor.path[0]);
    actor.body!.head.current = 0;
    const stopped = advanceActor(actor, state.world.chunk, 10_000);
    expect(stopped.position).toEqual(actor.position); expect(stopped.path).toEqual([]);
  });

  it('simulates current injuries without mutating them or recreating dead heroes', () => {
    const actor = create().world.actors[0];
    for (const part of BODY_PARTS) actor.body![part].current = 0;
    const bodies = partyBodies([actor]); const before = structuredClone(bodies);
    expect(estimateVictoryChance({ seed: 'wounded-forecast', characterIds: [ids[0]], heroBodies: bodies,
      encounterId: 'roaming', enemyIds: ['rat'] }, gameContent, 8).percent).toBe(0);
    expect(bodies).toEqual(before);
  });
});
