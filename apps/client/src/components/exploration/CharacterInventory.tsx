import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BODY_PARTS, resolveEquipmentItem, type AdventureReward, type CombatState, type GameContent, type HeroProgress, type InventoryTarget, type UnitDefinition } from '@shards/shared';
import { equipItem, EQUIPMENT_ITEMS } from '@shards/game-data';
import { playSound } from '../../audio/engine';
import { EquipmentIcon } from '../EquipmentIcon';
import { EquipmentRarityBadge } from '../EquipmentRarity';
import { CharacterSilhouette } from './CharacterSilhouette';
import { CharacterSkillList } from './CharacterSkillList';
import { CharacterEffects, CharacterEffectDetails } from './CharacterEffects';
import { characterEffects } from './characterEffectsModel';
import { BodyStatus } from './BodyStatus';
import { bodyPartAbbreviations, bodyPartNames, bodyPartView } from './body-status-model';
import { buildLoadout, type LoadoutSlot } from './loadoutModel';
import { LoadoutIcon } from './LoadoutIcon';
import { LoadoutDescription } from './LoadoutDescription';
import { InventoryBag } from './InventoryBag';
import { InventorySetBonuses } from './InventorySetBonuses';
import { defaultInventoryTarget, inventoryTargetChoices, inventoryTargetForSlot } from './inventorySelection';
import { compareRewardEquipment } from './rewardComparisonModel';
import { RewardComparison } from './RewardComparison';
import { RewardEquipmentDetails } from './RewardEquipmentDetails';
import { RewardArt, rewardAttributes, rewardName, rewardSlotNames, signed } from './rewardPresentation';
import { useInventoryDrag } from './useInventoryDrag';
import './characterInventory.css';

type Inspection = { kind: 'bag'; id: string; target: InventoryTarget | null }
  | { kind: 'slot'; id: LoadoutSlot['id'] } | { kind: 'body' } | { kind: 'attribute'; id: string } | { kind: 'effect'; id: string };
const targetName = (target: InventoryTarget) => target === 'skill0' ? 'Навык I' : target === 'skill1' ? 'Навык II' : rewardSlotNames[target];
const numberFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const number = (value: number) => numberFormatter.format(value);

