import { SEASON_BOSS_INTERVAL_MS, SEASON_BOSS_ORDER, type CoopActor, type CoopEvent, type CoopState, type GameContent, type GridPoint, type Season, type SeasonBossProgress, type SeasonBossSpawn, type WorldChunk } from '@shards/shared';
import { isBodyAlive } from '../anatomy';
import { drawDie } from '../dice';
import { createEntityRng } from '../random';
import { findPath } from '../world/pathfinding';
import { isWalkable, samePoint } from '../world/grid';
import { createMovementState, MOVEMENT_TICK_MS } from '../world/movement-speed';
import { coopChunk, ensureCoopChunk, compareCoopIds } from './world';
import { getCoopBattle, recruitCoopActors, startCoopBattle } from './battles';
import { coopLocks } from './movement';
import { withinCoopBattleReach } from './battle-reach';

export const SEASON_BOSS_INTERVAL_TICKS = SEASON_BOSS_INTERVAL_MS / MOVEMENT_TICK_MS;

export function seasonBossPool(content: GameContent, season: Season) {
  return content.enemies.filter(enemy => enemy.tags.includes('BOSS') && enemy.tags.includes(`SEASON_${season.toUpperCase()}`))
    .sort((a, b) => compareCoopIds(a.id, b.id));
}

/** The same pool is used by runtime summons and accelerated campaign projections. */
export function seasonBossEscortPool(content: GameContent, season: Season) {
  const ordinary = content.enemies.filter(enemy => !enemy.tags.includes('BOSS')
    && !enemy.tags.includes('AQUATIC') && !enemy.tags.includes('BASEMENT'));
  const seasonal = ordinary.filter(enemy => enemy.tags.includes(`SEASON_${season.toUpperCase()}`));
  const candidates = seasonal.length ? seasonal : ordinary;
  const targetTier = 2 + SEASON_BOSS_ORDER.indexOf(season);
  const tier = (tags: string[]) => Number(tags.find(tag => /^TIER_[1-5]$/.test(tag))?.slice(5));
  const ranked = candidates.filter(enemy => Number.isFinite(tier(enemy.tags)));
  const distance = Math.min(...ranked.map(enemy => Math.abs(tier(enemy.tags) - targetTier)));
  return (ranked.length ? ranked.filter(enemy => Math.abs(tier(enemy.tags) - targetTier) === distance) : candidates)
    .sort((a, b) => compareCoopIds(a.id, b.id));
}

export function initialSeasonBosses(tick: number, content: GameContent): SeasonBossProgress | undefined {
  return SEASON_BOSS_ORDER.every(season => content.enemies.some(enemy => enemy.tags.includes('BOSS') && enemy.tags.includes(`SEASON_${season.toUpperCase()}`)))
    ? { nextAtTick: tick + SEASON_BOSS_INTERVAL_TICKS, spawned: [] } : undefined;
}

/** Killing the leader and fleeing its escorts is not a completed seasonal encounter. */
export function isSeasonBossDefeated(state: Pick<CoopState, 'groups' | 'killedEnemyIds'>, boss: Pick<SeasonBossSpawn, 'mobId' | 'chunkId'>): boolean {
  return state.killedEnemyIds.includes(boss.mobId)
    && !(state.groups[boss.chunkId] ?? []).some(group => group.id === boss.mobId
      && group.members.some(member => !state.killedEnemyIds.includes(member.id)));
}

function livingBossTargets(state: CoopState): CoopActor[] {
  return state.actors.filter(actor => {
    const unit = getCoopBattle(state, actor.id)?.combat.units.find(unit => unit.team === 'heroes' && unit.definitionId === actor.id);
    return unit ? unit.hp > 0 : !actor.body || isBodyAlive(actor.body);
  }).sort((a, b) => compareCoopIds(a.id, b.id));
}

