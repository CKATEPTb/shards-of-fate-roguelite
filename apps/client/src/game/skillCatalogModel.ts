import type { ActionDefinition, AuraVisualDefinition, SkillDefinition, StatusDefinition, TargetSelector } from '@shards/shared';
import { gameContent } from '../catalog';

export const skillFamilies: Record<AuraVisualDefinition['family'], string> = {
  blood: 'Кровь', holy: 'Свет', nature: 'Природа', shadow: 'Тень', arcane: 'Тайная магия', fire: 'Огонь', frost: 'Лёд',
  storm: 'Буря', stone: 'Камень', metal: 'Сталь', venom: 'Яд', spirit: 'Духи', time: 'Время', war: 'Война', astral: 'Астрал',
};
export const skillTargetNames: Record<string, string> = {
  self: 'Сам герой', enemy: 'Один противник', ally: 'Один союзник, включая себя',
  lowestHealthEnemy: 'Один противник; при автовыборе — самый раненый', lowestHealthAlly: 'Один союзник; при автовыборе — самый раненый',
  allAllies: 'Все союзники, включая себя', allEnemies: 'Все противники', eventTarget: 'Цель события',
  any: 'Союзник или противник, включая себя', randomEnemy: 'Случайный противник',
  randomAlly: 'Случайный союзник, включая себя', randomUnit: 'Случайный участник, включая себя',
};
export const skillKindNames = { damage: 'Урон', heal: 'Исцеление', shield: 'Щит', status: 'Аура' };
export type SkillKind = keyof typeof skillKindNames;
export interface SkillAuraLink { status: StatusDefinition; duration: number | null | undefined; onHit: boolean; target: TargetSelector; relation?: 'ally' | 'enemy'; parent?: string }

export function skillKinds(skill: SkillDefinition): SkillKind[] {
  return [...new Set(skill.actions.flatMap(action => action.onHitStatusId ? [action.type, 'status' as const] : [action.type]))];
}

export function skillTurns(value: number): string {
  const mod = value % 100, last = value % 10;
  return `${value} ${mod >= 11 && mod <= 14 ? 'ходов' : last === 1 ? 'ход' : last >= 2 && last <= 4 ? 'хода' : 'ходов'}`;
}

export function auraLinkDuration(link: SkillAuraLink): string {
  if (link.status.stacking === 'decay') return 'До исчерпания зарядов';
  if (link.duration === null) return 'Бессрочно';
  if (link.duration === undefined) return 'Срок задаёт источник';
  return `${skillTurns(link.duration)} носителя`;
}

export function skillAuraLinks(skill: SkillDefinition): SkillAuraLink[] {
  const links: SkillAuraLink[] = [];
  const visited = new Set<string>();
  const visit = (actions: readonly ActionDefinition[], parent?: string) => {
    for (const action of actions) for (const onHit of [false, true]) {
      const id = onHit ? action.onHitStatusId : action.statusId;
      if (!id || links.length >= 64) continue;
      const status = gameContent.statuses.find(candidate => candidate.id === id);
      if (!status) continue;
      links.push({ status, duration: onHit ? action.onHitDuration : action.duration,
        target: action.target ?? skill.target, relation: action.targetRelation, onHit, parent });
      if (!visited.has(id)) { visited.add(id); visit(status.actions, status.name); }
    }
  };
  visit(skill.actions);
  return links;
}

export function skillActionText(action: ActionDefinition): string {
  if (action.type === 'status') return `Накладывает «${gameContent.statuses.find(status => status.id === action.statusId)?.name ?? action.statusId}»`;
  const stat = action.scaling ? 'Сила' : undefined;
  const formula = action.damagePerStack !== undefined ? `${action.damagePerStack} × число зарядов`
    : [action.dice, stat && `${action.factor !== undefined && action.factor !== 1 ? `${action.factor} × ` : ''}${stat}`].filter(Boolean).join(' + ') || 'По правилам умения';
  return `${skillKindNames[action.type]}: ${formula}${(action.hits ?? 1) > 1 ? ` · ${action.hits} отдельных попаданий` : ''}${action.bypassArmor ? ' · игнорирует броню' : ''}`;
}

export function skillSource(skill: SkillDefinition): string {
  if (skill.tags.includes('UPGRADED')) return 'Улучшение у начертателя';
  if (skill.tags.includes('LEARNABLE')) return 'Каталог изучаемых навыков';
  const owners = [...gameContent.characters, ...gameContent.enemies].filter(unit => unit.skillIds.includes(skill.id)).map(unit => unit.name);
  return owners.length ? owners.join(', ') : 'Каталог игровых навыков';
}
