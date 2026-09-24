import { baseEquipmentItemId, type EquipmentSetDefinition, type HeroBody, type StarterEquipment } from '@shards/shared';
import { equipmentCondition } from '@shards/game-core';
import { EquipmentIcon } from '../EquipmentIcon';
import { DiceText } from '../DiceText';
import { modifierDiceRules } from './diceRules';
import { rewardSlotNames } from './rewardPresentation';
import './rewardSetSummary.css';

export interface EquipmentSetComparisonContext {
  equipment: readonly StarterEquipment[];
  body?: HeroBody;
  /** The other outfit's position relative to the outfit shown in this item card. */
  direction: 'before' | 'after';
}

export interface RewardSetSummaryProps {
  set: EquipmentSetDefinition;
  item: StarterEquipment;
  equipment: readonly StarterEquipment[];
  body?: HeroBody;
  compareWith?: EquipmentSetComparisonContext;
}

function activePieces(setId: string, equipment: readonly StarterEquipment[], body?: HeroBody) {
  // Matches the combat rules: duplicate catalogue IDs count once, inactive gear not at all.
  return new Set(equipment.filter(item => item.id && item.setId === setId
    && (!body || equipmentCondition(item, body).active)).map(item => baseEquipmentItemId(item.id!))).size;
}

/** An item's own set, with every threshold and its participating outfit visible. */
export function RewardSetSummary({ set, item, equipment, body, compareWith }: RewardSetSummaryProps) {
  const pieces = activePieces(set.id, equipment, body);
  const otherPieces = compareWith ? activePieces(set.id, compareWith.equipment, compareWith.body) : pieces;
  const beforePieces = compareWith?.direction === 'before' ? otherPieces : pieces;
  const afterPieces = compareWith?.direction === 'after' ? otherPieces : pieces;
  const milestones = [...(set.bonuses ?? [])].sort((a, b) => a.pieces - b.pieces).map(bonus => {
    const before = beforePieces >= bonus.pieces, after = afterPieces >= bonus.pieces;
    const change = before === after ? after ? 'active' : 'inactive' : after ? 'gain' : 'loss';
    const status = change === 'gain' ? 'Активируется' : change === 'loss' ? 'Будет потерян' : after ? 'Активен' : 'Неактивен';
    return { bonus, change, status };
  });
  const sameItem = (entry: StarterEquipment) => entry.id === item.id && entry.slot === item.slot;
  const inspectedEquipped = equipment.find(sameItem);
  const counted = new Set<string>();
  if (inspectedEquipped?.id && (!body || equipmentCondition(inspectedEquipped, body).active)) counted.add(baseEquipmentItemId(inspectedEquipped.id));
  const members = equipment.filter(entry => entry.setId === set.id && !sameItem(entry)).map(entry => {
    const active = !!entry.id && (!body || equipmentCondition(entry, body).active);
    const duplicate = active && counted.has(baseEquipmentItemId(entry.id!));
    if (active) counted.add(baseEquipmentItemId(entry.id!));
    return { entry, active, duplicate };
  });
  if (!milestones.length) return null;
  return <section className="reward-set-summary" aria-label={`Комплект: ${set.name}`}>
    <div className="reward-set-summary-name"><strong>{set.name}</strong>
      <span aria-label={compareWith ? `Действующих частей: ${beforePieces}, после замены: ${afterPieces}` : `Действующих частей: ${pieces}`}>
        Частей: {compareWith ? <>{beforePieces} <span aria-hidden="true">→</span> <b>{afterPieces}</b></> : <b>{pieces}</b>}
      </span>
    </div>
    <div className="reward-set-explanations">{milestones.map(({ bonus, change, status }) => <article key={bonus.pieces} data-state={change}>
      <div className="reward-set-bonus-title">
        <span className="reward-set-milestone" aria-label={`Предметов: ${bonus.pieces}`}><b>{bonus.pieces}</b><span aria-hidden="true">{change === 'gain' ? '+' : change === 'loss' ? '−' : change === 'active' ? '✓' : '·'}</span></span>
        <div><strong>{bonus.aura?.name ?? bonus.name}</strong><small>{status}</small></div>
      </div>
      <p><DiceText text={bonus.aura?.description || bonus.description} rules={modifierDiceRules(bonus.aura?.modifiers ?? bonus.modifiers)} /></p>
    </article>)}</div>
    {!!members.length && <div className="reward-set-members">
      <span className="reward-set-members-label">{compareWith?.direction === 'before' ? 'Другие части после замены' : 'Другие надетые части'}</span>
      <ul>{members.map(({ entry, active, duplicate }) => <li key={`${entry.slot}:${entry.id}`} data-active={active && !duplicate}>
        <EquipmentIcon item={entry} size={26} />
        <div><strong>{entry.name}</strong><small>{rewardSlotNames[entry.slot]}{!active ? ' · не действует' : duplicate ? ' · копия, не добавляет часть' : ''}</small></div>
        <span className="reward-set-member-mark" aria-label={!active ? 'Не участвует в бонусах' : duplicate ? 'Уже учтён такой предмет' : 'Участвует в бонусах'}>{active && !duplicate ? '✓' : '·'}</span>
      </li>)}</ul>
    </div>}
  </section>;
}
