import { BODY_PARTS, SEASON_BOSS_ORDER, type BodyPart, type CombatState, type CoopBattle, type CoopState, type DifficultyId, type GameContent, type GridPoint, type HeroLoadout, type RewardRarity, type Season } from '@shards/shared';
import { activeEquipmentSetBonuses, bodyMovementMultiplier, commandCoop, createCoopState, hashValue, isBodyAlive, isTerminal, type CombatDecisionPolicy } from '@shards/game-core';
import { finishCoopBattle, performCoopBattleAction, performCoopBattleStep, startCoopBattle } from '../../../packages/game-core/src/coop/battles';
import { engageSeasonBosses, isSeasonBossDefeated, seasonBossEscortPool, summonSeasonBoss } from '../../../packages/game-core/src/coop/bosses';
import { advanceCampfireHealing, CAMPFIRE_HEAL_TICKS, discoverCampfires } from '../../../packages/game-core/src/coop/campfire-runtime';
import { equippedHero } from '../../../packages/game-core/src/coop/progression';
import { coopChunk, coopGraph, ensureCoopChunk } from '../../../packages/game-core/src/coop/world';
import { hashString } from '../../../packages/game-core/src/random';
import { simulationPolicy } from '../../../packages/game-core/src/simulation-policy';
import { MOVEMENT_TICK_MS } from '../../../packages/game-core/src/world/movement-speed';
import { campaignGearScore, optimizeCampaignInventory } from './campaign-gear';

const TICKS_PER_MINUTE = 60_000 / MOVEMENT_TICK_MS;

export interface CampaignOptions {
  seed: string;
  characterIds: string[];
  difficultyId: DifficultyId;
  mode?: 'progression' | 'starter';
  maxMinutes?: number;
  /** Minimum interval between scripted route arrivals; fights can postpone an arrival. */
  encounterIntervalMinutes?: number;
  /** Maximum distinct generated chests visited in each twenty-minute stage. */
  chestsPerStage?: number;
  /** Attempt recovery after this many battles, only at a generated, unexpired campfire. */
  campfireEveryBattles?: number;
  /** Route policy avoids epic/miniboss groups when a normal group is available. */
  preferNormalGroups?: boolean;
  policy?: CombatDecisionPolicy;
}

export interface CampaignBattle {
  index: number;
  kind: 'roaming' | 'boss';
  season?: Season;
  chunkId: string;
  enemyIds: string[];
  party: string[];
  status: CombatState['status'];
  rounds: number;
  turns: number;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
  damageTaken: number;
  healing: number;
  heroDeaths: string[];
  lostLimbs: Record<string, BodyPart[]>;
  gearScore: number;
}

export interface CampaignStage {
  season: Season;
  enemyId?: string;
  summonedAtMinute?: number;
  defeated: boolean;
  defeatedAtMinute?: number;
  livingHeroes: number;
  gearScore: number;
}

export interface CampaignHeroGear extends HeroLoadout {
  heroId: string;
  alive: boolean;
  healthFraction: number;
  lostParts: BodyPart[];
  gearScore: number;
  inventoryCount: number;
  coins: number;
  rarities: Record<RewardRarity, number>;
  activeSetBonuses: number;
}

export interface CampaignResult {
  seed: string;
  difficultyId: DifficultyId;
  characterIds: string[];
  mode: 'progression' | 'starter';
  status: 'victory' | 'defeat' | 'timeout' | 'escaped' | 'error';
  bossesDefeated: number;
  battles: CampaignBattle[];
  rounds: number;
  durationMinutes: number;
  stages: CampaignStage[];
  endingGear: CampaignHeroGear[];
  diagnostics: {
    model: 'scripted-route-v1';
    assumptions: string[];
    encountersAttempted: number;
    chestsOpened: number;
    campfiresUsed: number;
    rewardsCollected: number;
    equipmentChanges: number;
    skillsLearned: number;
    diceCount: number;
    heroDiceCounters: Record<string, number>;
    routeChunks: string[];
    error?: string;
  };
}

