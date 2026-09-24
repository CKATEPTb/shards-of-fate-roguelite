import { memo, useId, useMemo, useState, type PointerEvent } from 'react';
import type { AdventureReward, HeroProgress, InventoryTarget } from '@shards/shared';
import { EQUIPMENT_RARITY_NAMES } from '../EquipmentRarity';
import { LoadoutIcon } from './LoadoutIcon';
import { canFitReward } from './rewardFitting';
import { RewardArt, rewardName } from './rewardPresentation';
import { buildInventoryBagSections, INVENTORY_BAG_CATEGORIES, inventoryRewardSetId, inventorySetName,
  type InventoryBagCategoryId, type InventoryBagEntry, type InventoryBagSort } from './inventoryBagModel';
import './inventoryBag.css';

export interface InventoryBagProps {
  progress: HeroProgress;
  selectedId: string | null;
  selectedSetId?: string | null;
  onSelect: (reward: AdventureReward) => void;
  onDragStart?: (event: PointerEvent<HTMLElement>, rewardId: string) => void;
  draggingId?: string | null;
  disabled?: boolean;
  highlightTargets?: readonly InventoryTarget[];
}

const noRewards: readonly AdventureReward[] = [];
const sortModes: readonly { id: InventoryBagSort; label: string }[] = [
  { id: 'rarity', label: 'По редкости' }, { id: 'newest', label: 'Сначала новые' }, { id: 'sets', label: 'По комплектам' },
];

function BagCategoryIcon({ category }: { category: InventoryBagCategoryId | 'set' | 'bag' }) {
  if (category === 'weapons') return <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 23 4-4m-4-3 5 5M10 17 21 4h4l-1 4-12 11M5 23l2 2M7 21l-3 3" /></svg>;
  if (category === 'shields' || category === 'set') return <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 3 10 4-2 12-8 6-8-6L4 7Z" />{category === 'set' ? <><path d="m14 7 4 6-4 7-4-7Z" /><path d="M10 13h8" /></> : <path d="M14 6v15M7 9h14" />}</svg>;
  if (category === 'bag' || category === 'other') return <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 7V4h10v3M5 9l4-2h10l4 2v15H5ZM5 10l9 7 9-7M12 15h4v5h-4ZM9 7l-1 5m11-5 1 5" /></svg>;
  return <LoadoutIcon kind={category === 'head' ? 'helmet' : category === 'rings' ? 'ring1' : category === 'skills' ? 'extra' : category} />;
}

const BagRewardArt = memo(RewardArt);

const BagItem = memo(function BagItem({ entry, selected, sameSet, disabled, highlightTargets, onSelect, onDragStart, dragging }: {
  entry: InventoryBagEntry;
  selected: boolean;
  sameSet: boolean;
  disabled: boolean;
  highlightTargets?: readonly InventoryTarget[];
  onSelect: (reward: AdventureReward) => void;
  onDragStart?: InventoryBagProps['onDragStart'];
  dragging: boolean;
}) {
  const { reward, category, setId } = entry;
  const name = rewardName(reward);
  const categoryName = INVENTORY_BAG_CATEGORIES.find(item => item.id === category)!.name;
  const setName = setId ? inventorySetName(setId) : null;
  const slotMatch = !!highlightTargets?.some(target => canFitReward(reward, target));
  const label = [name, EQUIPMENT_RARITY_NAMES[reward.rarity], categoryName, setName && `Комплект: ${setName}`,
    sameSet && 'Часть выбранного комплекта', slotMatch && 'Подходит к выбранному слоту'].filter(Boolean).join('. ');
  return <li className="inventory-bag-cell">
    <button type="button" className="inventory-bag-item" disabled={disabled} aria-label={label} aria-pressed={selected}
      data-testid={`inventory-bag-item-${reward.id}`} data-equipment-rarity={reward.rarity} data-set-id={setId ?? undefined}
      data-draggable={!!onDragStart} data-dragging={dragging}
      data-matching-set={sameSet} data-slot-match={slotMatch} title={`${name} · ${EQUIPMENT_RARITY_NAMES[reward.rarity]}${setName ? ` · ${setName}` : ''}`}
      onClick={() => onSelect(reward)} onPointerDown={event => onDragStart?.(event, reward.id)}
      onDragStart={event => event.preventDefault()}>
      <span className="inventory-bag-item-art" data-inventory-drag-handle={onDragStart ? '' : undefined}><BagRewardArt reward={reward} /></span>
      <span className="inventory-bag-item-name">{name}</span>
      {sameSet && <span className="inventory-bag-set-mark" aria-hidden="true">◆</span>}
      {slotMatch && <span className="inventory-bag-slot-mark" aria-hidden="true">✓</span>}
    </button>
  </li>;
});