/** Prefer an adjacent, free, reachable tile; a crowded room can still host its boss. */
function spawnPosition(state: CoopState, chunk: WorldChunk, actor: CoopActor, reserved: GridPoint[] = []): GridPoint {
  const occupied = [...state.actors.filter(hero => hero.chunkId === chunk.id).map(hero => hero.position),
    ...(state.groups[chunk.id] ?? []).flatMap(group => group.members.map(mob => mob.position)),
    ...chunk.pois.map(poi => poi.position), ...chunk.exits.map(exit => exit.position), ...reserved];
  const candidates: GridPoint[] = [];
  for (let y = actor.position.y - 3; y <= actor.position.y + 3; y++) {
    for (let x = actor.position.x - 3; x <= actor.position.x + 3; x++) {
      const point = { x, y };
      if (isWalkable(chunk, point) && !occupied.some(other => samePoint(point, other))) candidates.push(point);
    }
  }
  const distance = (point: GridPoint) => Math.abs(point.x - actor.position.x) + Math.abs(point.y - actor.position.y);
  candidates.sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x);
  return candidates.find(point => {
    const path = findPath(chunk, actor.position, point);
    return path.length > 0 && path.length <= 6;
  }) ?? { ...actor.position };
}

/** One event contains the seed-derived selection, schedule change and initial local contact. */
export function summonSeasonBoss(state: CoopState, content: GameContent, requested?: { actorId: string; season: Season; poiId: string }): CoopState {
  const bosses = state.bosses;
  if (!bosses || bosses.spawned.length >= SEASON_BOSS_ORDER.length) throw new Error('Все сезонные боссы уже призваны.');
  if (bosses.nextAtTick === null || bosses.spawned.some(boss => !isSeasonBossDefeated(state, boss))) {
    throw new Error('Сначала победите уже призванного босса и его стаю.');
  }
  const season = SEASON_BOSS_ORDER[bosses.spawned.length];
  if (requested && requested.season !== season) throw new Error('Сначала призовите босса предыдущего сезона.');
  if (!requested && state.tick < bosses.nextAtTick) throw new Error('Время призыва ещё не наступило.');
  const targets = livingBossTargets(state);
  if (!targets.length) throw new Error('Нет живых героев для призыва.');
  // This entity exists once per season: its independent dice start at zero and
  // cannot change the next attack roll of any hero or enemy.
  const rng = createEntityRng(state.seed, `season-summon:${season}`, 0);
  const actor = requested ? targets.find(hero => hero.id === requested.actorId) : targets[drawDie(targets.length, rng, 'EVENT') - 1];
  if (!actor) throw new Error('Призывающий герой недоступен.');
  const pool = seasonBossPool(content, season);
  if (!pool.length) throw new Error('Босс этого сезона не найден.');
  // Boss choice is the same for timer and altar; target selection has its own die.
  const bossRng = createEntityRng(state.seed, `season-boss:${season}`, 0);
  const enemy = pool[drawDie(pool.length, bossRng, 'ENCOUNTER') - 1];
  // A separate stream keeps the boss selection identical for altar and timer.
  const escortRng = createEntityRng(state.seed, `season-boss-pack:${season}`, 0);
  const escorts = seasonBossEscortPool(content, season);
  if (!escorts.length) throw new Error('Не найдены противники для стаи босса.');
  const attackers = escorts.filter(candidate => candidate.role === 'damage');
  const firstPool = attackers.length ? attackers : escorts;
  const first = firstPool[drawDie(firstPool.length, escortRng, 'ENCOUNTER') - 1];
  const family = first.tags.find(tag => tag.startsWith('FAMILY_'));
  const relatives = escorts.filter(candidate => candidate.id !== first.id && (!family || candidate.tags.includes(family)));
  const remaining = relatives.length ? relatives : escorts.filter(candidate => candidate.id !== first.id);
  const support = remaining.filter(candidate => candidate.role === (enemy.role === 'healer' ? 'tank' : 'healer'));
  const secondPool = support.length ? support : remaining.length ? remaining : escorts;
  const second = secondPool[drawDie(secondPool.length, escortRng, 'ENCOUNTER') - 1];
  const mobId = `season-boss:${season}`;
  state = ensureCoopChunk(state, actor.chunkId, content);
  const chunk = coopChunk(state.seed, actor.chunkId, state.worldVersion ?? 2);
  const position = spawnPosition(state, chunk, actor);
  const reserved = [position];
  const members = [enemy, first, second].map((definition, index) => {
    const memberPosition = index === 0 ? position : spawnPosition(state, chunk, actor, reserved);
    if (index > 0) reserved.push(memberPosition);
    return { id: index === 0 ? mobId : `${mobId}:escort:${index}`, definitionId: definition.id,
      position: memberPosition, path: [], movement: createMovementState(definition.movementSpeed ?? 100) };
  });
  const spawned = [...bosses.spawned, { season, enemyId: enemy.id, mobId, chunkId: actor.chunkId, actorId: actor.id,
    summonedAtTick: state.tick, trigger: requested ? 'altar' as const : 'timer' as const }];
  state = { ...state, diceIndex: state.diceIndex + rng.diceIndex + bossRng.diceIndex + escortRng.diceIndex,
    bosses: { spawned, nextAtTick: null },
    interactedStructureIds: requested ? [...new Set([...state.interactedStructureIds, requested.poiId])] : state.interactedStructureIds,
    groups: { ...state.groups, [actor.chunkId]: [...state.groups[actor.chunkId], {
      id: mobId, category: 'miniboss', chases: true, home: position, mode: 'chase', targetActorId: actor.id, decision: 0, pauseMs: 0,
      members,
    }] } };
  return engageSeasonBosses(state, content, []);
}

