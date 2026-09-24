import type { GameContent } from '@shards/shared';
import { hashValue } from './canonical';

const hasteText = '+2 к уклонению. +3 к проворности при побеге.';
const previousHasteText = '+5 к следующему броску инициативы; уже определённую очередь не перестраивает.';
const skillText = 'Даёт союзнику Ускорение на 3 хода: Проворность для побега +3, Уклонение +2. Само действие побега не выполняется; текущая очередь ходов сохраняется.';
const previousSkillText = 'Даёт союзнику Последнее мгновение на 2 хода: Проворность для побега +6, Уклонение +1. Само действие побега не выполняется.';

/** Compare only the two authored changes; fitted loadouts and all other rules must still match. */
export function isBeforeCatalogAvailability(value: unknown, content: GameContent): boolean {
  const haste = content.statuses.find(status => status.id === 'haste');
  const skill = content.skills.find(skill => skill.id === 'exit_between_heartbeats');
  if (!haste || !skill || !haste.description.startsWith(hasteText) || skill.description !== skillText
    || hashValue(haste.modifiers) !== hashValue({ agilityBonus: 3, evasionBonus: 2 })
    || hashValue(skill.actions) !== hashValue([{ type: 'status', statusId: 'haste', duration: 3 }])) return false;
  const previous: GameContent = { ...content,
    statuses: content.statuses.map(status => status !== haste ? status : { ...status,
      description: status.description.replace(hasteText, previousHasteText), modifiers: { initiativeBonus: 5 } }),
    skills: content.skills.map(entry => entry !== skill ? entry : { ...entry, description: previousSkillText,
      actions: [{ type: 'status', statusId: 'last_instant', duration: 2 }] }),
  };
  return value === hashValue(previous);
}
