import type { ActionDefinition, Modifiers, StatusDefinition } from '@shards/shared';
import { auraVisual, type AuraDesign, type AuraFamily } from './aura-profiles';

interface AuraOptions {
  duration?: number | null;
  stacking?: 'independent' | 'refresh';
  polarity?: 'positive' | 'negative';
  visual?: AuraDesign;
  tags?: string[];
  note?: string;
}
interface AuraDraft extends Omit<StatusDefinition, 'schemaVersion' | 'color' | 'visual'> { design?: AuraDesign }
const signed = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value)}`;

function modifierText(modifiers: Modifiers): string[] {
  const lines: string[] = [];
  const numeric: Array<[keyof Modifiers, string]> = [
    ['accuracyBonus', 'к Точности: снижает Уклонение цели'], ['critBonus', 'к Критическому удару: снижает порог отдельного 1d20'],
    ['armorBonus', 'к Защите каждой части тела'], ['powerBonus', 'к Силе носителя; влияет также на его щиты, если действие прибавляет Силу'],
    ['evasionBonus', 'к уклонению'], ['initiativeBonus', 'к следующему броску инициативы; уже определённую очередь не перестраивает'], ['agilityBonus', 'к проворности при побеге'],
    ['damageBonus', 'к броскам урона'], ['resilienceBonus', 'к Стойкости'], ['luckBonus', 'к Удаче'],
  ];
  for (const [key, label] of numeric) if (typeof modifiers[key] === 'number') lines.push(`${signed(modifiers[key] as number)} ${label}.`);
  if (modifiers.damageBonusDice) lines.push(`Каждый прямой удар получает отдельный дополнительный бросок ${modifiers.damageBonusDice} к урону.`);
  if (modifiers.damageReduction) lines.push(`Входящий урон после брони уменьшается на ${modifiers.damageReduction}; урон, игнорирующий броню, обходит это уменьшение.`);
  if (modifiers.partyDamageReduction) lines.push(`Урон после брони по каждому живому участнику отряда носителя уменьшается на ${modifiers.partyDamageReduction}, пока носитель в строю; урон, игнорирующий броню, обходит это уменьшение.`);
  if (modifiers.partyGuardDice) lines.push(`Когда после брони и полного блокирования остаётся урон прямого удара по живому участнику отряда, включая себя, носитель бросает ${modifiers.partyGuardDice} и уменьшает урон на результат, вплоть до нуля. При нулевом уроне проверки нет.`);
  if (modifiers.vampirismDice) lines.push(`После прямого урона здоровью врага носитель лечится на ${modifiers.vampirismDice}, не больше нанесённого урона.`);
  if (modifiers.healingShareDice) lines.push(`Получив реальное исцеление, носитель бросает ${modifiers.healingShareDice} и лечит на результат всех живых участников своего отряда, включая себя. Переданное лечение не запускает новую передачу.`);
  if (modifiers.preserveHot) lines.push(`После тика наложенного носителем периодического исцеления с конечным сроком бросает ${modifiers.preserveHot.dice}: на ${modifiers.preserveHot.atLeast}+ продлевает этот заряд на 1 ход, пока носитель в строю. Обычное уменьшение срока в конце хода сохраняется.`);
  if (modifiers.preserveShield) lines.push(`Когда созданный носителем временный щит должен тратить ёмкость, бросает ${modifiers.preserveShield.dice}: на ${modifiers.preserveShield.atLeast}+ весь оставшийся урон поглощается без расхода ёмкости, пока носитель в строю.`);
  if (modifiers.repeatAttack) lines.push(`После действия с уроном бросает ${modifiers.repeatAttack.dice}: на ${modifiers.repeatAttack.atLeast}+ повторяет базовую атаку по той же живой цели. Повтор не запускает новую цепочку.`);
  if (modifiers.guaranteedCrit) lines.push('Каждое прямое попадание критическое; враг всё ещё может уклониться.');
  if (modifiers.taunt) lines.push('Враги обязаны атаковать носителя, в том числе вместо атаки по всему отряду. При нескольких провокациях действует последняя.');
  if (modifiers.invulnerable) lines.push('Полностью блокирует входящий урон, включая урон периодических эффектов.');
  if (modifiers.vampirismDice || modifiers.healingShareDice || modifiers.preserveHot || modifiers.preserveShield || modifiers.repeatAttack || modifiers.partyGuardDice) {
    lines.push('Для каждого такого особого правила используется последний активный источник: его кубик и порог заменяют предыдущие, а не дают дополнительные проверки.');
  }
  return lines;
}

function durationText(options: AuraOptions): string {
  const duration = options.duration === undefined ? 3 : options.duration;
  const ending = duration === null ? 'Бессрочно, пока эффект не снят.' : `Обычная длительность: ${duration} ${duration === 1 ? 'собственный ход' : duration < 5 ? 'собственных хода' : 'собственных ходов'} носителя; уменьшается в конце его хода, кроме хода наложения.`;
  return `${ending} ${options.stacking === 'independent' ? 'Каждый заряд имеет отдельную длительность; числовые бонусы и действия зарядов складываются.' : 'Повторное наложение тем же источником обновляет срок, если новый срок не короче оставшегося, не создавая второй заряд.'}`;
}

export function buff(id: string, name: string, modifiers: Modifiers, options: AuraOptions = {}): AuraDraft {
  return { id, name, description: [...modifierText(modifiers), options.note, durationText(options)].filter(Boolean).join(' '),
    actions: [], modifiers, tags: ['CATALOG', options.polarity === 'negative' ? 'DEBUFF' : 'BUFF', ...(options.tags ?? [])],
    polarity: options.polarity ?? 'positive', stacking: options.stacking ?? 'refresh',
    defaultDuration: options.duration === undefined ? 3 : options.duration, design: options.visual };
}

/** Periodic dice always belong to the aura's source; self targets its bearer. */
export function tick(id: string, name: string, type: 'damage' | 'heal' | 'shield', dice: string,
  phase: 'TURN_STARTED' | 'TURN_ENDED', options: AuraOptions & { bypassArmor?: boolean; healingScale?: boolean; shieldDuration?: number; modifiers?: Modifiers } = {}): AuraDraft {
  const action: ActionDefinition = { type, dice, target: 'self', ...(options.bypassArmor ? { bypassArmor: true } : {}),
    ...(options.healingScale ? { scaling: 'power', factor: 1 } : {}), ...(type === 'shield' ? { duration: options.shieldDuration ?? 1 } : {}) };
  const when = phase === 'TURN_STARTED' ? 'В начале' : 'В конце';
  const amount = `${dice}${options.healingScale ? ' + Сила источника' : ''}`;
  const effect = type === 'damage'
    ? `${when} собственного хода каждый заряд наносит носителю ${amount} + плоский бонус к урону источника${options.bypassArmor ? ', игнорируя броню' : '; броня носителя уменьшает урон'}.`
    : type === 'heal' ? `${when} собственного хода каждый заряд восстанавливает носителю ${amount} здоровья.`
    : `${when} собственного хода каждый заряд создаёт на носителе отдельный слой щита ёмкостью ${amount}; начальный остаток срока слоя — ${options.shieldDuration ?? 1} ход. Остаток уменьшается в конце ходов получателя, кроме хода создания слоя. Слой может сохраняться после исчезновения ауры.`;
  const settings = { ...options, stacking: options.stacking ?? 'independent' as const };
  const draft = buff(id, name, options.modifiers ?? {}, settings);
  return { ...draft, description: [effect, 'В ход наложения периодическое действие не срабатывает.', ...modifierText(options.modifiers ?? {}), options.note, durationText(settings)].filter(Boolean).join(' '),
    trigger: phase, actions: [action], polarity: options.polarity ?? (type === 'damage' ? 'negative' : 'positive'),
    tags: ['CATALOG', type === 'damage' ? 'DOT' : type === 'heal' ? 'HOT' : 'SHIELD', ...(options.tags ?? [])] };
}

export function auraGroup(family: AuraFamily, offset: number, entries: AuraDraft[]): StatusDefinition[] {
  return entries.map(({ design, ...entry }, index) => {
    const visual = auraVisual(family, offset + index, design);
    return { schemaVersion: 1, ...entry, color: visual.colors[1], visual, tags: [...entry.tags, family.toUpperCase()] };
  });
}
