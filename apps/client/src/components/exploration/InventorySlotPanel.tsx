import { useMemo, useRef, useState } from 'react';
import { BODY_PARTS, type GameContent, type HeroBody, type HeroProgress, type InventoryTarget, type UnitDefinition } from '@shards/shared';
import { previewInventoryEquip } from '@shards/game-core';
import { equipItem, EQUIPMENT_SETS } from '@shards/game-data';
import { DiceText } from '../DiceText';
import { EquipmentIcon } from '../EquipmentIcon';
import { EquipmentRarityBadge } from '../EquipmentRarity';
import type { CharacterAttribute, LoadoutSlot } from './loadoutModel';
import { LoadoutIcon } from './LoadoutIcon';
import { RewardComparison } from './RewardComparison';
import { RewardEquipmentDetails } from './RewardEquipmentDetails';
import { RewardSetSummary } from './RewardSetSummary';
import { compareRewardEquipment } from './rewardComparisonModel';
import { canFitReward } from './rewardFitting';
import { equipmentStats, RewardArt, rewardAttributes, rewardName, rewardSlotNames, signed } from './rewardPresentation';
import './inventorySlotPanel.css';

export interface InventorySlotPanelProps {
  slot: LoadoutSlot;
  target: InventoryTarget;
  hero: UnitDefinition;
  progress: HeroProgress;
  body?: HeroBody;
  content: GameContent;
  attributes: readonly CharacterAttribute[];
  onEquip(inventoryId: string, target: InventoryTarget): boolean;
  onClose(): void;
}

