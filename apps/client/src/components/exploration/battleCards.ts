import type { Combatant, GameContent, SkillDefinition } from '@shards/shared';
import { canBodyAct, isBodyAlive } from '@shards/game-core';
import { findDefinition, gameContent } from '../../catalog';
import type { BattleCard } from './BattleHand';
import { equipmentModifierSources } from '../../game/equipmentAuras';

function formulaFor(skill: SkillDefinition, actor: Combatant, content: GameContent): string {
  if (skill.actions.some(action => action.targetRelation)) {
    const dice = [...new Set(skill.actions.flatMap(action => action.dice ? [action.dice] : []))];
    return dice.length ? `${dice.join(' / ')} · по цели` : 'Эффект по цели';
  }
  const action = skill.actions[0];
  if (!action) return 'Особое действие';
  const status = content.statuses.find(item => item.id === action.statusId);
  const roll = action.dice ? action : status?.actions.find(item => item.dice);
  if (roll?.dice) {
    const definition = findDefinition(actor.definitionId, content);
    const sources = [definition.modifiers, ...equipmentModifierSources(actor, definition),
      ...actor.statuses.map(item => content.statuses.find(definition => definition.id === item.id)?.modifiers)];
    const power = sources.reduce((sum, modifiers) => sum + (modifiers?.powerBonus ?? 0), 0);
    const damage = sources.reduce((sum, modifiers) => sum + (modifiers?.damageBonus ?? 0), 0);
    const stat = roll.scaling ? Math.max(0, actor.stats.power + power) : 0;
    const bonus = Math.floor(stat * (roll.factor ?? 1)) + (roll.type === 'damage' ? damage : 0);
    return `${(roll.hits ?? 1) > 1 ? `${roll.hits} × ` : ''}${roll.dice}${bonus ? ` ${bonus < 0 ? '−' : '+'} ${Math.abs(bonus)}` : ''}`;
  }
  const duration = action.duration ? `${action.duration} ${action.duration === 1 ? 'ход' : 'хода'}` : '';
  if (status?.modifiers.damageBonusDice) return `+${status.modifiers.damageBonusDice} · ${duration}`;
  if (status?.modifiers.repeatAttack) return `${status.modifiers.repeatAttack.dice} ≥ ${status.modifiers.repeatAttack.atLeast}`;
  if (status?.modifiers.guaranteedCrit) return `Крит · ${duration}`;
  if (status?.modifiers.invulnerable) return `Защита · ${duration}`;
  return duration || 'Особое действие';
}

export function cardsForActor(actor: Combatant, content: GameContent = gameContent): BattleCard[] {
  const definition = findDefinition(actor.definitionId, content);
  const canAct = !actor.body || canBodyAct(actor.body);
  const available = (actor.body ? isBodyAlive(actor.body) : actor.hp > 0) && !actor.escaped;
  const cards: BattleCard[] = [{
    id: 'attack', name: 'Атака', art: 'sure_strike', formula: '1d20 · попадание', targetLabel: 'Противник',
    description: 'Атака выбранного противника. С двумя одноручными оружиями — по одному удару каждой рукой. Попадание: грань 1d20 строго выше Уклонения цели − Точности; натуральная 1 — промах, 20 — попадание. Крит: отдельный 1d20 ≥ 20 − Крит + Стойкость цели; натуральная 20 всегда даёт крит. Крит удваивает готовый урон, включая Силу, до защиты.',
    cooldown: 0, totalCooldown: 0, available: available && canAct, tone: 'attack', choice: { type: 'attack', actorId: actor.id },
  }];
  definition.skillIds.forEach(id => {
    const skill = content.skills.find(item => item.id === id);
    if (!skill) return;
    const hostile = ['enemy', 'lowestHealthEnemy', 'allEnemies', 'randomEnemy'].includes(skill.target)
      || ['any', 'randomUnit'].includes(skill.target) && skill.actions.some(action => action.type === 'damage');
    const targetLabel = skill.target === 'self' ? 'На себя' : skill.target === 'allAllies' ? 'Весь отряд'
      : skill.target === 'allEnemies' ? 'Все враги' : skill.target === 'any' ? 'Любой участник'
      : skill.target === 'randomEnemy' ? 'Случайный враг'
      : skill.target === 'randomAlly' ? 'Случайный союзник'
      : skill.target === 'randomUnit' ? 'Случайная цель'
      : hostile ? 'Противник' : 'Союзник';
    cards.push({
      id: skill.id, name: skill.name, art: skill.id, formula: formulaFor(skill, actor, content), targetLabel, rarity: skill.rarity,
      description: `${skill.description}${skill.target.startsWith('random') ? ' Слегка потяните карту и отпустите вне зоны отмены: цель определит кубик.' : ''}`,
      cooldown: actor.cooldowns[id] ?? 0, totalCooldown: skill.cooldown,
      available: available && canAct && !(actor.cooldowns[id] ?? 0), tone: hostile ? 'attack' : 'support',
      choice: { type: 'skill', actorId: actor.id, skillId: skill.id },
    });
  });
  cards.push({
    id: 'flee', name: 'Сбежать', art: 'evasion', formula: '1d20 + проворность', targetLabel: 'На себя',
    description: 'Слегка потяните карту и отпустите вне зоны отмены. 1d20 + проворность − уровень сильнейшего живого врага ≥ 15. Попытка расходует ход; сбегает только этот герой.',
    cooldown: 0, totalCooldown: 0, available, tone: 'escape', choice: { type: 'flee', actorId: actor.id },
  });
  return cards;
}
