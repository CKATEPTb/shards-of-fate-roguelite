import type { ActionDefinition, GameContent } from '@shards/shared';

export interface ValidationIssue { path: string; message: string }

/** Structural references only; gameplay and event execution remain in game-core. */
export function validateReferences(content: GameContent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const report = (path: string, message: string) => issues.push({ path, message });
  const ids = {
    skills: new Set(content.skills.map(({ id }) => id)),
    effects: new Set(content.effects.map(({ id }) => id)),
    statuses: new Set(content.statuses.map(({ id }) => id)),
    enemies: new Set(content.enemies.map(({ id }) => id)),
  };
  const unique = (values: string[], path: string) => {
    const seen = new Set<string>();
    values.forEach((id, index) => {
      if (seen.has(id)) report(`${path}[${index}]`, `Duplicate identifier: ${id}`);
      seen.add(id);
    });
  };
  const references = (values: string[], known: Set<string>, path: string) => {
    values.forEach((id, index) => {
      if (!known.has(id)) report(`${path}[${index}]`, `Unknown reference: ${id}`);
    });
  };
  const actions = (values: ActionDefinition[], path: string, periodic = false, eventContext = false) => {
    values.forEach((action, index) => {
      if (action.statusId && !ids.statuses.has(action.statusId)) {
        report(`${path}[${index}].statusId`, `Unknown status: ${action.statusId}`);
      }
      if (action.onHitStatusId && !ids.statuses.has(action.onHitStatusId)) {
        report(`${path}[${index}].onHitStatusId`, `Unknown status: ${action.onHitStatusId}`);
      }
      if (action.damagePerStack !== undefined && !periodic) {
        report(`${path}[${index}].damagePerStack`, 'Aura stacks are available only to periodic status actions');
      }
      if (action.scaleWithRemainingDuration && !periodic) {
        report(`${path}[${index}].scaleWithRemainingDuration`, 'Remaining duration is available only to periodic status actions');
      }
      if (action.target === 'eventTarget' && !eventContext) {
        report(`${path}[${index}].target`, 'eventTarget is available only to triggered effects');
      }
    });
  };

  for (const collection of ['characters', 'enemies', 'skills', 'effects', 'statuses', 'encounters'] as const) {
    unique(content[collection].map(({ id }) => id), `${collection}.id`);
  }
  const heroIds = new Set(content.characters.map(({ id }) => id));
  content.enemies.forEach((enemy, index) => {
    if (heroIds.has(enemy.id)) report(`enemies[${index}].id`, `Enemy and character identifiers conflict: ${enemy.id}`);
  });
  for (const collection of ['characters', 'enemies'] as const) {
    content[collection].forEach((unit, index) => {
      const path = `${collection}[${index}]`;
      unique(unit.skillIds, `${path}.skillIds`);
      unique(unit.effectIds, `${path}.effectIds`);
      references(unit.skillIds, ids.skills, `${path}.skillIds`);
      references(unit.effectIds, ids.effects, `${path}.effectIds`);
      actions([unit.basicAttack], `${path}.basicAttack`);
      if (unit.basicAttack.type !== 'damage') report(`${path}.basicAttack.type`, 'A basic attack must deal damage');
    });
  }
  content.skills.forEach((skill, index) => {
    if (skill.target === 'eventTarget') report(`skills[${index}].target`, 'A skill has no triggering event target');
    actions(skill.actions, `skills[${index}].actions`);
  });
  content.effects.forEach((effect, index) => {
    unique(effect.conditions, `effects[${index}].conditions`);
    actions(effect.actions, `effects[${index}].actions`, false, true);
    const needsTarget = effect.target === 'eventTarget' || effect.actions.some((action) => action.target === 'eventTarget');
    if (needsTarget && ['COMBAT_STARTED', 'COMBAT_ENDED', 'ROUND_STARTED', 'TURN_STARTED', 'TURN_ENDED'].includes(effect.trigger)) {
      report(`effects[${index}].target`, `Event ${effect.trigger} has no target`);
    }
  });
  content.statuses.forEach((status, index) => actions(status.actions, `statuses[${index}].actions`, true));
  content.encounters.forEach((encounter, index) => references(encounter.enemyIds, ids.enemies, `encounters[${index}].enemyIds`));
  return issues;
}
