import { SEASON_BOSS_INTERVAL_MS, SEASON_BOSS_ORDER, type CoopActor, type CoopEvent, type CoopState, type GameContent, type GridPoint, type Season, type SeasonBossProgress, type WorldChunk } from '@shards/shared';
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

export function initialSeasonBosses(tick: number, content: GameContent): SeasonBossProgress | undefined {
  return SEASON_BOSS_ORDER.every(season => content.enemies.some(enemy => enemy.tags.includes('BOSS') && enemy.tags.includes(`SEASON_${season.toUpperCase()}`)))
    ? { nextAtTick: tick + SEASON_BOSS_INTERVAL_TICKS, spawned: [] } : undefined;
}

function livingBossTargets(state: CoopState): CoopActor[] {
  return state.actors.filter(actor => {
    const unit = getCoopBattle(state, actor.id)?.combat.units.find(unit => unit.team === 'heroes' && unit.definitionId === actor.id);
    return unit ? unit.hp > 0 : !actor.body || isBodyAlive(actor.body);
  }).sort((a, b) => compareCoopIds(a.id, b.id));
}

/** Prefer an adjacent, free, reachable tile; a crowded room can still host its boss. */
function spawnPosition(state: CoopState, chunk: WorldChunk, actor: CoopActor): GridPoint {
  const occupied = [...state.actors.filter(hero => hero.chunkId === chunk.id).map(hero => hero.position),
    ...(state.groups[chunk.id] ?? []).flatMap(group => group.members.map(mob => mob.position)),
    ...chunk.pois.map(poi => poi.position), ...chunk.exits.map(exit => exit.position)];
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
  if (!bosses || bosses.nextAtTick === null || bosses.spawned.length >= SEASON_BOSS_ORDER.length) throw new Error('Все сезонные боссы уже призваны.');
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
  const pool = content.enemies.filter(enemy => enemy.tags.includes('BOSS') && enemy.tags.includes(`SEASON_${season.toUpperCase()}`))
    .sort((a, b) => compareCoopIds(a.id, b.id));
  if (!pool.length) throw new Error('Босс этого сезона не найден.');
  // Boss choice is the same for timer and altar; target selection has its own die.
  const bossRng = createEntityRng(state.seed, `season-boss:${season}`, 0);
  const enemy = pool[drawDie(pool.length, bossRng, 'ENCOUNTER') - 1];
  const mobId = `season-boss:${season}`;
  state = ensureCoopChunk(state, actor.chunkId, content);
  const chunk = coopChunk(state.seed, actor.chunkId, state.worldVersion ?? 2);
  const position = spawnPosition(state, chunk, actor);
  const spawned = [...bosses.spawned, { season, enemyId: enemy.id, mobId, chunkId: actor.chunkId, actorId: actor.id,
    summonedAtTick: state.tick, trigger: requested ? 'altar' as const : 'timer' as const }];
  state = { ...state, diceIndex: state.diceIndex + rng.diceIndex + bossRng.diceIndex,
    bosses: { spawned, nextAtTick: spawned.length === SEASON_BOSS_ORDER.length ? null : state.tick + SEASON_BOSS_INTERVAL_TICKS },
    interactedStructureIds: requested ? [...new Set([...state.interactedStructureIds, requested.poiId])] : state.interactedStructureIds,
    groups: { ...state.groups, [actor.chunkId]: [...state.groups[actor.chunkId], {
      id: mobId, category: 'miniboss', chases: true, home: position, mode: 'chase', targetActorId: actor.id, decision: 0, pauseMs: 0,
      members: [{ id: mobId, definitionId: enemy.id, position, path: [], movement: createMovementState(enemy.movementSpeed ?? 100) }],
    }] } };
  return engageSeasonBosses(state, content, []);
}

/** A busy hero finishes their current encounter; nearby free heroes can face the boss now. */
export function engageSeasonBosses(state: CoopState, content: GameContent, events: CoopEvent[]): CoopState {
  for (const spawned of state.bosses?.spawned ?? []) {
    const locks = coopLocks(state);
    if (state.killedEnemyIds.includes(spawned.mobId) || locks.mobs.has(spawned.mobId)) continue;
    const mob = state.groups[spawned.chunkId]?.flatMap(group => group.members).find(mob => mob.id === spawned.mobId);
    if (!mob) continue;
    const chunk = coopChunk(state.seed, spawned.chunkId, state.worldVersion ?? 2);
    const heroes = livingBossTargets(state).filter(hero => hero.chunkId === spawned.chunkId && !locks.actors.has(hero.id));
    const initiator = heroes.find(hero => withinCoopBattleReach(chunk, hero.position, mob.position, hero));
    if (!initiator) continue;
    const actorIds = recruitCoopActors(chunk, heroes, [initiator.position, mob.position], [initiator.id]);
    const event: Extract<CoopEvent, { type: 'battle-start' }> = { type: 'battle-start', battleId: `battle:${state.tick}:${spawned.mobId}`,
      chunkId: spawned.chunkId, actorIds, mobIds: [mob.id], enemyIds: [mob.definitionId], initiatorActorId: initiator.id,
      initiatorMobId: mob.id, diceIndex: state.diceIndex };
    state = startCoopBattle(state, event, content);
    events.push(event);
  }
  return state;
}

export function seasonBossesDefeated(state: CoopState): boolean {
  return state.bosses?.spawned.length === SEASON_BOSS_ORDER.length
    && state.bosses.spawned.every(boss => state.killedEnemyIds.includes(boss.mobId));
}