/** Keep actual definitions/rules while avoiding the entire item catalogue in every combat hash. */
export function campaignBattleContent(content: GameContent, state: CoopState, battle: Pick<CoopBattle, 'actorIds' | 'combat' | 'loadouts'>): GameContent {
  const characters = battle.actorIds.map(id => {
    const hero = content.characters.find(hero => hero.id === id)!;
    return equippedHero(hero, battle.loadouts?.[id] ?? state.progression!.heroes[id], content);
  });
  const enemyIds = new Set(battle.combat.enemyIds);
  const enemies = content.enemies.filter(enemy => enemyIds.has(enemy.id));
  const units = [...characters, ...enemies];
  const skills = new Set(units.flatMap(unit => unit.skillIds)), effects = new Set(units.flatMap(unit => unit.effectIds));
  return Object.freeze({ ...content, equipmentCatalog: undefined, characters, enemies, encounters: [],
    skills: content.skills.filter(skill => skills.has(skill.id)), effects: content.effects.filter(effect => effects.has(effect.id)) });
}

/** Retain every selectable boss and escort, preserving the production summon roster. */
export function campaignBossContent(content: GameContent, state: CoopState): GameContent {
  const enemyIds = [...new Set([
    ...content.enemies.filter(enemy => enemy.tags.includes('BOSS')).map(enemy => enemy.id),
    ...SEASON_BOSS_ORDER.flatMap(season => seasonBossEscortPool(content, season).map(enemy => enemy.id)),
  ])];
  return campaignBattleContent(content, state, { actorIds: [...state.characterIds],
    combat: { enemyIds } as CombatState });
}

/**
 * Accelerated policy experiment, not an estimate of human navigation success.
 * Route travel/contact is scripted; combat, persistent dice, loot, injuries, fitting,
 * generated campfire availability and four twenty-minute boss deadlines use game rules.
 */