/** A busy hero finishes their current encounter; nearby free heroes can face the boss now. */
export function engageSeasonBosses(state: CoopState, content: GameContent, events: CoopEvent[]): CoopState {
  for (const spawned of state.bosses?.spawned ?? []) {
    const locks = coopLocks(state);
    if (isSeasonBossDefeated(state, spawned)) continue;
    const group = state.groups[spawned.chunkId]?.find(group => group.id === spawned.mobId);
    if (!group || group.members.some(member => locks.mobs.has(member.id))) continue;
    const members = group.members.filter(member => !state.killedEnemyIds.includes(member.id));
    const mob = members.find(member => member.id === spawned.mobId) ?? members[0];
    if (!mob) continue;
    const chunk = coopChunk(state.seed, spawned.chunkId, state.worldVersion ?? 2);
    const heroes = livingBossTargets(state).filter(hero => hero.chunkId === spawned.chunkId && !locks.actors.has(hero.id));
    const initiator = heroes.find(hero => members.some(member => withinCoopBattleReach(chunk, hero.position, member.position, hero)));
    if (!initiator) continue;
    const actorIds = recruitCoopActors(chunk, heroes, [initiator.position, ...members.map(member => member.position)], [initiator.id]);
    const event: Extract<CoopEvent, { type: 'battle-start' }> = { type: 'battle-start', battleId: `battle:${state.tick}:${spawned.mobId}`,
      chunkId: spawned.chunkId, actorIds, mobIds: members.map(member => member.id), enemyIds: members.map(member => member.definitionId), initiatorActorId: initiator.id,
      initiatorMobId: mob.id, diceIndex: state.diceIndex };
    state = startCoopBattle(state, event, content);
    events.push(event);
  }
  return state;
}

/** Battle-end is replayed at the same game tick by the host and every guest. */
export function startNextSeasonBossCountdown(state: CoopState): CoopState {
  const bosses = state.bosses;
  if (!bosses || bosses.nextAtTick !== null || !bosses.spawned.length || bosses.spawned.length >= SEASON_BOSS_ORDER.length
    || bosses.spawned.some(boss => !isSeasonBossDefeated(state, boss))) return state;
  return { ...state, bosses: { ...bosses, nextAtTick: state.tick + SEASON_BOSS_INTERVAL_TICKS } };
}

export function seasonBossesDefeated(state: CoopState): boolean {
  return state.bosses?.spawned.length === SEASON_BOSS_ORDER.length
    && state.bosses.spawned.every(boss => isSeasonBossDefeated(state, boss));
}