export function CharacterInventory({ model, skillSlots, hero, progress, state, content, onEquip, onSetAutoEquipment, onClose }: {
  model: ReturnType<typeof buildLoadout>; skillSlots: readonly LoadoutSlot[]; hero: UnitDefinition;
  progress: HeroProgress; state: CombatState; content: GameContent;
  onEquip(inventoryId: string, target: InventoryTarget): boolean; onClose(): void;
  onSetAutoEquipment?: (enabled: boolean) => boolean;
}) {
  const [tab, setTab] = useState<'bag' | 'character'>('bag');
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [preferredTarget, setPreferredTarget] = useState<InventoryTarget | null>(null);
  const [focusedSetId, setFocusedSetId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const applied = useRef(new Set<string>());
  const root = useRef<HTMLDivElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const bagPosition = useRef<{ top: number; left: number } | null>(null);
  const rememberBagPosition = useCallback(() => {
    const bag = root.current?.querySelector<HTMLElement>('.inventory-bag-scroll');
    if (bag?.clientHeight) bagPosition.current = { top: bag.scrollTop, left: bag.scrollLeft };
  }, []);
  useLayoutEffect(() => {
    const position = bagPosition.current;
    bagPosition.current = null;
    const bag = root.current?.querySelector<HTMLElement>('.inventory-bag-scroll');
    if (!position || !bag?.clientHeight) return;
    // Opening the inspector shrinks the bag. Restore its viewport before paint;
    // reveal only the selected tile if the smaller viewport would hide it.
    bag.scrollTop = position.top;
    bag.scrollLeft = position.left;
    const selectedTile = inspection?.kind === 'bag'
      ? bag.querySelector<HTMLElement>('.inventory-bag-item[aria-pressed="true"]') : null;
    if (selectedTile) {
      const viewport = bag.getBoundingClientRect(), tile = selectedTile.getBoundingClientRect();
      const top = viewport.top + bag.clientTop, bottom = top + bag.clientHeight;
      if (tile.top < top || tile.height > bag.clientHeight) bag.scrollTop += tile.top - top;
      else if (tile.bottom > bottom) bag.scrollTop += tile.bottom - bottom;
    }
  }, [inspection]);
  const equipped = useMemo(() => progress.equipment.map(entry => equipItem(entry.itemId, entry.slot)), [progress.equipment]);
  const selected = inspection?.kind === 'bag' ? progress.inventory?.find(entry => entry.id === inspection.id) : undefined;
  const target = inspection?.kind === 'bag' ? inspection.target : null;
  const selectedItem = selected?.kind === 'equipment' ? resolveEquipmentItem(EQUIPMENT_ITEMS, selected.definitionId) : undefined;
  const selectedSlot = inspection?.kind === 'slot' ? [...model.equipment, ...skillSlots].find(slot => slot.id === inspection.id) : undefined;
  const selectedSetId = focusedSetId ?? selectedItem?.setId ?? selectedSlot?.equipment?.setId ?? null;
  const choices = useMemo(() => selected ? inventoryTargetChoices(selected, progress, content, model.body) : [], [selected, progress, content, model.body]);
  const refusal = selected ? choices.find(choice => choice.target === target)?.reason ?? (target ? '' : 'Нет подходящего слота.') : '';
  const comparison = useMemo(() => selected && target ? compareRewardEquipment(hero,
    { ...progress, rewards: progress.inventory ?? [] }, selected, target, model.body) : null, [hero, progress, selected, target, model.body]);
  const setPreview = useMemo(() => comparison ? { equipment: comparison.preview.equipment, body: comparison.afterBody } : undefined, [comparison]);
  const highlightTargets = useMemo(() => preferredTarget ? [preferredTarget] : undefined, [preferredTarget]);
  const attributes = rewardAttributes.flatMap(([key, name]) => {
    const before = model.attributes.find(entry => entry.id === key)?.numericValue ?? 0;
    const difference = comparison ? comparison.after.values[key] - comparison.before.values[key] : 0;
    return before || difference ? [{ key, name, before, difference, after: before + difference }] : [];
  });
  const changes = attributes.filter(attribute => attribute.difference);
  const effect = inspection?.kind === 'effect' ? characterEffects(model.unit, state.units, state.status === 'running', content).find(entry => entry.id === inspection.id) : undefined;
  const attribute = inspection?.kind === 'attribute' ? model.allAttributes.find(entry => entry.id === inspection.id) : undefined;
  const equipFind = useCallback((reward: AdventureReward, destination: InventoryTarget) => {
    if (pending.current) return;
    const current = progress.inventory?.find(entry => entry.id === reward.id);
    if (!current) return;
    const choice = inventoryTargetChoices(current, progress, content, model.body).find(entry => entry.target === destination);
    if (!choice || choice.reason) { setMessage(choice?.reason || 'Этот предмет не подходит к выбранному слоту.'); return; }
    pending.current = current.id; setPendingId(current.id);
    let accepted = false;
    try { accepted = onEquip(current.id, destination); } catch { /* Keep the find inspectable on rejection. */ }
    if (!accepted) {
      pending.current = null; setPendingId(null);
      setMessage('Не удалось изменить снаряжение. Попробуйте ещё раз.');
    } else setMessage('Обновляем снаряжение…');
  }, [progress, content, model.body, onEquip]);
  const gesture = useInventoryDrag({ root, disabled: !!pendingId,
    onDrop: (id, destination) => {
      const reward = progress.inventory?.find(entry => entry.id === id);
      if (reward) { setPreferredTarget(destination); equipFind(reward, destination); }
    },
    onCancel: () => setMessage('Перетаскивание отменено. Предмет остался в сумке.'),
  });
  const dragged = gesture.drag ? progress.inventory?.find(entry => entry.id === gesture.drag?.rewardId) : undefined;
  const dragChoices = useMemo(() => dragged ? inventoryTargetChoices(dragged, progress, content, model.body) : [], [dragged, progress, content, model.body]);
  const hoveredChoice = dragChoices.find(choice => choice.target === gesture.drag?.target);
  useEffect(() => { if (gesture.drag && !dragged) gesture.cancel(); }, [gesture.drag, dragged, gesture.cancel]);

  const restoreFocus = () => requestAnimationFrame(() => {
    const previous = origin.current;
    if (previous?.isConnected && previous.getClientRects().length && !previous.matches(':disabled')) previous.focus({ preventScroll: true });
    else {
      const fallback = ['.inventory-bag-scroll', '.inventory-mobile-tabs button[aria-selected="true"]', '.inventory-close']
        .map(selector => root.current?.querySelector<HTMLElement>(selector)).find(element => element?.getClientRects().length);
      fallback?.focus({ preventScroll: true });
    }
  });

  useEffect(() => {
    if (inspection?.kind === 'bag' && !progress.inventory?.some(entry => entry.id === inspection.id)) {
      rememberBagPosition();
      setInspection(null);
      restoreFocus();
    }
    if (pending.current && !progress.inventory?.some(entry => entry.id === pending.current)) {
      applied.current.add(pending.current);
      pending.current = null;
      setPendingId(null);
      setMessage('Снаряжение обновлено. Заменённое сохранено в сумке.');
      playSound('equip', { volume: .55 });
    }
    // The guest applies swaps immediately. A rejected prediction restores the
    // original inventory ID; returned equipment from a valid swap has a new ID.
    for (const id of applied.current) if (progress.inventory?.some(entry => entry.id === id)) {
      applied.current.delete(id);
      setMessage('Замена отменена при синхронизации. Предмет остался в сумке.');
    }
  }, [progress.inventory, inspection]);
  useEffect(() => {
    if (!pendingId) return;
    const timer = window.setTimeout(() => {
      if (pending.current !== pendingId) return;
      pending.current = null; setPendingId(null);
      setMessage('Изменение пока не применено. Можно повторить выбор.');
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [pendingId]);

  const inspect = useCallback((next: Inspection) => {
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    rememberBagPosition(); setInspection(next); setFocusedSetId(null); setMessage('');
  }, [rememberBagPosition]);
  const clearInspection = () => {
    rememberBagPosition();
    setInspection(null);
    restoreFocus();
  };
  const inspectSlot = (slot: LoadoutSlot) => {
    setPreferredTarget(inventoryTargetForSlot(slot.id));
    inspect({ kind: 'slot', id: slot.id });
  };
  const selectFind = useCallback((reward: AdventureReward) => {
    if (pending.current) return;
    if (selected?.id === reward.id && target) {
      equipFind(reward, target);
      return;
    }
    const nextChoices = inventoryTargetChoices(reward, progress, content, model.body);
    const nextTarget = defaultInventoryTarget(nextChoices, progress, content, preferredTarget);
    inspect({ kind: 'bag', id: reward.id, target: nextTarget });
  }, [selected?.id, target, equipFind, progress, content, model.body, preferredTarget, inspect]);
  const selectTarget = (next: InventoryTarget) => {
    if (!selected || !choices.some(choice => choice.target === next)) return;
    rememberBagPosition();
    setPreferredTarget(next);
    setInspection({ kind: 'bag', id: selected.id, target: next });
    setMessage('');
  };
  const changeAutoEquipment = (enabled: boolean) => {
    if (!onSetAutoEquipment || pending.current) return;
    let accepted = false;
    try { accepted = onSetAutoEquipment(enabled); } catch { /* The checked state continues to follow the game snapshot. */ }
    setMessage(accepted ? '' : 'Не удалось изменить автозамену экипировки. Попробуйте ещё раз.');
  };
  const renderSlot = (slot: LoadoutSlot) => {
    const slotTarget = inventoryTargetForSlot(slot.id);
    const compatible = !!selected && choices.some(choice => choice.target === slotTarget);
    const drop = dragChoices.find(choice => choice.target === slotTarget);
    return <li key={slot.id}><button type="button"
      className={`loadout-slot ${slot.empty ? 'loadout-empty' : 'loadout-filled'} ${slot.condition ? `loadout-${slot.condition}` : ''}`}
      data-testid={`loadout-slot-${slot.id}`} data-loadout-slot={slot.id} data-empty={String(slot.empty)} data-content-id={slot.contentId}
      data-equipment-rarity={slot.rarity} data-reserved={!!slot.occupiedBy} data-compatible={compatible} data-selected={selectedSlot?.id === slot.id || target === slotTarget}
      data-synergy={!!selectedSetId && slot.equipment?.setId === selectedSetId}
      data-inventory-drop-target={slotTarget ?? undefined} data-drop-allowed={drop ? !drop.reason : dragged ? undefined : true}
      data-drop-hover={!!drop && gesture.drag?.target === slotTarget}
      aria-label={`${slot.slotLabel}: ${slot.occupiedBy ?? (slot.empty ? 'Пусто' : slot.name)}. Открыть описание.`}
      title={`${slot.slotLabel}: ${slot.occupiedBy ?? slot.name}`} onClick={() => inspectSlot(slot)}>
      <span className="loadout-slot-art">{slot.equipment ? <EquipmentIcon item={slot.equipment} /> : <LoadoutIcon kind={slot.icon} />}</span>
      <span className="loadout-slot-copy"><small>{slot.slotLabel}</small></span>
      {slot.occupiedBy && <span className="character-hand-link" aria-hidden="true">↔</span>}
    </button></li>;
  };
  const inspectionTitle = selected ? rewardName(selected) : selectedSlot?.slotLabel ?? selectedSlot?.name
    ?? (inspection?.kind === 'body' ? 'Состояние тела' : attribute?.name ?? effect?.name ?? 'Описание');

  return <div ref={root} className="character-inventory" data-mobile-tab={tab} data-inspecting={!!inspection}
    data-dragging={!!dragged} onClickCapture={event => { gesture.suppressClick(event); }}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (inspection) clearInspection(); else onClose(); }
    }}>
    <header className="inventory-window-heading">
      <div><span>{model.role}</span><h2 id="character-sheet-name">{model.heroName}</h2></div>
      <span className="inventory-window-caption">Снаряжение и сумка</span>
      <span className="inventory-wallet" aria-label={`${progress.coins} монет`}>◇ {progress.coins.toLocaleString('ru-RU')}</span>
      <button type="button" className="character-sheet-close inventory-close" aria-label="Закрыть окно персонажа" onClick={onClose}>×</button>
    </header>
    <div className="inventory-mobile-tabs" role="tablist" aria-label="Разделы инвентаря">
      {(['bag', 'character'] as const).map(value => <button key={value} type="button" role="tab" id={`inventory-tab-${value}`}
        tabIndex={tab === value ? 0 : -1} aria-selected={tab === value} aria-controls={value === 'bag' ? 'inventory-bag-area' : 'inventory-hero-area'}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 'bag' : event.key === 'End' ? 'character' : tab === 'bag' ? 'character' : 'bag';
          setTab(next);
          root.current?.querySelector<HTMLButtonElement>(`#inventory-tab-${next}`)?.focus();
        }}
        onClick={() => setTab(value)}>{value === 'bag' ? `Сумка · ${progress.inventory?.length ?? 0}` : 'Персонаж'}</button>)}
    </div>
    <div className="inventory-workspace">
      <section className="inventory-bag-area" id="inventory-bag-area" aria-label="Сумка персонажа">
        <InventoryBag progress={progress} selectedId={selected?.id ?? null} selectedSetId={selectedSetId} onSelect={selectFind}
          onDragStart={gesture.start} draggingId={dragged?.id}
          disabled={!!pendingId} highlightTargets={highlightTargets} />
      </section>
      <div className="inventory-hero-area" id="inventory-hero-area">
        <section className="inventory-character-column" aria-label="Тело и надетая экипировка">
          {onSetAutoEquipment && <section className="inventory-auto-equipment" aria-label="Автозамена экипировки">
            <label className="inventory-auto-equipment-toggle">
              <input type="checkbox" checked={progress.autoEquipment ?? false} disabled={!!pendingId}
                data-testid="inventory-auto-equipment"
                onChange={event => changeAutoEquipment(event.target.checked)} />
              <span>Автоматически заменять экипировку</span>
            </label>
          </section>}
          <div className="inventory-gear-section"><h3>На персонаже <span>Нажмите на ячейку</span></h3>
            <div className="inventory-gear-stage"><ol className="inventory-equipped-grid" aria-label="Экипировка">{model.equipment.map(renderSlot)}</ol>
              <button className="inventory-body" type="button" aria-label="Подробнее о состоянии тела" onClick={() => inspect({ kind: 'body' })}>
                <CharacterSilhouette body={model.body} />
                <span className="inventory-body-readings">{model.body && BODY_PARTS.map(part => {
                  const view = bodyPartView(model.body!, part);
                  return <span key={part} data-state={view.state} title={`${bodyPartNames[part]}: ${view.current} / ${view.max}`}>
                    <span>{bodyPartAbbreviations[part]}</span><b>{view.state === 'lost' ? '×' : view.current}</b>
                  </span>;
                })}</span><span className="inventory-body-link">Состояние тела ↗</span>
              </button>
            </div>
          </div>
          <section className="inventory-attributes" aria-label="Атрибуты персонажа"><h3>Характеристики {comparison && <span>После замены</span>}</h3>
            <dl>{attributes.map(entry => <div key={entry.key} data-change={entry.difference > 0 ? 'gain' : entry.difference < 0 ? 'loss' : 'same'}>
              <dt><button type="button" onClick={() => inspect({ kind: 'attribute', id: entry.key })}>{entry.name}</button></dt>
              <dd>{number(entry.before)}{!!entry.difference && <><span> → {number(entry.after)}</span><em>{signed(entry.difference)}</em></>}</dd>
            </div>)}</dl>
          </section>
          <CharacterEffects compact includeEquipment={false} unit={model.unit} roster={state.units} content={content}
            active={state.status === 'running'} onInspectEffect={entry => inspect({ kind: 'effect', id: entry.id })} />
          <CharacterSkillList compact slots={skillSlots} content={content} onInspectSlot={inspectSlot}
            dropTargets={dragChoices} hoveredDropTarget={gesture.drag?.target}
            selectedId={target === 'skill0' ? 'extra1' : target === 'skill1' ? 'extra2' : selectedSlot?.id} />
        </section>
        <aside className="inventory-set-column" aria-label="Бонусы комплектов">
          <InventorySetBonuses equipment={equipped} body={model.body} selectedSetId={selectedSetId}
            preview={setPreview}
            onSelectSet={setFocusedSetId} />
        </aside>
      </div>
      {inspection && <section className="inventory-inspector" aria-label="Описание и сравнение" aria-busy={!!pendingId}>
        <header><h3>{inspectionTitle}</h3><button type="button" className="inventory-detail-close" aria-label="Закрыть описание" onClick={clearInspection}>×</button></header>
        {selected && target && choices.length > 1 && <div className="inventory-target-choices" role="group" aria-label="Слот для замены">
          {choices.map(choice => <button key={choice.target} type="button" aria-pressed={target === choice.target} onClick={() => selectTarget(choice.target)}
            title={choice.reason || targetName(choice.target)}>{targetName(choice.target)}</button>)}
        </div>}
        <div className="inventory-inspector-scroll" key={selected?.id ?? (inspection.kind === 'body' ? 'body' : 'id' in inspection ? inspection.id : 'detail')}>
          {selected && <div className="inventory-change-summary" aria-label="Изменение характеристик">
            {changes.length ? changes.map(change => <span key={change.key} data-change={change.difference > 0 ? 'gain' : 'loss'}>
              {change.name} <b>{number(change.before)} → {number(change.after)}</b> <em>{signed(change.difference)}</em>
            </span>) : <span>{selected.kind === 'skill' ? 'Заменит способность в выбранном слоте' : 'Основные атрибуты не изменятся'}</span>}
          </div>}
          {selected && target ? <RewardComparison hero={hero} progress={progress} comparison={comparison} reward={selected} target={target}
            onTargetChange={selectTarget} fitted={false} fixedTarget showSetBonuses={false} />
            : selectedSlot ? <article>{selectedSlot.equipment ? <><div className="inventory-worn-title" data-equipment-rarity={selectedSlot.rarity}>
              <EquipmentIcon item={selectedSlot.equipment} size={40} /><div><strong>{selectedSlot.occupiedBy ?? selectedSlot.name}</strong>
                {selectedSlot.rarity && <EquipmentRarityBadge rarity={selectedSlot.rarity} />}</div></div>
              <RewardEquipmentDetails item={selectedSlot.equipment} body={model.body} equipment={equipped} showSetBonuses={false} />
            </> : <LoadoutDescription slot={selectedSlot} />}</article>
              : inspection.kind === 'body' ? <><BodyStatus body={model.body} armor={model.bodyArmor} detailed />{model.bodyNote && <p>{model.bodyNote}</p>}</>
                : attribute ? <p>{attribute.description}</p>
                  : effect ? <CharacterEffectDetails effect={effect} content={content} /> : <p>Нет доступного описания.</p>}
          {selected && <p className="inventory-equip-hint" data-error={!!refusal}>{pendingId ? 'Обновляем снаряжение…' : refusal ||
            (selected.kind === 'skill' ? 'Нажмите на выбранный навык ещё раз, чтобы назначить его.' : 'Нажмите на выбранную вещь ещё раз, чтобы надеть её.')}</p>}
        </div>
      </section>}
    </div>
    {dragged && <section className="inventory-drop-dock" aria-label="Куда экипировать" data-testid="inventory-drop-dock">
      <h3>Отпустите над нужным слотом</h3><div className="inventory-drop-dock-slots">
        {dragChoices.map(choice => {
          const slot = [...model.equipment, ...skillSlots].find(entry => inventoryTargetForSlot(entry.id) === choice.target);
          return <div key={choice.target} className="inventory-drop-slot" data-inventory-drop-target={choice.target}
            data-drop-allowed={!choice.reason} data-drop-hover={gesture.drag?.target === choice.target}
            data-equipment-rarity={slot?.rarity} aria-label={`${targetName(choice.target)}: ${choice.reason || slot?.occupiedBy || slot?.name || 'Пусто'}`}>
            <span className="inventory-drop-slot-art">{slot?.equipment ? <EquipmentIcon item={slot.equipment} /> : <LoadoutIcon kind={slot?.icon ?? 'extra'} />}</span>
            <strong>{targetName(choice.target)}</strong><small>{choice.reason || slot?.occupiedBy || (slot?.empty ? 'Пусто' : slot?.name)}</small>
          </div>;
        })}
      </div><p>Вне слота — отмена</p>
    </section>}
    {dragged && gesture.drag && <div className="inventory-drag-ghost" aria-hidden="true" data-equipment-rarity={dragged.rarity}
      data-over-target={!!hoveredChoice && !hoveredChoice.reason} style={{ left: gesture.drag.x, top: gesture.drag.y }}>
      <span><RewardArt reward={dragged} /></span><strong>{rewardName(dragged)}</strong>
    </div>}
    <footer className="inventory-window-footer"><p role="status" aria-live="polite">{dragged
      ? hoveredChoice ? hoveredChoice.reason || `Отпустите: ${targetName(hoveredChoice.target)}` : 'Перенесите в подсвеченный слот. Вне слота — отмена.'
      : message || 'Нажмите для сравнения или перетащите значок в слот. Снятое вернётся в сумку.'}</p></footer>
  </div>;
}