export function simulateCampaign(inputContent: GameContent, options: CampaignOptions): CampaignResult {
  const content = Object.isFrozen(inputContent) ? inputContent : Object.freeze({ ...inputContent });
  const mode = options.mode ?? 'progression', maxMinutes = options.maxMinutes ?? 100;
  const intervalMinutes = options.encounterIntervalMinutes ?? 3, chestsPerStage = options.chestsPerStage ?? 2;
  const campfireEvery = options.campfireEveryBattles ?? 1;
  if (!Number.isFinite(maxMinutes) || maxMinutes <= 0 || maxMinutes > 1000) throw new Error('maxMinutes must be between 0 and 1000');
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0 || !Number.isInteger(chestsPerStage) || chestsPerStage < 0
    || !Number.isInteger(campfireEvery) || campfireEvery < 0) throw new Error('Invalid scripted route options');
  const policy = options.policy ?? simulationPolicy;
  let state = createCoopState(options.seed, [...options.characterIds], content, options.difficultyId);
  const deadline = Math.ceil(maxMinutes * TICKS_PER_MINUTE), interval = Math.ceil(intervalMinutes * TICKS_PER_MINUTE);
  const battles: CampaignBattle[] = [], stages: CampaignStage[] = SEASON_BOSS_ORDER.map(season => ({ season, defeated: false, livingHeroes: options.characterIds.length, gearScore: 0 }));
  const diagnostics: CampaignResult['diagnostics'] = { model: 'scripted-route-v1',
    assumptions: [
      'Scripted radial travel and contact; no player navigation, roaming AI, reinforcements, network delay or human decision time.',
      `Route arrives at most once per ${intervalMinutes} virtual minutes; actual combat presentation time postpones arrivals.`,
      `Visit at most ${chestsPerStage} generated chests per twenty-minute stage; loot and greedy equipment selection are personal.`,
      'Recovery requires a generated, unexpired campfire; existing integer healing applies for at most fifteen seconds. Lost parts never regenerate.',
      'An immobile living hero stops the grouped route, chest and campfire travel; the party waits in place for seasonal bosses.',
      'Bosses summon on the actual twenty-minute game clock; no early altar summons. Party stays together and fights one generated group at a time.',
      options.preferNormalGroups === false ? 'Route takes any generated group.' : 'Route prefers normal groups when available; no preview rollouts or knowledge of future dice.',
      mode === 'starter' ? 'Starter control collects loot but never equips found equipment or skills.' : 'Greedy expected-value inventory policy, without future loot knowledge.',
    ], encountersAttempted: 0, chestsOpened: 0, campfiresUsed: 0, rewardsCollected: 0, equipmentChanges: 0, skillsLearned: 0,
    diceCount: 0, heroDiceCounters: {}, routeChunks: [] };
  const chestCounts = [0, 0, 0, 0];
  let nextArrival = interval, excursion = 0, terminal: CampaignResult['status'] | undefined;
  const minutes = () => state.tick / TICKS_PER_MINUTE;
  const alive = () => state.actors.filter(actor => !actor.body || isBodyAlive(actor.body));
  const canTravel = () => alive().every(actor => !actor.body || bodyMovementMultiplier(actor.body) > 0);
  const totalGear = () => alive().reduce((sum, actor) => sum + campaignGearScore(actor.id, state.progression!.heroes[actor.id], content, actor.body, alive().length), 0);
  const updateStages = () => {
    for (const spawn of state.bosses?.spawned ?? []) {
      const stage = stages.find(stage => stage.season === spawn.season)!;
      stage.enemyId = spawn.enemyId; stage.summonedAtMinute = spawn.summonedAtTick / TICKS_PER_MINUTE;
      if (!stage.defeated && isSeasonBossDefeated(state, spawn)) {
        stage.defeated = true; stage.defeatedAtMinute = minutes(); stage.livingHeroes = alive().length; stage.gearScore = totalGear();
      }
    }
  };
  const moveParty = (chunkId: string, position: GridPoint) => {
    state = ensureCoopChunk(state, chunkId, content);
    state = { ...state, actors: state.actors.map(actor => actor.body && !isBodyAlive(actor.body) ? actor : {
      ...actor, chunkId, position: { ...position }, path: [], visited: actor.visited.includes(chunkId) ? actor.visited : [...actor.visited, chunkId],
      transitions: actor.transitions + Number(actor.chunkId !== chunkId),
    }) };
  };
  const clockTo = (target: number, healing = false) => {
    target = Math.min(deadline, target);
    while (state.tick < target) {
      const summonAt = state.bosses?.nextAtTick;
      const next = Math.min(target, healing ? state.tick + 1 : target, summonAt != null && !state.failed ? Math.max(state.tick, summonAt) : target);
      if (next > state.tick) state = healing ? advanceCampfireHealing({ ...state, tick: next }) : { ...state, tick: next };
      if (!state.failed && summonAt != null && state.tick >= summonAt) {
        state = summonSeasonBoss(state, campaignBossContent(content, state)); updateStages();
        if (healing && state.battles.length) break;
      }
    }
  };
  const improve = () => {
    const result = optimizeCampaignInventory(state, content, mode === 'progression'); state = result.state;
    diagnostics.rewardsCollected += result.changes.collected; diagnostics.equipmentChanges += result.changes.equipped; diagnostics.skillsLearned += result.changes.learned;
  };
  const recover = () => {
    if (!campfireEvery || battles.length % campfireEvery || state.battles.length || !alive().length || !canTravel()) return;
    const actor = alive()[0], chunk = coopChunk(state.seed, actor.chunkId, state.worldVersion ?? 2);
    const fire = chunk.pois.find(poi => poi.kind === 'campfire' && (!state.progression!.campfires[poi.id] || state.progression!.campfires[poi.id].expiresAtTick > state.tick));
    if (!fire || !alive().some(actor => actor.body && BODY_PARTS.some(part => !actor.body![part].lost && actor.body![part].current < actor.body![part].max))) return;
    moveParty(chunk.id, fire.position); state = discoverCampfires(state, []);
    const before = alive().reduce((sum, actor) => sum + BODY_PARTS.reduce((hp, part) => hp + (actor.body?.[part].current ?? 0), 0), 0);
    clockTo(state.tick + CAMPFIRE_HEAL_TICKS, true);
    const after = alive().reduce((sum, actor) => sum + BODY_PARTS.reduce((hp, part) => hp + (actor.body?.[part].current ?? 0), 0), 0);
    if (after > before) diagnostics.campfiresUsed++;
  };
  const openChests = () => {
    if (!alive().length || state.battles.length || !chestsPerStage || !canTravel()) return;
    const stage = Math.min(3, Math.floor(minutes() / 20)), chunk = coopChunk(state.seed, alive()[0].chunkId, state.worldVersion ?? 2);
    for (const poi of chunk.pois.filter(poi => poi.kind === 'chest')) {
      if (chestCounts[stage] >= chestsPerStage) break;
      const owners = alive().filter(actor => !state.progression!.heroes[actor.id].claimedSources.includes(`chest:${poi.id}`));
      if (!owners.length) continue;
      moveParty(chunk.id, poi.position);
      for (const owner of owners) {
        const result = commandCoop(state, owner.id, { type: 'interact', chunkId: chunk.id, poiId: poi.id }, content);
        if (!result.accepted) throw new Error(result.reason ?? 'Scripted chest interaction rejected');
        state = result.state;
      }
      chestCounts[stage]++; diagnostics.chestsOpened++; improve();
    }
  };
  const fight = (initial: CoopBattle) => {
    const started = minutes(), gearScore = totalGear();
    const projected = campaignBattleContent(content, state, initial);
    // Bosses are created by the unmodified summon path; projected rules are identical.
    state = { ...state, battles: state.battles.map(battle => battle.id === initial.id ? { ...battle, combat: { ...battle.combat, contentHash: hashValue(projected) } } : battle) };
    let battle = state.battles.find(battle => battle.id === initial.id)!;
    let damageTaken = 0, healing = 0, steps = 0;
    const maxSteps = content.balance.maxRounds * battle.combat.units.length * 3 + 10;
    while (!isTerminal(battle.combat) && state.tick < deadline) {
      if (++steps > maxSteps) throw new Error('Campaign battle step limit exceeded');
      const sequence = battle.combat.nextSequence;
      const result = battle.combat.pendingActorId
        ? performCoopBattleAction(state, battle.id, policy(battle.combat, projected), projected)
        : performCoopBattleStep(state, battle.id, 0, projected);
      if (!result.events.length) throw new Error('Campaign battle did not advance');
      state = result.state; battle = state.battles.find(candidate => candidate.id === battle.id)!;
      const heroes = new Set(battle.combat.units.filter(unit => unit.team === 'heroes').map(unit => unit.id));
      for (const event of battle.combat.events.filter(event => event.sequence >= sequence)) {
        if (!heroes.has(event.targetId ?? '')) continue;
        if (event.type === 'DAMAGE') damageTaken += event.amount ?? 0;
        if (event.type === 'HEALED') healing += event.amount ?? 0;
      }
      clockTo(state.tick + Math.max(1, Math.ceil((battle.presentationMs ?? 0) / MOVEMENT_TICK_MS)));
    }
    const spawn = state.bosses?.spawned.find(spawn => battle.mobIds.includes(spawn.mobId)
      || spawn.chunkId === battle.chunkId && state.groups[spawn.chunkId]?.some(group => group.id === spawn.mobId
        && group.members.some(mob => battle.mobIds.includes(mob.id))));
    const heroes = battle.combat.units.filter(unit => unit.team === 'heroes');
    battles.push({ index: battles.length, kind: spawn ? 'boss' : 'roaming', ...(spawn ? { season: spawn.season } : {}),
      chunkId: battle.chunkId, enemyIds: [...battle.combat.enemyIds ?? []], party: [...battle.actorIds], status: battle.combat.status,
      rounds: battle.combat.round, turns: battle.combat.turn, startMinute: started, endMinute: minutes(), durationMinutes: minutes() - started,
      damageTaken, healing, heroDeaths: heroes.filter(unit => unit.hp <= 0).map(unit => unit.definitionId),
      lostLimbs: Object.fromEntries(heroes.map(unit => [unit.definitionId, BODY_PARTS.filter(part => unit.body?.[part].lost)])), gearScore });
    if (!isTerminal(battle.combat)) { terminal = 'timeout'; return; }
    state = finishCoopBattle(state, battle.id, content); updateStages();
    if (state.failed) terminal = 'defeat';
    else if (state.completed) terminal = 'victory';
    else if (battle.combat.status === 'escaped') terminal = 'escaped';
    else if (battle.combat.status === 'draw') terminal = 'timeout';
    if (terminal) return;
    improve(); state = engageSeasonBosses(state, campaignBossContent(content, state), []);
    if (!state.battles.length) { recover(); openChests(); }
  };

  try {
    if (!state.bosses) throw new Error('Campaign requires one boss pool for each season');
    const graph = coopGraph(state.seed, state.worldVersion ?? 2), angle = hashString(`${state.seed}:campaign-route`) % 360 * Math.PI / 180;
    while (!terminal && state.tick < deadline && !state.completed && !state.failed) {
      if (state.battles.length) { fight(state.battles[0]); continue; }
      const due = state.bosses?.nextAtTick;
      clockTo(Math.min(nextArrival, due ?? deadline, deadline));
      if (state.battles.length) continue;
      if (state.tick >= deadline) break;
      if (state.tick < nextArrival) continue;
      if (!canTravel()) { nextArrival = state.tick + interval; continue; }
      const radius = Math.min(graph.radius - 1, excursion++);
      const point = { x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) };
      const node = graph.nodes.find(node => node.x === point.x && node.y === point.y)
        ?? [...graph.nodes].sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
      const chunk = coopChunk(state.seed, node.id, state.worldVersion ?? 2);
      moveParty(chunk.id, chunk.spawn); diagnostics.routeChunks.push(chunk.id);
      state = discoverCampfires(state, []);
      const groups = state.groups[chunk.id].filter(group => !group.id.startsWith('season-boss:') && group.members.length);
      const normal = groups.filter(group => group.category === 'normal');
      const pool = options.preferNormalGroups !== false && normal.length ? normal : groups;
      const group = pool[hashString(`${state.seed}:campaign-encounter:${excursion}`) % Math.max(1, pool.length)];
      nextArrival = state.tick + interval;
      if (!group) { openChests(); recover(); continue; }
      moveParty(chunk.id, group.home); state = discoverCampfires(state, []);
      const actorIds = alive().map(actor => actor.id);
      const roster = { actorIds, combat: { enemyIds: group.members.map(mob => mob.definitionId) } as CombatState };
      const projected = campaignBattleContent(content, state, roster);
      state = startCoopBattle(state, { type: 'battle-start', battleId: `campaign:${excursion}:${group.id}`, chunkId: chunk.id,
        actorIds, mobIds: group.members.map(mob => mob.id), enemyIds: group.members.map(mob => mob.definitionId),
        initiatorActorId: actorIds[0], initiatorMobId: group.members[0].id, diceIndex: state.diceIndex }, projected);
      diagnostics.encountersAttempted++;
    }
  } catch (error) {
    terminal = 'error'; diagnostics.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  updateStages();
  // A time limit may stop a live battle before finishCoopBattle copies its wounds back.
  const finalActors = state.actors.map(actor => ({ ...actor, body: state.battles.flatMap(battle => battle.combat.units)
    .find(unit => unit.team === 'heroes' && unit.definitionId === actor.id)?.body ?? actor.body }));
  const survivors = finalActors.filter(actor => !actor.body || isBodyAlive(actor.body)).length;
  const endingGear: CampaignHeroGear[] = finalActors.map(actor => {
    const progress = state.progression!.heroes[actor.id], definition = equippedHero(content.characters.find(hero => hero.id === actor.id)!, progress, content);
    const rarities: Record<RewardRarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (const entry of progress.equipment) rarities[content.equipmentCatalog?.items[entry.itemId]?.rarity ?? 'common']++;
    const max = BODY_PARTS.reduce((sum, part) => sum + (actor.body?.[part].max ?? 0), 0);
    return { heroId: actor.id, alive: !actor.body || isBodyAlive(actor.body), healthFraction: max ? BODY_PARTS.reduce((sum, part) => sum + Math.max(0, actor.body?.[part].current ?? 0), 0) / max : 1,
      lostParts: BODY_PARTS.filter(part => actor.body?.[part].lost), gearScore: campaignGearScore(actor.id, progress, content, actor.body, survivors),
      equipment: progress.equipment, skills: progress.skills, inventoryCount: progress.inventory?.length ?? 0, coins: progress.coins, rarities,
      activeSetBonuses: activeEquipmentSetBonuses(definition, actor.body).reduce((sum, set) => sum + set.bonuses.length, 0) };
  });
  diagnostics.diceCount = state.diceIndex; diagnostics.heroDiceCounters = { ...state.diceCounters };
  return { seed: options.seed, difficultyId: options.difficultyId, characterIds: [...options.characterIds], mode,
    status: terminal ?? (state.failed ? 'defeat' : state.completed ? 'victory' : 'timeout'), bossesDefeated: stages.filter(stage => stage.defeated).length,
    battles, rounds: battles.reduce((sum, battle) => sum + battle.rounds, 0), durationMinutes: minutes(), stages, endingGear, diagnostics };
}
