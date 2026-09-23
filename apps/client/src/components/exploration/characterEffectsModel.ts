import type { ActiveStatus, Combatant, DiceCheck, GameContent, Modifiers, ShieldLayer, StatusDefinition } from '@shards/shared';
import { gameContent } from '../../catalog';
import { unitAuras } from '../StatusBadges';
import { isBodyAlive } from '@shards/game-core';
import { equipmentAurasFor, equipmentModifierSources } from '../../game/equipmentAuras';

export interface CharacterEffectLayer { sourceId?: string; sourceName: string; remaining: number | null; stacks: number; capacity?: number; bonus?: string }
export interface CharacterEffectBonus { text: string; overridden?: boolean }
export interface CharacterEffect {
  id: string; icon: string; name: string; description: string; timing: string;
  negative: boolean; color: string; stacks: number; duration: string;
  layers: CharacterEffectLayer[]; bonuses: CharacterEffectBonus[]; definition?: StatusDefinition;
  sources: Combatant[]; decay?: boolean;
}

const signed = (value: number): string => `${value >= 0 ? '+' : '−'}${Math.abs(value)}`;
const definitionFor = (unit: Combatant, content: GameContent) => [...content.characters, ...content.enemies].find(definition => definition.id === unit.definitionId);
const statusFor = (id: string, content: GameContent) => content.statuses.find(definition => definition.id === id);
const numberModifiers: Partial<Record<keyof Modifiers, string>> = {
  damageBonus: 'К урону', damageReduction: 'Поглощение урона', partyDamageReduction: 'Защита отряда',
  evasionBonus: 'Уклонение', initiativeBonus: 'Инициатива', agilityBonus: 'Проворность',
  accuracyBonus: 'Точность', critBonus: 'Крит', armorBonus: 'Броня', powerBonus: 'Сила',
  resilienceBonus: 'Стойкость', luckBonus: 'Удача',
};
const specialModifiers: Partial<Record<keyof Modifiers, string>> = {
  vampirismDice: 'Вампиризм', healingShareDice: 'Общее исцеление', preserveHot: 'Продление регенерации',
  preserveShield: 'Сохранение щита', repeatAttack: 'Повтор атаки', partyGuardDice: 'Защитный бросок',
};

function sourceNumber(source: Combatant, key: keyof Modifiers, content: GameContent): number {
  return [definitionFor(source, content)?.modifiers, ...equipmentModifierSources(source, definitionFor(source, content)), ...source.statuses.map(status => statusFor(status.id, content)?.modifiers)]
    .reduce((sum, modifiers) => sum + (typeof modifiers?.[key] === 'number' ? modifiers[key] as number : 0), 0);
}

function sourceShieldCheck(source: Combatant, content: GameContent): DiceCheck | undefined {
  if (source.escaped || (source.body ? !isBodyAlive(source.body) : source.hp <= 0)) return undefined;
  let check = definitionFor(source, content)?.modifiers.preserveShield;
  for (const modifiers of equipmentModifierSources(source, definitionFor(source, content))) check = modifiers.preserveShield ?? check;
  for (const status of source.statuses) check = statusFor(status.id, content)?.modifiers.preserveShield ?? check;
  return check;
}

/** Source stats are evaluated as the combat action does; never use the bearer's Power. */
function sourceBonus(definition: StatusDefinition | undefined, source: Combatant | undefined, content: GameContent): string | undefined {
  if (!definition || !source) return undefined;
  const bonuses = definition.actions.flatMap(action => {
    if (action.damagePerStack !== undefined) return [];
    const labels: string[] = [];
    if (action.scaling) {
      const stat = Math.max(0, source.stats.power + sourceNumber(source, 'powerBonus', content));
      const amount = Math.floor(stat * (action.factor ?? 1));
      if (amount !== 0) labels.push(`Сила (${source.name}): ${signed(amount)} к броску`);
    }
    if (action.type === 'damage') {
      const flat = sourceNumber(source, 'damageBonus', content);
      if (flat) labels.push(`Эффекты (${source.name}): ${signed(flat)} к урону`);
    }
    return labels;
  });
  return [...new Set(bonuses)].join('; ') || undefined;
}

