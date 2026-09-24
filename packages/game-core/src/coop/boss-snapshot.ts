import { SEASON_BOSS_INTERVAL_MS, SEASON_BOSS_ORDER, type CoopState, type GameContent, type SeasonBossProgress, type SeasonBossSpawn } from '@shards/shared';
import { array, integer, oneOf, record, same, string } from '../snapshot-values';
import { MOVEMENT_TICK_MS } from '../world/movement-speed';
import { initialSeasonBosses, isSeasonBossDefeated } from './bosses';

const INTERVAL_TICKS = SEASON_BOSS_INTERVAL_MS / MOVEMENT_TICK_MS;
type BossRestoreState = Pick<CoopState, 'tick' | 'actors' | 'groups' | 'killedEnemyIds'>;

/** Boss history is small and permanent; its living roaming group carries current movement. */
export function restoreSeasonBosses(value: unknown, state: BossRestoreState, content: GameContent): SeasonBossProgress | undefined {
  // Older expeditions receive a full first interval from their saved active-game time.
  if (value === undefined) return initialSeasonBosses(state.tick, content);
  const data = record(value, 'coop.bosses', ['nextAtTick', 'spawned']);
  const spawned: SeasonBossSpawn[] = array(data.spawned, 'coop.bosses.spawned', SEASON_BOSS_ORDER.length).map((value, index) => {
    const path = `coop.bosses.spawned.${index}`;
    const saved = record(value, path, ['season', 'enemyId', 'mobId', 'chunkId', 'actorId', 'summonedAtTick', 'trigger']);
    const season = oneOf(saved.season, SEASON_BOSS_ORDER, `${path}.season`);
    same(season, SEASON_BOSS_ORDER[index], `${path}.season`);
    const enemyId = string(saved.enemyId, `${path}.enemyId`);
    const enemy = content.enemies.find(candidate => candidate.id === enemyId);
    if (!enemy?.tags.includes('BOSS') || !enemy.tags.includes(`SEASON_${season.toUpperCase()}`)) throw new Error('Unknown saved seasonal boss');
    const mobId = string(saved.mobId, `${path}.mobId`);
    same(mobId, `season-boss:${season}`, `${path}.mobId`);
    const actorId = string(saved.actorId, `${path}.actorId`);
    const actor = state.actors.find(candidate => candidate.id === actorId);
    const chunkId = string(saved.chunkId, `${path}.chunkId`);
    if (!actor || !actor.visited.includes(chunkId)) throw new Error('Invalid seasonal boss summoning location');
    const summonedAtTick = integer(saved.summonedAtTick, `${path}.summonedAtTick`, 0, state.tick);
    const trigger = oneOf(saved.trigger, ['timer', 'altar'], `${path}.trigger`);
    if (!state.killedEnemyIds.includes(mobId)) {
      const mob = state.groups[chunkId]?.flatMap(group => group.members).find(candidate => candidate.id === mobId);
      if (!mob || mob.definitionId !== enemyId) throw new Error('Missing living seasonal boss');
    }
    return { season, enemyId, mobId, chunkId, actorId, summonedAtTick, trigger };
  });
  for (let index = 1; index < spawned.length; index++) {
    const previous = spawned[index - 1], current = spawned[index];
    if (current.summonedAtTick < previous.summonedAtTick
      || current.trigger === 'timer' && current.summonedAtTick < previous.summonedAtTick + INTERVAL_TICKS) {
      throw new Error('Invalid seasonal boss chronology');
    }
  }
  if (spawned.length === SEASON_BOSS_ORDER.length) {
    same(data.nextAtTick, null, 'coop.bosses.nextAtTick');
    return { nextAtTick: null, spawned };
  }
  const last = spawned.at(-1);
  const awaitingVictory = spawned.some(boss => !isSeasonBossDefeated(state, boss));
  if (awaitingVictory && data.nextAtTick === null) return { nextAtTick: null, spawned };
  const nextAtTick = integer(data.nextAtTick, 'coop.bosses.nextAtTick',
    (last?.summonedAtTick ?? 0) + INTERVAL_TICKS, state.tick + INTERVAL_TICKS);
  // Older saves counted from the summon. A living boss now suspends that schedule;
  // defeating the outstanding boss(es) will start a fresh full interval.
  if (awaitingVictory) return { nextAtTick: null, spawned };
  // The deadline itself preserves the victory-based countdown without storing a
  // separate defeat timestamp or resetting it on reconnect.
  return { nextAtTick, spawned };
}
