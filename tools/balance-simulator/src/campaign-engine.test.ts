import { describe, expect, it } from 'vitest';
import { gameContent } from '@shards/game-data';
import { BODY_PARTS, SEASON_BOSS_ORDER, type AdventureReward, type CombatChoice, type CombatState, type CoopEvent, type CoopState, type GameContent, type SkillDefinition, type StatusDefinition } from '@shards/shared';
import { createCoopState, isTerminal } from '@shards/game-core';
import { finishCoopBattle, performCoopBattleAction, performCoopBattleStep, startCoopBattle } from '../../../packages/game-core/src/coop/battles';
import { changeLoadout, contentWithLoadouts } from '../../../packages/game-core/src/coop/progression';
import { SEASON_BOSS_INTERVAL_TICKS, seasonBossEscortPool, summonSeasonBoss } from '../../../packages/game-core/src/coop/bosses';
import { simulationPolicy } from '../../../packages/game-core/src/simulation-policy';
import { campaignBattleContent, campaignBossContent, simulateCampaign } from './campaign';
import { campaignSkillValue, optimizeCampaignInventory } from './campaign-gear';

const reward = (id: string, definitionId: string, kind: AdventureReward['kind'] = 'skill'): AdventureReward => ({
  id, definitionId, kind, rarity: kind === 'skill' ? gameContent.skills.find(skill => skill.id === definitionId)!.rarity!
    : gameContent.equipmentCatalog!.items[definitionId].rarity, source: 'campaign-test', luckRolls: [],
});

function give(state: CoopState, heroId: string, entry: AdventureReward): CoopState {
  return { ...state, progression: { ...state.progression!, heroes: { ...state.progression!.heroes,
    [heroId]: { ...state.progression!.heroes[heroId], rewards: [...state.progression!.heroes[heroId].rewards, entry] } } } };
}

function contact(state: CoopState, index: number): Extract<CoopEvent, { type: 'battle-start' }> {
  const chunkId = state.actors[0].chunkId;
  const group = state.groups[chunkId].find(group => group.members.length)!;
  return { type: 'battle-start', battleId: `equivalence:${index}`, chunkId, actorIds: [...state.characterIds],
    mobIds: group.members.map(mob => mob.id), enemyIds: group.members.map(mob => mob.definitionId),
    initiatorActorId: state.characterIds[0], initiatorMobId: group.members[0].id, diceIndex: state.diceIndex };
}

const withoutHash = ({ contentHash: _, ...combat }: CombatState) => combat;

