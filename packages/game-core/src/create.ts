import { SCHEMA_VERSION, type CombatOptions, type CombatState, type Combatant, type GameContent, type Team, type UnitDefinition } from '@shards/shared';
import { createRng } from './random';
import { hashValue } from './canonical';
import { restoreHeroBody, startHeroBody, syncBodyCombatant } from './anatomy';
import { getDifficultyProfile } from './difficulty';

export function createCombat(options: CombatOptions, content: GameContent): CombatState {
  if (content.schemaVersion !== SCHEMA_VERSION) throw new Error('Unsupported content schema version');
  const difficulty = getDifficultyProfile(content, options.difficultyId);
  if (!Array.isArray(options.characterIds) || options.characterIds.length < 1 || options.characterIds.length > 4 || new Set(options.characterIds).size !== options.characterIds.length) throw new Error('Choose 1–4 distinct characters');
  if (typeof options.encounterId !== 'string' || !options.encounterId.length || options.encounterId.length > 256) throw new Error('Encounter ID must contain 1–256 characters');
  const dynamic = options.enemyIds !== undefined;
  const enemyIds = dynamic ? options.enemyIds : content.encounters.find(candidate => candidate.id === options.encounterId)?.enemyIds;
  if (dynamic && (!Array.isArray(enemyIds) || enemyIds.length < 1 || enemyIds.length > 16)) throw new Error('Choose 1–16 enemies for a roaming encounter');
  if (!enemyIds?.length) throw new Error(`Unknown or empty encounter: ${options.encounterId}`);
  const scaling = content.balance.partyScaling[options.characterIds.length];
  if (!scaling) throw new Error('Missing party scaling for selected party');
  const makeUnit = (definition: UnitDefinition, team: Team, index: number): Combatant => {
    const stats = { ...definition.stats };
    if (team === 'enemies') {
      stats.maxHp = Math.max(1, Math.round(stats.maxHp * scaling.hp * difficulty.enemyHpMultiplier));
      stats.power = Math.max(0, Math.round(stats.power * scaling.damage));
    }
    const unit: Combatant = { id: `${team === 'heroes' ? 'hero' : 'enemy'}-${index + 1}-${definition.id}`, definitionId: definition.id, name: definition.name, team, stats, hp: stats.maxHp, shield: 0, cooldowns: Object.fromEntries(definition.skillIds.map(id => [id, 0])), effectCooldowns: Object.fromEntries(definition.effectIds.map(id => [id, 0])), statuses: [], turnsTaken: 0 };
    if (team === 'heroes') {
      const fresh = startHeroBody(definition);
      const savedBody = options.heroBodies?.[definition.id];
      unit.body = savedBody === undefined ? fresh : restoreHeroBody(savedBody, fresh);
      syncBodyCombatant(unit, definition);
    }
    return unit;
  };
  const heroes = options.characterIds.map((id, index) => {
    const definition = content.characters.find(candidate => candidate.id === id);
    if (!definition) throw new Error(`Unknown character: ${id}`);
    return makeUnit(definition, 'heroes', index);
  });
  const enemies = Array.from(enemyIds, (id, index) => {
    const definition = content.enemies.find(candidate => candidate.id === id);
    if (!definition) throw new Error(`Unknown enemy: ${id}`);
    return makeUnit(definition, 'enemies', index);
  });
  return { schemaVersion: SCHEMA_VERSION, contentHash: hashValue(content), seed: options.seed, encounterId: options.encounterId, characterIds: [...options.characterIds], difficultyId: difficulty.id, ...(dynamic ? { enemyIds: [...enemyIds] } : {}), status: 'ready', round: 0, turn: 0, turnOrder: [], turnIndex: 0, units: [...heroes, ...enemies], rng: createRng(options.seed), events: [], nextSequence: 1 };
}
