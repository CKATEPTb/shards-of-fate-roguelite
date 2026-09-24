import { useMemo, useRef, useState } from 'react';
import { BODY_PARTS, REWARD_RARITIES, type GameContent, type HeroBody, type HeroProgress, type InventoryTarget, type UnitDefinition } from '@shards/shared';
import { previewInventoryEquip } from '@shards/game-core';
import { equipItem } from '@shards/game-data';
import { DiceText } from '../DiceText';
import { EquipmentIcon } from '../EquipmentIcon';
import { EquipmentRarityBadge } from '../EquipmentRarity';
import type { CharacterAttribute, LoadoutSlot } from './loadoutModel';
import { LoadoutIcon } from './LoadoutIcon';
import { bodyPartNames } from './body-status-model';
import { RewardComparison } from './RewardComparison';
import { RewardEquipmentDetails } from './RewardEquipmentDetails';
import { compareRewardEquipment } from './rewardComparisonModel';
import { canFitReward } from './rewardFitting';
import { RewardArt, rewardAttributes, rewardName, rewardSlotNames, signed } from './rewardPresentation';
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

/** Inspect once, equip on the next deliberate tap. The equipped item always stays first. */
export function InventorySlotPanel({ slot, target, hero, progress, body, content, attributes, onEquip }: InventorySlotPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const currentButton = useRef<HTMLButtonElement>(null);
  const carousel = useRef<HTMLDivElement>(null);
  const lostParts = BODY_PARTS.map(part => body?.[part].lost ? '1' : '0').join('');
  // Inventory is stored in arrival order. Sort only this view, keeping that chronology intact.
  const candidates = useMemo(() => (progress.inventory ?? []).filter(reward => canFitReward(reward, target)).map((reward, pickupOrder) => {
    try {
      previewInventoryEquip(progress, reward.id, target, content, body);
      return { reward, pickupOrder, reason: '' };
    } catch (error) {
      return { reward, pickupOrder, reason: error instanceof Error ? error.message : 'Сейчас нельзя надеть в этот слот.' };
    }
  }).sort((a, b) => REWARD_RARITIES.indexOf(b.reward.rarity) - REWARD_RARITIES.indexOf(a.reward.rarity)
    || b.pickupOrder - a.pickupOrder), [progress.inventory, progress.equipment, progress.skills, target, content, lostParts]);
  const selected = candidates.find(candidate => candidate.reward.id === selectedId);
  const comparison = useMemo(() => selected ? compareRewardEquipment(hero, { ...progress, rewards: progress.inventory ?? [] }, selected.reward, target, body) : null,
    [hero, progress, selected?.reward, target, body]);
  const equipped = useMemo(() => progress.equipment.map(entry => equipItem(entry.itemId, entry.slot)), [progress.equipment]);
  const skill = target === 'skill0' || target === 'skill1';
  const title = target === 'skill0' ? 'Способность I' : target === 'skill1' ? 'Способность II' : rewardSlotNames[target];
  const changes = rewardAttributes.flatMap(([key, name]) => {
    const difference = comparison ? comparison.after.values[key] - comparison.before.values[key] : 0;
    const before = attributes.find(attribute => attribute.id === key)?.numericValue ?? 0;
    return before || difference ? [{ key, name, difference, before, after: before + difference }] : [];
  });
  const number = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

  const selectCandidate = (candidate: typeof candidates[number]) => {
    if (candidate.reward.id !== selectedId) {
      setSelectedId(candidate.reward.id);
      setMessage(candidate.reason);
      return;
    }
    if (candidate.reason) { setMessage(candidate.reason); return; }
    if (!onEquip(candidate.reward.id, target)) { setMessage('Не удалось изменить слот. Выберите предмет ещё раз.'); setSelectedId(null); return; }
    setSelectedId(null);
    setMessage(skill ? 'Способность назначена. Предыдущая сохранена в сумке.' : 'Предмет надет. Снятое снаряжение сохранено в сумке.');
    requestAnimationFrame(() => {
      currentButton.current?.focus({ preventScroll: true });
      carousel.current?.scrollTo({ left: 0, behavior: 'smooth' });
    });
  };
  const scroll = (direction: number) => carousel.current?.scrollBy({ left: direction * carousel.current.clientWidth * .8, behavior: 'smooth' });
  const hint = selected ? skill ? 'Ещё раз нажмите на выбранную способность, чтобы назначить.' : 'Ещё раз нажмите на выбранный предмет, чтобы надеть.'
    : candidates.length ? 'Выберите вещь из сумки, чтобы сравнить.' : 'Подходящих находок в сумке пока нет.';

  return <section id="inventory-slot-panel" className="inventory-slot-panel" aria-labelledby="inventory-slot-title" data-testid="inventory-slot-panel">
    <header className="inventory-slot-heading"><h3 id="inventory-slot-title" className="character-inspector-title" tabIndex={-1}>{title}</h3><span>В сумке: {candidates.length}</span></header>
    <div className="inventory-slot-carousel" aria-label={`Предметы для слота: ${title}`}>
      <button type="button" className="inventory-carousel-arrow" disabled={!candidates.length} aria-label="Предыдущие предметы" onClick={() => scroll(-1)}>‹</button>
      <div ref={carousel} className="inventory-slot-list">
        <button ref={currentButton} type="button" className="inventory-candidate inventory-candidate-current" data-equipment-rarity={slot.rarity}
          aria-pressed={!selected} aria-label={`Сейчас: ${slot.empty ? 'Слот свободен' : slot.occupiedBy ?? slot.name}`}
          onClick={() => { setSelectedId(null); setMessage(''); }}>
          <span className="inventory-candidate-art">{slot.equipment ? <EquipmentIcon item={slot.equipment} /> : <LoadoutIcon kind={slot.icon} />}</span>
          <span className="inventory-candidate-label">{slot.empty ? 'Пусто' : 'Надето'}</span>
        </button>
        {candidates.map(candidate => <button key={candidate.reward.id} type="button" className="inventory-candidate" data-equipment-rarity={candidate.reward.rarity}
          data-unavailable={!!candidate.reason} data-testid={`inventory-candidate-${candidate.reward.id}`} aria-pressed={selectedId === candidate.reward.id}
          title={rewardName(candidate.reward)}
          aria-label={`${rewardName(candidate.reward)}.${candidate.reason ? ` ${candidate.reason}` : selectedId === candidate.reward.id ? skill ? ' Нажмите ещё раз, чтобы назначить.' : ' Нажмите ещё раз, чтобы надеть.' : ' Нажмите, чтобы сравнить.'}`}
          onClick={() => selectCandidate(candidate)}>
          <span className="inventory-candidate-art"><RewardArt reward={candidate.reward} /></span>
          <span className="inventory-candidate-label">{selectedId === candidate.reward.id ? skill ? 'Назначить' : 'Надеть' : 'В сумке'}</span>
        </button>)}
      </div>
      <button type="button" className="inventory-carousel-arrow" disabled={!candidates.length} aria-label="Следующие предметы" onClick={() => scroll(1)}>›</button>
    </div>
    <p className="inventory-slot-hint">{hint}</p>
    {!skill && <div className="inventory-attribute-changes" aria-label="Атрибуты персонажа и изменения после замены">
      {changes.map(change => <span key={change.key} data-change={change.difference > 0 ? 'gain' : change.difference < 0 ? 'loss' : 'same'}>
        <span>{change.name}</span><span className="inventory-attribute-values"><span>{number(change.before)}</span>{!!change.difference && <><span aria-hidden="true">→</span><b>{number(change.after)}</b><em>{signed(change.difference)}</em></>}</span>
      </span>)}
      {selected && !changes.some(change => change.difference) && <span className="inventory-attributes-unchanged">Атрибуты не изменятся</span>}
      {comparison?.parts.map(part => <span key={part.part} className="inventory-part-change">
        <span>{bodyPartNames[part.part]}{part.lost ? ' · утрачена' : ''}</span>
        <span>{([['Защита', part.beforeArmor, part.afterArmor], ['Прочность', part.beforeMax, part.afterMax]] as const)
          .filter(([, before, after]) => before !== after).map(([label, before, after]) => <span className="inventory-attribute-values" key={label} data-change={part.lost ? 'same' : after > before ? 'gain' : 'loss'}>
            <span>{label} {before} →</span><b>{after}</b><em>{signed(after - before)}</em>
          </span>)}</span>
      </span>)}
    </div>}
    <div className="inventory-slot-details" key={selected?.reward.id ?? 'current'}>
      {selected ? <RewardComparison hero={hero} progress={progress} comparison={comparison} reward={selected.reward} target={target}
        onTargetChange={() => {}} fitted={false} fixedTarget hidePartChanges /> : <article className="inventory-current" aria-label={slot.empty ? 'Слот свободен' : `Сейчас: ${slot.occupiedBy ?? slot.name}`}>
        <div className="inventory-current-identity" data-equipment-rarity={slot.rarity}>
          <span className="inventory-current-art">{slot.equipment ? <EquipmentIcon item={slot.equipment} /> : <LoadoutIcon kind={slot.icon} />}</span>
          <div><strong>{slot.empty ? 'Слот свободен' : slot.occupiedBy ?? slot.name}</strong>{slot.rarity && <EquipmentRarityBadge rarity={slot.rarity} />}</div>
        </div>
        {slot.equipment ? <RewardEquipmentDetails item={slot.equipment} body={body} equipment={equipped} /> : !slot.empty && <>
          <p className="inventory-current-description"><DiceText text={slot.description} rules={slot.diceRules} /></p>
          {slot.cooldown && <p className="inventory-current-cooldown">Перезарядка: {slot.cooldown.base} ходов</p>}
        </>}
      </article>}
    </div>
    {message && <p className="inventory-slot-status" role="status" aria-live="polite">{message}</p>}
  </section>;
}
