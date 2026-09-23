import type { ActionDefinition, GameContent, Modifiers, SkillDefinition, StatusDefinition, UnitDefinition } from '@shards/shared';
import { gameContent } from '../../catalog';
import { normalizeDiceExpression, type DiceRule } from '../diceNotation';

const accuracyRule: DiceRule = {
  dice: '1d20', modifiable: false,
  reason: 'Отдельная проверка попадания: натуральная 1 — промах, натуральная 20 — попадание. Для остальных граней нужно строго больше, чем Уклонение цели − Точность атакующего. Сила к проверке не добавляется.',
};
const criticalRule = (healing: boolean): DiceRule => ({
  dice: '1d20', modifiable: false,
  reason: `Отдельная проверка критического ${healing ? 'исцеления' : 'попадания'}: грань d20 ≥ 20 − Крит атакующего${healing ? '; Стойкость не учитывается' : ' + Стойкость цели'}. Натуральная 20 всегда даёт крит. Сила к этой проверке не добавляется. Крит удваивает итог ${healing ? 'исцеления' : 'урона до защиты'}, включая Силу.`,
});

/** Same rule repeated through linked statuses need not consume an extra prose occurrence. */
function uniqueRules(rules: DiceRule[]): DiceRule[] {
  const result: DiceRule[] = [];
  for (const rule of rules) {
    const normalized = normalizeDiceExpression(rule.dice);
    const previous = result.find(item => item.dice === normalized && item.modifiable === rule.modifiable);
    if (previous) {
      if (!previous.reason.includes(rule.reason)) previous.reason += ` ${rule.reason}`;
    } else result.push({ ...rule, dice: normalized });
  }
  return result;
}

export function modifierDiceRules(modifiers: Modifiers): DiceRule[] {
  const rules: DiceRule[] = [];
  const add = (dice: string | undefined, reason: string) => { if (dice) rules.push({ dice, modifiable: false, reason }); };
  add(modifiers.damageBonusDice, 'Дополнительный кубик урона добавляется к основному результату отдельно. К этому дополнительному кубику сила и плоский бонус урона повторно не прибавляются.');
  add(modifiers.partyGuardDice, 'Защитный бросок уменьшает входящий урон на выпавшее число; Сила к нему не добавляется.');
  add(modifiers.vampirismDice, 'Восстановление от вампиризма равно чистому броску и ограничено уроном здоровью врага; Сила не добавляется.');
  add(modifiers.healingShareDice, 'Передача лечения использует чистый результат этого броска; Сила не добавляется.');
  add(modifiers.preserveHot?.dice, `Проверка продления регенерации: требуется сумма броска ${modifiers.preserveHot?.atLeast ?? 0} или больше, без бонусов атрибутов.`);
  add(modifiers.preserveShield?.dice, `Проверка сохранения щита: требуется сумма броска ${modifiers.preserveShield?.atLeast ?? 0} или больше, без бонусов атрибутов.`);
  add(modifiers.repeatAttack?.dice, `Проверка повторной атаки: требуется сумма броска ${modifiers.repeatAttack?.atLeast ?? 0} или больше, без бонусов атрибутов.`);
  return uniqueRules(rules);
}

function actionRule(action: ActionDefinition): DiceRule | undefined {
  if (!action.dice || action.damagePerStack !== undefined) return undefined;
  const scaled = Boolean(action.scaling);
  const modifiable = action.type === 'damage' || scaled;
  const attribute = 'Сила источника с действующими бонусами';
  const scaling = scaled ? `${attribute}${action.factor !== undefined && action.factor !== 1 ? ` × ${action.factor}` : ''}; добавка округляется вниз` : '';
  const reason = action.type === 'damage'
    ? `К базовому броску урона применяются ${scaling ? `${scaling}, а также ` : ''}плоские бонусы урона источника.${scaled ? '' : ' Сила не добавляется, поскольку она не указана в правилах действия.'}`
    : scaled ? `К броску ${action.type === 'shield' ? 'ёмкости щита' : 'исцеления'} добавляется ${scaling}.`
      : `Фиксированный бросок ${action.type === 'shield' ? 'ёмкости щита' : 'исцеления'}: Сила и другие атрибуты не прибавляются.`;
  return { dice: action.dice, modifiable, reason };
}