describe('accelerated campaign engine', () => {
  it('values enemy debuffs positively and allied debuffs negatively when selecting learned skills', () => {
    const status: StatusDefinition = { schemaVersion: 1, id: 'test-debuff', name: 'debuff', description: '', color: '#fff',
      modifiers: { armorBonus: -8, powerBonus: -4 }, actions: [], tags: [] };
    const content = { ...gameContent, statuses: [status] };
    const skill: SkillDefinition = { ...gameContent.skills.find(skill => skill.rarity)!, target: 'enemy',
      actions: [{ type: 'status', statusId: status.id, duration: 3 }] };
    expect(campaignSkillValue(skill, content, 10, 2)).toBeGreaterThan(0);
    expect(campaignSkillValue({ ...skill, target: 'ally' }, content, 10, 2)).toBeLessThan(0);
  });

  it('evaluates periodic damage on the aura bearer and counts self damage as a cost', () => {
    const status: StatusDefinition = { schemaVersion: 1, id: 'test-dot', name: 'dot', description: '', color: '#fff',
      modifiers: {}, actions: [{ type: 'damage', dice: '1d6', target: 'self' }], tags: [] };
    const content = { ...gameContent, statuses: [status] };
    const skill: SkillDefinition = { ...gameContent.skills.find(skill => skill.rarity)!, target: 'enemy',
      actions: [{ type: 'status', statusId: status.id, duration: 3 }] };
    expect(campaignSkillValue(skill, content, 10, 2)).toBeGreaterThan(0);
    expect(campaignSkillValue({ ...skill, target: 'ally' }, content, 10, 2)).toBeLessThan(0);
    expect(campaignSkillValue({ ...skill, target: 'self', actions: [{ type: 'damage', dice: '1d6' }] }, content, 10, 2)).toBeLessThan(0);
  });

  it('chooses one relation for hybrid skills instead of adding mutually exclusive effects', () => {
    const base = gameContent.skills.find(skill => skill.rarity)!;
    const skill: SkillDefinition = { ...base, target: 'any', actions: [
      { type: 'damage', dice: '2d6', targetRelation: 'enemy' }, { type: 'heal', dice: '2d6', targetRelation: 'ally' },
    ] };
    const damage = campaignSkillValue({ ...skill, actions: skill.actions.slice(0, 1) }, gameContent, 10, 2);
    const heal = campaignSkillValue({ ...skill, actions: skill.actions.slice(1) }, gameContent, 10, 2);
    expect(campaignSkillValue(skill, gameContent, 10, 2)).toBe(Math.max(damage, heal));
  });

  it.each(['normal', 'hard', 'nightmare'] as const)('preserves boss pool, summons, roster and initial combat on %s', difficultyId => {
    let state = createCoopState(`campaign-boss-projection:${difficultyId}`, ['guardian', 'mage', 'druid', 'rogue'], gameContent, difficultyId);
    const entry = reward('boss-learned', 'crimson_tide');
    state = give(state, 'mage', entry);
    state = changeLoadout(state, 'mage', { type: 'collect-reward', rewardId: entry.id }, gameContent);
    state = changeLoadout(state, 'mage', { type: 'equip-inventory', inventoryId: entry.id, slot: 'skill0' }, gameContent);
    state = { ...state, tick: SEASON_BOSS_INTERVAL_TICKS, diceCounters: { 'hero:mage': 71, 'hero:rogue': 137 } };
    const rules = campaignBossContent(gameContent, state);
    expect(rules.equipmentCatalog).toBeUndefined();
    const escortIds = new Set(SEASON_BOSS_ORDER.flatMap(season => seasonBossEscortPool(gameContent, season).map(enemy => enemy.id)));
    expect(rules.enemies.map(enemy => enemy.id)).toEqual(gameContent.enemies
      .filter(enemy => enemy.tags.includes('BOSS') || escortIds.has(enemy.id)).map(enemy => enemy.id));
    const full = summonSeasonBoss(state, gameContent), compact = summonSeasonBoss(state, rules);
    expect(full.battles).toHaveLength(1);
    expect(compact.battles).toHaveLength(1);
    expect(withoutHash(compact.battles[0].combat)).toEqual(withoutHash(full.battles[0].combat));
    expect({ ...compact, battles: [] }).toEqual({ ...full, battles: [] });
    const fullStep = performCoopBattleStep(full, full.battles[0].id, 0, gameContent).state;
    const compactStep = performCoopBattleStep(compact, compact.battles[0].id, 0, rules).state;
    expect(withoutHash(compactStep.battles[0].combat)).toEqual(withoutHash(fullStep.battles[0].combat));
    expect(compactStep.diceCounters).toEqual(fullStep.diceCounters);
  });

  it('matches full coop combat with learned skills, passive effects, set bonuses and persistent hero dice', () => {
    const content: GameContent = Object.freeze({ ...gameContent,
      enemies: gameContent.enemies.map(enemy => ({ ...enemy, stats: { ...enemy.stats, maxHp: 180, power: 1 }, skillIds: [], effectIds: [], modifiers: {} })),
    });
    let full = createCoopState('campaign-equivalence-v1', ['mage', 'paladin'], content);
    for (const [heroId, skill] of [['mage', 'crimson_tide'], ['paladin', 'lantern_procession']]) {
      const entry = reward(`learn:${heroId}`, skill);
      full = give(full, heroId, entry);
      full = changeLoadout(full, heroId, { type: 'collect-reward', rewardId: entry.id }, content);
      full = changeLoadout(full, heroId, { type: 'equip-inventory', inventoryId: entry.id, slot: 'skill0' }, content);
    }
    for (const slot of ['head', 'chest', 'gloves'] as const) {
      const entry = reward(`gear:${slot}`, `relic-battle-crown-${slot}`, 'equipment');
      full = give(full, 'mage', entry);
      full = changeLoadout(full, 'mage', { type: 'collect-reward', rewardId: entry.id }, content);
      full = changeLoadout(full, 'mage', { type: 'equip-inventory', inventoryId: entry.id, slot }, content);
    }
    full = { ...full, actors: full.actors.map(actor => ({ ...actor, body: Object.fromEntries(BODY_PARTS.map(part =>
      [part, { ...actor.body![part], current: Math.floor(actor.body![part].current * .75) }])) as typeof actor.body })) };
    let compact = structuredClone(full);
    const used = new Set<string>();
    for (let fight = 0; fight < 2; fight++) {
      const event = contact(full, fight), beforeCounters = { ...full.diceCounters };
      full = startCoopBattle(full, event, content);
      const projected = campaignBattleContent(content, compact, full.battles[0]);
      expect(projected.equipmentCatalog).toBeUndefined();
      expect(projected.characters.find(hero => hero.id === 'mage')!.effectIds).toContain('mage_ember_spark');
      expect(projected.characters.find(hero => hero.id === 'mage')!.anatomy!.setBonuses!.length).toBeGreaterThan(0);
      compact = startCoopBattle(compact, event, projected);
      expect(withoutHash(compact.battles[0].combat)).toEqual(withoutHash(full.battles[0].combat));
      for (const id of full.characterIds) expect(full.battles[0].combat.rng.entityDice!.counters[`hero:${id}`]).toBe(beforeCounters[`hero:${id}`] ?? 0);
      const fullRules = contentWithLoadouts(content, full.battles[0].loadouts);
      let step = 0;
      while (!isTerminal(full.battles[0].combat) && ++step < 500) {
        const current = full.battles[0].combat;
        let choice: CombatChoice | undefined;
        if (current.pendingActorId) {
          const actor = current.units.find(unit => unit.id === current.pendingActorId)!;
          const skillId = full.progression!.heroes[actor.definitionId].skills[0]!;
          const key = `${fight}:${actor.definitionId}`;
          if (!used.has(key) && (actor.cooldowns[skillId] ?? 0) === 0) {
            used.add(key); choice = { type: 'skill', actorId: actor.id, skillId,
              targetId: actor.definitionId === 'paladin' ? actor.id : current.units.find(unit => unit.team === 'enemies' && unit.hp > 0)!.id };
          } else {
            choice = simulationPolicy(current, fullRules);
            expect(simulationPolicy(compact.battles[0].combat, projected)).toEqual(choice);
          }
        }
        full = (choice ? performCoopBattleAction(full, event.battleId, choice, content) : performCoopBattleStep(full, event.battleId, 0, content)).state;
        compact = (choice ? performCoopBattleAction(compact, event.battleId, choice, projected) : performCoopBattleStep(compact, event.battleId, 0, projected)).state;
        expect(withoutHash(compact.battles[0].combat)).toEqual(withoutHash(full.battles[0].combat));
        expect(compact.diceCounters).toEqual(full.diceCounters);
      }
      expect(step).toBeLessThan(500);
      expect(full.battles[0].combat.status).toBe('victory');
      full = finishCoopBattle(full, event.battleId, content);
      compact = finishCoopBattle(compact, event.battleId, content);
      expect(compact).toEqual(full);
      expect(full.diceCounters!['hero:mage']).toBeGreaterThan(beforeCounters['hero:mage'] ?? 0);
      expect(full.diceCounters!['hero:paladin']).toBeGreaterThan(beforeCounters['hero:paladin'] ?? 0);
    }
    expect(used.size).toBe(4);
  }, 20_000);

  it('uses four actual twenty-minute boss deadlines without waiting for wall time', () => {
    const content: GameContent = Object.freeze({ ...gameContent, enemies: gameContent.enemies.map(enemy => ({ ...enemy,
      stats: { ...enemy.stats, maxHp: 1, power: 0, armor: 0, evasion: 0, agility: 0 }, modifiers: {}, skillIds: [], effectIds: [],
      basicAttack: { type: 'damage' as const, dice: '1d1' },
    })) });
    const options = { seed: 'campaign-clock-v1', characterIds: ['guardian'], difficultyId: 'normal' as const,
      mode: 'starter' as const, encounterIntervalMinutes: 1000, chestsPerStage: 0, campfireEveryBattles: 0, maxMinutes: 90 };
    const first = simulateCampaign(content, options), repeat = simulateCampaign(content, options);
    expect(repeat).toEqual(first);
    expect(first.status).toBe('victory');
    expect(first.stages.map(stage => stage.season)).toEqual(SEASON_BOSS_ORDER);
    expect(first.stages.map(stage => stage.summonedAtMinute)).toEqual([20, 40, 60, 80]);
    expect(first.bossesDefeated).toBe(4);
    expect(first.battles).toHaveLength(4);
    expect(first.durationMinutes).toBeGreaterThan(80);
    expect(first.durationMinutes).toBeLessThan(81);
    expect(first.diagnostics.heroDiceCounters['hero:guardian']).toBeGreaterThan(0);
    expect(first.diagnostics.encountersAttempted).toBe(0);
    expect(first.diagnostics.campfiresUsed).toBe(0);
    expect(first.diagnostics.equipmentChanges).toBe(0);
  }, 20_000);

  it('stops at the requested virtual deadline and rejects invalid route inputs', () => {
    const options = { seed: 'campaign-short-v1', characterIds: ['guardian'], difficultyId: 'normal' as const };
    const result = simulateCampaign(gameContent, { ...options, maxMinutes: 1 });
    expect(result.status).toBe('timeout');
    expect(result.durationMinutes).toBe(1);
    expect(result.battles).toHaveLength(0);
    expect(result.bossesDefeated).toBe(0);
    expect(result.diagnostics.diceCount).toBe(0);
    expect(() => simulateCampaign(gameContent, { ...options, encounterIntervalMinutes: 0 })).toThrow('Invalid scripted route');
    expect(() => simulateCampaign(gameContent, { ...options, maxMinutes: NaN })).toThrow('maxMinutes');
  });

  it('starter control collects the same rewards without changing the loadout or healing injuries', () => {
    let state = createCoopState('campaign-inventory-v1', ['mage'], gameContent);
    const old = structuredClone(state.progression!.heroes.mage);
    state = give(state, 'mage', reward('held-skill', 'crimson_tide'));
    state = give(state, 'mage', reward('held-gear', 'relic-battle-crown-head', 'equipment'));
    state.actors[0].body!.leftArm = { ...state.actors[0].body!.leftArm, lost: true, current: -16 };
    state.actors[0].body!.torso.current = 12;
    const body = structuredClone(state.actors[0].body);
    const result = optimizeCampaignInventory(state, gameContent, false);
    expect(result.changes).toEqual({ collected: 2, equipped: 0, learned: 0 });
    expect(result.state.progression!.heroes.mage.equipment).toEqual(old.equipment);
    expect(result.state.progression!.heroes.mage.skills).toEqual(old.skills);
    expect(result.state.progression!.heroes.mage.inventory).toHaveLength(2);
    expect(result.state.progression!.heroes.mage.rewards).toHaveLength(0);
    expect(result.state.actors[0].body).toEqual(body);
  });
});