export function effectTurns(remaining: number | null): string {
  if (remaining === null) return 'Бессрочно';
  const mod = remaining % 100, last = remaining % 10;
  const form = mod >= 11 && mod <= 14 ? 'ходов' : last === 1 ? 'ход' : last >= 2 && last <= 4 ? 'хода' : 'ходов';
  return `${remaining} ${form}`;
}

/** Both finite and indefinite layers remain visible in a grouped effect. */
function durationLabel(layers: readonly CharacterEffectLayer[], definition?: StatusDefinition): string {
  if (definition?.stacking === 'decay') return 'До исчерпания зарядов';
  const finite = layers.flatMap(layer => layer.remaining === null ? [] : [layer.remaining]);
  const indefinite = layers.some(layer => layer.remaining === null);
  if (!finite.length) return 'Бессрочно';
  const min = Math.min(...finite), max = Math.max(...finite);
  const finiteLabel = definition?.expiresAt === 'TURN_STARTED' && max === 1 ? 'До начала следующего хода'
    : min === max ? effectTurns(min) : `${min}–${max} ходов`;
  return `${finiteLabel}${indefinite ? ' + бессрочно' : ''}`;
}

function effectBonuses(unit: Combatant, definition: StatusDefinition | undefined, instances: number, content: GameContent): CharacterEffectBonus[] {
  if (!definition) return [];
  const result: CharacterEffectBonus[] = [];
  for (const [key, name] of Object.entries(numberModifiers)) {
    const value = definition.modifiers[key as keyof Modifiers];
    if (typeof value === 'number' && value !== 0) result.push({ text: `${name}: ${signed(value * instances)}${instances > 1 ? ` (${signed(value)} × ${instances})` : ''}` });
  }
  if (definition.modifiers.damageBonusDice) result.push({ text: `К каждому прямому удару: +${definition.modifiers.damageBonusDice}${instances > 1 ? ` от каждого из ${instances} слоёв` : ''}` });
  if (definition.modifiers.guaranteedCrit) result.push({ text: 'Прямые попадания и исцеления критические: итог ×2' });
  if (definition.modifiers.invulnerable) result.push({ text: 'Полное блокирование входящего урона' });
  if (definition.modifiers.taunt) result.push({ text: 'Привлекает все атаки врагов' });
  for (const [key, name] of Object.entries(specialModifiers)) {
    const value = definition.modifiers[key as keyof Modifiers];
    if (!value) continue;
    const latest = [...unit.statuses].reverse().find(status => statusFor(status.id, content)?.modifiers[key as keyof Modifiers] !== undefined);
    const replaced = latest && latest.id !== definition.id ? statusFor(latest.id, content)?.name : undefined;
    const rule = typeof value === 'string' ? value : typeof value === 'object' ? `${value.dice}, успех на ${value.atLeast}+` : '';
    result.push({ text: replaced ? `${name}: сейчас действует «${replaced}»` : `${name}: ${rule}`, overridden: !!replaced });
  }
  return result;
}

function statusEffect(unit: Combatant, id: string, roster: readonly Combatant[], content: GameContent): CharacterEffect {
  const aura = unitAuras(unit, roster, content).find(group => group.id === id)!;
  const definition = statusFor(id, content);
  const instances = unit.statuses.filter(status => status.id === id);
  const sources = [...new Set(instances.map(status => status.sourceId))].flatMap(sourceId => roster.find(source => source.id === sourceId) ?? []);
  const layers = instances.map((status: ActiveStatus): CharacterEffectLayer => {
    const source = roster.find(candidate => candidate.id === status.sourceId);
    return { sourceId: status.sourceId, sourceName: source?.name ?? 'Источник неизвестен', remaining: status.remaining,
      stacks: status.stacks ?? 1, bonus: sourceBonus(definition, source, content) };
  });
  const timing = definition?.trigger === 'TURN_STARTED' ? 'Срабатывает в начале собственного хода'
    : definition?.trigger === 'TURN_ENDED' ? 'Срабатывает в конце собственного хода'
    : definition?.expiresAt === 'TURN_STARTED' ? 'Действует до начала своего хода' : 'Действует, пока наложен эффект';
  return { id, icon: aura.icon, name: aura.name, description: aura.description, color: aura.color, negative: aura.negative,
    stacks: layers.reduce((sum, layer) => sum + layer.stacks, 0), definition, sources, layers,
    duration: durationLabel(layers, definition), timing, bonuses: effectBonuses(unit, definition, instances.length, content), decay: definition?.stacking === 'decay' };
}