/** Selection belongs to the parent so comparison and deliberate second taps agree. */
export const InventoryBag = memo(function InventoryBag({ progress, selectedId, selectedSetId, onSelect, onDragStart, draggingId, disabled = false, highlightTargets }: InventoryBagProps) {
  const [sort, setSort] = useState<InventoryBagSort>('rarity');
  const headingId = useId();
  const inventory = progress.inventory ?? noRewards;
  const sections = useMemo(() => buildInventoryBagSections(inventory, sort), [inventory, sort]);
  const selectedReward = inventory.find(reward => reward.id === selectedId);
  const matchingSet = selectedSetId === undefined ? selectedReward ? inventoryRewardSetId(selectedReward) : null : selectedSetId;
  const matchingCount = useMemo(() => matchingSet ? sections.reduce((count, section) => count
    + section.entries.filter(entry => entry.setId === matchingSet).length, 0) : 0, [sections, matchingSet]);

  return <section className="inventory-bag-panel" aria-labelledby={headingId} data-testid="inventory-bag" data-sort={sort}>
    <header className="inventory-bag-heading">
      <span className="inventory-bag-heading-icon"><BagCategoryIcon category="bag" /></span>
      <h3 id={headingId}>Сумка</h3>
      <span className="inventory-bag-total" aria-label={`Предметов в сумке: ${inventory.length}`}>{inventory.length}</span>
    </header>
    <div className="inventory-bag-sort" role="group" aria-label="Сортировка сумки">
      {sortModes.map(mode => <button key={mode.id} type="button" aria-pressed={sort === mode.id} onClick={() => setSort(mode.id)}>{mode.label}</button>)}
    </div>
    <p className="inventory-bag-hint" aria-live="polite">{matchingSet
      ? <><span className="inventory-bag-hint-mark" aria-hidden="true">◆</span><span>{inventorySetName(matchingSet)} <span className="inventory-bag-hint-count">· в сумке: {matchingCount}</span></span></>
      : <span>{onDragStart ? 'Нажмите для сравнения. Перетащите значок в слот, чтобы надеть.' : 'Выберите находку, чтобы сравнить с надетым.'}</span>}</p>
    <div className="inventory-bag-scroll" tabIndex={0} role="region" aria-label="Содержимое сумки">
      {!inventory.length ? <div className="inventory-bag-empty"><span className="inventory-bag-empty-icon"><BagCategoryIcon category="bag" /></span><strong>Сумка пока пуста</strong><p>Найденные вещи и способности появятся здесь.</p></div>
        : sections.map(section => <section key={section.id} className="inventory-bag-category" aria-label={section.name} data-category={section.category}
          data-set-id={section.setId ?? undefined} data-empty={!section.entries.length}>
          <header className="inventory-bag-category-heading"><span className="inventory-bag-category-icon"><BagCategoryIcon category={section.category} /></span>
            <h4>{section.name}</h4><span className="inventory-bag-category-count" aria-label={`Предметов: ${section.entries.length}`}>{section.entries.length}</span>
          </header>
          {!!section.entries.length && <ul className="inventory-bag-grid">{section.entries.map(entry => <BagItem key={entry.reward.id} entry={entry}
            selected={entry.reward.id === selectedId} sameSet={!!matchingSet && entry.setId === matchingSet} disabled={disabled} highlightTargets={highlightTargets} onSelect={onSelect}
            onDragStart={onDragStart} dragging={draggingId === entry.reward.id} />)}</ul>}
        </section>)}
    </div>
  </section>;
});