function appendActions(rules: DiceRule[], actions: readonly ActionDefinition[], content: GameContent, visited: Set<string>, attackChecks: boolean): void {
  for (const action of actions) {
    const rule = actionRule(action);
    if (rule) {
      rules.push(rule);
      const matches = /^(\d+)d(\d+)$/i.exec(normalizeDiceExpression(rule.dice));
      if (matches && (action.hits ?? 1) > 1) rules.push({ ...rule, dice: `${Number(matches[1]) * action.hits!}d${matches[2]}`,
        reason: `Это ${action.hits} отдельных попаданий с броском ${rule.dice} для каждого. ${rule.reason}` });
    }
    if (attackChecks && action.type === 'damage') rules.push(accuracyRule, criticalRule(false));
    if (attackChecks && action.type === 'heal') rules.push(criticalRule(true));
    for (const statusId of [action.statusId, action.onHitStatusId]) {
      if (!statusId || visited.has(statusId) || visited.size >= 64) continue;
      const status = content.statuses.find(item => item.id === statusId);
      if (status) appendStatus(rules, status, content, visited);
    }
  }
}

function appliesStatus(actions: readonly ActionDefinition[], targetId: string, content: GameContent, visited = new Set<string>()): boolean {
  for (const action of actions) {
    for (const id of [action.statusId, action.onHitStatusId]) {
      if (!id) continue;
      if (id === targetId) return true;
      if (visited.has(id) || visited.size >= 64) continue;
      visited.add(id);
      const definition = content.statuses.find(status => status.id === id);
      if (definition && appliesStatus(definition.actions, targetId, content, visited)) return true;
    }
  }
  return false;
}

function appendStatus(rules: DiceRule[], status: StatusDefinition, content: GameContent, visited: Set<string>): void {
  if (visited.has(status.id) || visited.size >= 64) return;
  visited.add(status.id);
  appendActions(rules, status.actions, content, visited, false);
  rules.push(...modifierDiceRules(status.modifiers));
  // HOT descriptions can explain the caster's prolongation check (Regrowth does).
  if (status.tags.includes('HOT')) {
    for (const caster of [...content.characters, ...content.enemies]) {
      const actions = [caster.basicAttack,
        ...caster.skillIds.flatMap(id => content.skills.find(skill => skill.id === id)?.actions ?? []),
        ...caster.effectIds.flatMap(id => content.effects.find(effect => effect.id === id)?.actions ?? [])];
      const createsStatus = caster.modifiers.preserveHot && appliesStatus(actions, status.id, content);
      if (createsStatus && caster.modifiers.preserveHot) rules.push(...modifierDiceRules({ preserveHot: caster.modifiers.preserveHot }));
    }
  }
}

export function statusDiceRules(definition: StatusDefinition, content: GameContent = gameContent): DiceRule[] {
  const rules: DiceRule[] = [];
  appendStatus(rules, definition, content, new Set());
  return uniqueRules(rules);
}

export function skillDiceRules(skill: SkillDefinition, definition?: UnitDefinition, content: GameContent = gameContent): DiceRule[] {
  const rules: DiceRule[] = [];
  appendActions(rules, skill.actions, content, new Set(), true);
  // Prose can name a passive reaction, e.g. Paladin's healing transfer or Ranger's old repeat die.
  if (definition) rules.push(...passiveDiceRules(definition, content));
  return uniqueRules(rules);
}

export function passiveDiceRules(definition?: UnitDefinition, content: GameContent = gameContent): DiceRule[] {
  if (!definition) return [];
  const rules = modifierDiceRules(definition.modifiers);
  const visited = new Set<string>();
  for (const effectId of definition.effectIds) {
    const effect = content.effects.find(item => item.id === effectId);
    if (effect) appendActions(rules, effect.actions, content, visited, false);
  }
  // The rogue's prose discusses the opponent's hit check, not a new dodge roll.
  if (definition.modifiers.evasionBonus && /(?:1\s*)?[dд]\s*20/iu.test(definition.passive?.description ?? '')) rules.push(accuracyRule);
  return uniqueRules(rules);
}