function shieldEffects(unit: Combatant, roster: readonly Combatant[], content: GameContent): CharacterEffect[] {
  if (unit.shield <= 0) return [];
  const layers = (unit.shieldLayers ?? []).filter(layer => layer.capacity > 0);
  const bone = layers.filter(layer => roster.find(source => source.id === layer.sourceId)?.definitionId === 'necromancer');
  const permanent = Math.max(0, unit.shield - layers.reduce((sum, layer) => sum + layer.capacity, 0));
  const make = (id: string, name: string, records: ShieldLayer[], untimed = 0): CharacterEffect | undefined => {
    if (!records.length && untimed <= 0) return undefined;
    const sources = [...new Set(records.map(layer => layer.sourceId))].flatMap(sourceId => roster.find(source => source.id === sourceId) ?? []);
    const list: CharacterEffectLayer[] = records.map(layer => ({ sourceId: layer.sourceId,
      sourceName: roster.find(source => source.id === layer.sourceId)?.name ?? 'Источник неизвестен',
      remaining: layer.remaining, stacks: 1, capacity: layer.capacity }));
    if (untimed > 0) list.push({ sourceName: 'Слой без ограничения срока', remaining: null, stacks: 1, capacity: untimed });
    const capacity = list.reduce((sum, layer) => sum + (layer.capacity ?? 0), 0);
    const checks = sources.flatMap(source => {
      const check = sourceShieldCheck(source, content);
      return check ? [{ text: `${source.name}: ${check.dice}, на ${check.atLeast}+ поглощает весь оставшийся удар без расхода своего щита` }] : [];
    });
    return { id, icon: id, name, color: id === 'bone_shield' ? '#b9d6ba' : '#a7d9dc', negative: false,
      description: `Поглощает ещё ${capacity} ед. урона. Сначала расходуются слои с ближайшим сроком завершения.`,
      timing: 'При получении урона; срок слоёв уменьшается в конце своего хода',
      duration: durationLabel(list), stacks: list.length, layers: list, bonuses: checks, sources };
  };
  return [make('bone_shield', 'Костяной щит', bone), make('shield', 'Защитный щит', layers.filter(layer => !bone.includes(layer)), permanent)]
    .filter((entry): entry is CharacterEffect => !!entry);
}

/** Combat auras and currently sustained equipment auras; catalogue entries alone do not activate them. */
export function characterEffects(unit: Combatant | undefined, roster: readonly Combatant[], active: boolean, content: GameContent = gameContent): CharacterEffect[] {
  if (!active || !unit || unit.escaped || (unit.body ? !isBodyAlive(unit.body) : unit.hp <= 0)) return [];
  const equipment: CharacterEffect[] = equipmentAurasFor(unit, definitionFor(unit, content)).map(({ id, aura, setName, status, timing }) => ({
    id, icon: id, name: aura.name, description: aura.description, timing,
    negative: false, color: aura.visual.colors[1], stacks: 1, duration: 'Пока собран комплект',
    definition: status, layers: [{ sourceId: unit.id, sourceName: setName, remaining: null, stacks: 1 }],
    bonuses: effectBonuses(unit, status, 1, content), sources: [unit],
  }));
  return [...new Set(unit.statuses.map(status => status.id))].map(id => statusEffect(unit, id, roster, content)).concat(equipment, shieldEffects(unit, roster, content));
}
