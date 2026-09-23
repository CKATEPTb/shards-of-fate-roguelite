import { describe, expect, it } from 'vitest';
import { gameContent } from '@shards/game-data';
import { coopView, createCoopState, damageBody, deserializeCoop, isBodyAlive, serializeCoop } from '@shards/game-core';
import { SEASON_BOSS_ORDER, type GameContent, type SkillDefinition, type StatusDefinition } from '@shards/shared';
import { finishCoopBattle } from '../packages/game-core/src/coop/battles';
import { summonSeasonBoss } from '../packages/game-core/src/coop/bosses';
import { simulateCampaign } from '../tools/balance-simulator/src/campaign';

function fourBossEnding(heroIds: string[], fallen: string[]) {
  let state = createCoopState('final-boss-completion', heroIds, gameContent);
  state = { ...state, actors: state.actors.map(actor => ({ ...actor, position: { ...state.actors[0].position } })) };
  for (const season of SEASON_BOSS_ORDER) {
    state = summonSeasonBoss({ ...state, tick: state.bosses!.nextAtTick! }, gameContent);
    const battle = state.battles.find(battle => battle.mobIds.includes(`season-boss:${season}`))!;
    if (!battle) throw new Error('Seasonal boss did not engage the grouped party');
    const units = battle.combat.units.map(unit => unit.team === 'enemies' ? { ...unit, hp: 0 }
      : season === 'winter' && fallen.includes(unit.definitionId)
        ? { ...unit, hp: 0, body: damageBody(unit.body!, 'torso', 1_000_000).body } : unit);
    const status = units.some(unit => unit.team === 'heroes' && unit.hp > 0) ? 'victory' as const : 'draw' as const;
    state = { ...state, battles: state.battles.map(candidate => candidate.id === battle.id
      ? { ...candidate, combat: { ...candidate.combat, units, status } } : candidate) };
    state = finishCoopBattle(state, battle.id, gameContent);
  }
  return state;
}

describe('final boss completion requires a surviving party member', () => {
  it('retains four boss kills but records defeat after the last hero dies in the final draw', () => {
    const state = fourBossEnding(['guardian'], ['guardian']);
    expect(SEASON_BOSS_ORDER.every(season => state.killedEnemyIds.includes(`season-boss:${season}`))).toBe(true);
    expect(state.bosses!.spawned).toHaveLength(4);
    expect(state.failed).toBe(true);
    expect(state.completed).toBe(false);
    expect(isBodyAlive(state.actors[0].body!)).toBe(false);
    expect(state.progression!.heroes.guardian.claimedSources.filter(source => source.startsWith('battle:'))).toHaveLength(3);
  });

  it('shares a living teammate’s victory with a dead local spectator', () => {
    const state = fourBossEnding(['guardian', 'priest'], ['guardian']);
    const view = coopView(state, 'guardian', gameContent);
    expect(isBodyAlive(view.world.actors.find(actor => actor.id === 'guardian')!.body!)).toBe(false);
    expect(view.failed).toBe(false);
    expect(view.completed).toBe(true);
    expect(deserializeCoop(serializeCoop(state), gameContent).completed).toBe(true);
  });

  it('normalizes old dual-outcome saves without changing casualties or boss history', () => {
    const ended = fourBossEnding(['guardian'], ['guardian']);
    const restored = deserializeCoop(serializeCoop({ ...ended, completed: true }), gameContent);
    expect(restored.failed).toBe(true);
    expect(restored.completed).toBe(false);
    expect(restored.actors).toEqual(ended.actors);
    expect(restored.bosses).toEqual(ended.bosses);
    expect(restored.killedEnemyIds).toEqual(ended.killedEnemyIds);
  });

  it('continues rejecting a forged defeat flag for a living party', () => {
    const state = createCoopState('invalid-final-flags', ['guardian'], gameContent);
    expect(() => deserializeCoop(serializeCoop({ ...state, completed: true, failed: true }), gameContent)).toThrow('Invalid co-op defeat state');
  });

  it('reports campaign defeat when the winter boss and last hero die in the same turn', () => {
    const curse: StatusDefinition = { schemaVersion: 1, id: 'balance-final-curse', name: 'Final curse', description: '', color: '#fff',
      trigger: 'TURN_ENDED', stacking: 'refresh', modifiers: {}, tags: ['DOT'],
      actions: [{ type: 'damage', damagePerStack: 1_000_000, bypassArmor: true, target: 'self' }] };
    const skill: SkillDefinition = { schemaVersion: 1, id: 'balance-final-curse-skill', name: 'Final curse', description: '', cooldown: 100,
      priority: 100, condition: 'always', target: 'allEnemies', tags: [], actions: [{ type: 'status', statusId: curse.id, duration: 2 }] };
    const content: GameContent = Object.freeze({ ...gameContent, skills: [...gameContent.skills, skill], statuses: [...gameContent.statuses, curse],
      enemies: gameContent.enemies.map(enemy => ({ ...enemy, stats: { ...enemy.stats, maxHp: 1, power: 0, armor: 0, evasion: 0, initiative: 1000 },
        modifiers: {}, effectIds: [], skillIds: enemy.tags.includes('SEASON_WINTER') ? [skill.id] : [], basicAttack: { type: 'damage' as const, dice: '1d1' } })) });
    const result = simulateCampaign(content, { seed: 'balance-final-dot', characterIds: ['guardian'], difficultyId: 'normal', mode: 'starter',
      encounterIntervalMinutes: 1000, chestsPerStage: 0, campfireEveryBattles: 0, maxMinutes: 90,
      policy: state => ({ type: 'attack', actorId: state.pendingActorId!, targetId: state.units.find(unit => unit.team === 'enemies' && unit.hp > 0)!.id }) });
    expect(result.battles.at(-1)?.status).toBe('draw');
    expect(result.bossesDefeated).toBe(4);
    expect(result.endingGear.every(hero => !hero.alive)).toBe(true);
    expect(result.status).toBe('defeat');
  }, 20_000);
});