/** A slot owns its candidate list; selecting a different candidate never equips it. */
export function InventorySlotPanel({ slot, target, hero, progress, body, content, attributes, onEquip, onClose }: InventorySlotPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const currentCard = useRef<HTMLElement>(null);
  const lostParts = BODY_PARTS.map(part => body?.[part].lost ? '1' : '0').join('');
  // Eligibility depends on lost parts, not the frequent health ticks while resting.
  const candidates = useMemo(() => (progress.inventory ?? []).filter(reward => canFitReward(reward, target)).map(reward => {
    try {
      previewInventoryEquip(progress, reward.id, target, content, body);
      return { reward, reason: '' };
    } catch (error) {
      return { reward, reason: error instanceof Error ? error.message : 'Сейчас нельзя надеть в этот слот.' };
    }
  }), [progress.inventory, progress.equipment, progress.skills, target, content, lostParts]);
  const selected = candidates.find(candidate => candidate.reward.id === selectedId);
  const comparison = useMemo(() => selected ? compareRewardEquipment(hero, { ...progress, rewards: progress.inventory ?? [] }, selected.reward, target, body) : null,
    [hero, progress, selected?.reward, target, body]);
  const currentStats = useMemo(() => equipmentStats(hero, progress.equipment.map(entry => equipItem(entry.itemId, entry.slot)), body), [hero, progress.equipment, body]);
  const set = slot.equipment?.setId ? EQUIPMENT_SETS[slot.equipment.setId] : undefined;
  const setState = set ? currentStats.groups.find(group => group.setId === set.id) : undefined;
  const skill = target === 'skill0' || target === 'skill1';
  const title = target === 'skill0' ? 'Способность I' : target === 'skill1' ? 'Способность II' : rewardSlotNames[target];
  const changes = comparison ? rewardAttributes.flatMap(([key, name]) => {
    const difference = comparison.after.values[key] - comparison.before.values[key];
    const before = attributes.find(attribute => attribute.id === key)?.numericValue ?? 0;
    return difference ? [{ key, name, difference, before, after: before + difference }] : [];
  }) : [];
  const number = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

  const selectCandidate = (candidate: typeof candidates[number]) => {
    if (candidate.reward.id !== selectedId) {
      setSelectedId(candidate.reward.id);
      setMessage(candidate.reason || (skill ? 'Нажмите на эту же способность ещё раз, чтобы назначить.' : 'Нажмите на этот же предмет ещё раз, чтобы надеть.'));
      return;
    }
    if (candidate.reason) { setMessage(candidate.reason); return; }
    if (!onEquip(candidate.reward.id, target)) { setMessage('Не удалось изменить слот. Выберите предмет ещё раз.'); setSelectedId(null); return; }
    setSelectedId(null);
    setMessage(`${rewardName(candidate.reward)} — ${skill ? 'назначено' : 'надето'}.`);
    requestAnimationFrame(() => currentCard.current?.focus({ preventScroll: true }));
  };

  return <section id="inventory-slot-panel" className="inventory-slot-panel" aria-labelledby="inventory-slot-title" data-testid="inventory-slot-panel">
    <header className="inventory-slot-heading"><div><span>Выбранный слот</span><h3 id="inventory-slot-title" tabIndex={-1}>{title}</h3></div>
      <button type="button" className="inventory-slot-close" aria-label="Закрыть выбор для слота" onClick={onClose}>×</button>
    </header>
    <section className="inventory-slot-candidates" aria-label={`Подходящие находки: ${title}`}>
      <div className="inventory-slot-list-heading"><h4>Подходящие находки <span>{candidates.length}</span></h4>
        <p>{skill ? 'Первое нажатие — сравнить. Повторное — назначить.' : 'Первое нажатие — сравнить. Повторное — надеть.'}</p></div>
      {!!candidates.length && <div className="inventory-slot-list">{candidates.map(candidate => <button key={candidate.reward.id} type="button"
        className="inventory-candidate" data-equipment-rarity={candidate.reward.rarity} data-unavailable={!!candidate.reason}
        data-testid={`inventory-candidate-${candidate.reward.id}`} aria-pressed={selectedId === candidate.reward.id}
        aria-label={`${rewardName(candidate.reward)}.${candidate.reason ? ` ${candidate.reason} Нажмите, чтобы сравнить.` : selectedId === candidate.reward.id ? skill ? ' Нажмите ещё раз, чтобы назначить.' : ' Нажмите ещё раз, чтобы надеть.' : ' Нажмите, чтобы сравнить.'}`}
        onClick={() => selectCandidate(candidate)}><span className="inventory-candidate-art"><RewardArt reward={candidate.reward} /></span>
        <span className="inventory-candidate-copy"><strong>{rewardName(candidate.reward)}</strong><EquipmentRarityBadge rarity={candidate.reward.rarity} />
          <small>{candidate.reason ? 'Недоступно сейчас' : selectedId === candidate.reward.id ? skill ? 'Нажмите ещё раз: назначить' : 'Нажмите ещё раз: надеть' : 'Сравнить'}</small>
        </span>
      </button>)}</div>}
      {!candidates.length && <p className="inventory-slot-empty">Подходящих находок пока нет.</p>}
    </section>
    <p className="inventory-slot-status" role="status" aria-live="polite">{message || (selected?.reason ?? '')}</p>
    {selected ? <div className="inventory-slot-comparison">
      <div className="inventory-attribute-changes" aria-label="Изменения атрибутов после замены">
        {changes.length ? changes.map(change => <span key={change.key} data-change={change.difference > 0 ? 'gain' : 'loss'}>
          <span>{change.name}</span><span className="inventory-attribute-values"><span>{number(change.before)}</span><span aria-hidden="true">→</span><b>{number(change.after)}</b><em>{signed(change.difference)}</em></span>
        </span>) : <span className="inventory-attributes-unchanged">Атрибуты не изменятся</span>}
      </div>
      <RewardComparison hero={hero} progress={progress} comparison={comparison} reward={selected.reward} target={target}
        onTargetChange={() => {}} fitted={false} fixedTarget />
      {!selected.reason && (comparison?.preview.removed.length || skill && progress.skills[target === 'skill0' ? 0 : 1]) && <p className="inventory-replacement-note">{skill ? 'Заменённая способность будет удалена.' : 'Заменённое снаряжение будет удалено.'}</p>}
    </div> : <article ref={currentCard} className="inventory-current" tabIndex={-1} aria-label={slot.empty ? 'Слот свободен' : `Сейчас: ${slot.occupiedBy ?? slot.name}`}>
      <h4>{skill ? 'Сейчас в слоте' : 'Надето сейчас'}</h4>
      <div className="inventory-current-identity" data-equipment-rarity={slot.rarity}>
        <span className="inventory-current-art">{slot.equipment ? <EquipmentIcon item={slot.equipment} /> : <LoadoutIcon kind={slot.icon} />}</span>
        <div><strong>{slot.empty ? 'Слот свободен' : slot.occupiedBy ?? slot.name}</strong>{slot.rarity && <EquipmentRarityBadge rarity={slot.rarity} />}</div>
      </div>
      {slot.equipment ? <RewardEquipmentDetails item={slot.equipment} body={body} /> : !slot.empty && <>
        <p className="inventory-current-description"><DiceText text={slot.description} rules={slot.diceRules} /></p>
        {slot.cooldown && <p className="inventory-current-cooldown">Перезарядка: {slot.cooldown.base} ходов</p>}
      </>}
      {set && <RewardSetSummary set={set} pieces={setState?.equippedPieces ?? 0} activeBonuses={setState?.bonuses.map(bonus => bonus.pieces) ?? []} />}
    </article>}
  </section>;
}
