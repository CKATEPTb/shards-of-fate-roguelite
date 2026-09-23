import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import type { CombatState, GameContent, HeroProgress, InventoryTarget } from '@shards/shared';
import { gameContent } from '../../catalog';
import { buildLoadout, type EquipmentSlotId, type LoadoutSlot } from './loadoutModel';
import { LoadoutIcon } from './LoadoutIcon';
import { LoadoutDescription } from './LoadoutDescription';
import { useLoadoutTooltipPosition } from './useLoadoutTooltipPosition';
import { BodyStatus } from './BodyStatus';
import { CharacterSilhouette, CharacterSilhouetteIcon } from './CharacterSilhouette';
import { CharacterEffects } from './CharacterEffects';
import { CharacterSkillList } from './CharacterSkillList';
import { EQUIPMENT_RARITY_NAMES } from '../EquipmentRarity';
import { EquipmentIcon } from '../EquipmentIcon';
import { activeLoadoutSlot } from './loadoutSkills';
import { InventorySlotPanel } from './InventorySlotPanel';
import './loadoutHud.css';

const intercept = (event: SyntheticEvent) => event.stopPropagation();

export function LoadoutHud({ state, controlledActorId, disabled, initialOpen = false, content = gameContent, progress, onEquipInventory }: {
  state: CombatState; controlledActorId: string; disabled: boolean; initialOpen?: boolean; content?: GameContent;
  progress?: HeroProgress; onEquipInventory?: (inventoryId: string, slot: InventoryTarget) => boolean;
}) {
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(initialOpen);
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [inventoryTarget, setInventoryTarget] = useState<InventoryTarget | null>(null);
  const model = useMemo(() => buildLoadout(state, controlledActorId, content), [state, controlledActorId, content]);
  const inventoryEnabled = !!progress && !!onEquipInventory;
  const hero = gameContent.characters.find(character => character.id === model.unit?.definitionId)
    ?? content.characters.find(character => character.id === model.unit?.definitionId);
  const skillSlots = useMemo(() => progress ? model.skills.map(slot => {
    if (slot.id !== 'extra1' && slot.id !== 'extra2') return slot;
    const skillId = progress.skills[slot.id === 'extra1' ? 0 : 1];
    return activeLoadoutSlot(slot.id, 'Найденная способность', content.skills.find(skill => skill.id === skillId), model.unit, content);
  }) : model.skills, [progress, model.skills, model.unit, content]);
  const inventorySlot = inventoryTarget === 'skill0' || inventoryTarget === 'skill1'
    ? skillSlots.find(slot => slot.id === (inventoryTarget === 'skill0' ? 'extra1' : 'extra2'))
    : model.equipment.find(slot => slot.id === (inventoryTarget === 'head' ? 'helmet' : inventoryTarget));
  const equipmentSides: EquipmentSlotId[][] = [['helmet', 'chest', 'gloves', 'rightHand', 'ring1'], ['amulet', 'pants', 'boots', 'leftHand', 'ring2']];
  const candidate = pinned ?? hovered ?? focused;
  const activeId = open && !disabled && !inventoryEnabled && candidate !== dismissed ? candidate : null;
  const active = model.equipment.find(slot => slot.id === activeId);
  const position = useLoadoutTooltipPosition(active, panel, toggle, tooltip);

  const clearTransient = useCallback(() => { setHovered(null); setFocused(null); }, []);
  const closeInventory = useCallback(() => {
    const slotId = inventoryTarget === 'head' ? 'helmet' : inventoryTarget === 'skill0' ? 'extra1' : inventoryTarget === 'skill1' ? 'extra2' : inventoryTarget;
    setInventoryTarget(null);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>(`button[data-loadout-slot="${slotId}"]`)?.focus({ preventScroll: true }));
  }, [inventoryTarget]);
  const openInventory = (target: InventoryTarget) => {
    setInventoryTarget(target);
    setPinned(null);
    clearTransient();
    requestAnimationFrame(() => {
      const inspector = panel.current?.querySelector<HTMLElement>('#inventory-slot-panel');
      inspector?.scrollIntoView({ block: 'start', behavior: 'instant' });
      inspector?.querySelector<HTMLElement>('#inventory-slot-title')?.focus({ preventScroll: true });
    });
  };
  const closePanel = useCallback(() => {
    setOpen(false);
    setPinned(null);
    setDismissed(null);
    setInventoryTarget(null);
    clearTransient();
    requestAnimationFrame(() => toggle.current?.focus({ preventScroll: true }));
  }, [clearTransient]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      clearTransient();
      setPinned(null);
      setDismissed(null);
      setInventoryTarget(null);
    }
  }, [disabled, clearTransient]);

  useEffect(() => {
    if (open && !disabled) panel.current?.querySelector<HTMLButtonElement>('.character-sheet-close')?.focus({ preventScroll: true });
  }, [open, disabled]);

  useEffect(() => {
    if (!open || disabled) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (inventoryTarget) closeInventory();
      else closePanel();
    };
    window.addEventListener('keydown', escape);
    window.addEventListener('resize', clearTransient);
    window.addEventListener('blur', clearTransient);
    return () => {
      window.removeEventListener('keydown', escape);
      window.removeEventListener('resize', clearTransient);
      window.removeEventListener('blur', clearTransient);
    };
  }, [open, disabled, closePanel, closeInventory, inventoryTarget, clearTransient]);

  useEffect(() => { setInventoryTarget(null); }, [controlledActorId]);

  const closeDescription = () => {
    setPinned(null);
    panel.current?.querySelector<HTMLButtonElement>(`[data-loadout-slot="${activeId}"]`)?.focus({ preventScroll: true });
    setDismissed(activeId);
  };

  const renderSlot = (slot: LoadoutSlot) => {
    const slotTarget = slot.id === 'helmet' ? 'head' : slot.id as InventoryTarget;
    const selected = inventoryEnabled ? inventoryTarget === slotTarget : active?.id === slot.id;
    return <li key={slot.id}>
    <button type="button" disabled={disabled}
      className={`loadout-slot ${slot.empty ? 'loadout-empty' : 'loadout-filled'} ${slot.condition ? `loadout-${slot.condition}` : ''} ${selected ? 'loadout-selected' : ''}`}
      data-testid={`loadout-slot-${slot.id}`} data-loadout-slot={slot.id}
      data-empty={String(slot.empty)} data-content-id={slot.contentId} data-cooldown={slot.cooldown?.remaining}
      data-equipment-condition={slot.condition}
      data-reserved={!!slot.occupiedBy}
      data-equipment-rarity={slot.rarity}
      aria-label={`${slot.occupiedBy ?? slot.name}. ${slot.category}.${slot.rarity ? ` ${EQUIPMENT_RARITY_NAMES[slot.rarity]} предмет.` : ''}${slot.empty ? ' Пустой слот.' : ''}${slot.condition === 'unavailable' ? ' Недоступно.' : slot.condition === 'partial' ? ' Действует частично.' : ''}`}
      aria-expanded={selected} aria-controls={selected ? inventoryEnabled ? 'inventory-slot-panel' : 'loadout-tooltip' : undefined}
      aria-describedby={!inventoryEnabled && active?.id === slot.id ? 'loadout-tooltip' : undefined}
      onPointerEnter={event => {
        if (inventoryEnabled || event.pointerType === 'touch') return;
        setHovered(slot.id);
        setDismissed(null);
      }}
      onPointerLeave={() => setHovered(null)}
      onFocus={event => {
        if (inventoryEnabled || !event.currentTarget.matches(':focus-visible')) return;
        setFocused(slot.id);
        setDismissed(null);
      }}
      onBlur={event => { if (!tooltip.current?.contains(event.relatedTarget as Node | null)) setFocused(null); }}
      onClick={() => {
        if (inventoryEnabled) { openInventory(slotTarget); return; }
        if (pinned === slot.id) {
          setPinned(null);
          setDismissed(slot.id);
        } else {
          setPinned(slot.id);
          setDismissed(null);
        }
      }}>
      <span className="loadout-slot-art">{slot.equipment ? <EquipmentIcon item={slot.equipment} /> : <LoadoutIcon kind={slot.icon} />}</span>
      <span className="loadout-slot-copy"><small>{slot.slotLabel ?? (slot.id === 'class' ? 'Классовое' : slot.id === 'passive' ? 'Пассивное' : 'Умение')}</small>
        <strong>{slot.occupiedBy ?? (slot.empty ? 'Пусто' : slot.name)}</strong>
        {slot.occupiedBy && <em>Обе руки</em>}
      </span>
      {slot.cooldown && slot.cooldown.remaining > 0 && <span className="loadout-badge">{slot.cooldown.remaining}</span>}
      {slot.badge && <span className="loadout-badge loadout-passive-badge">{slot.badge}</span>}
      {slot.empty && <span className="loadout-empty-mark" aria-hidden="true" />}
    </button>
  </li>;
  };

  return <section className={`loadout-hud ${open ? 'loadout-inspected' : ''}`} data-testid="loadout-hud"
    data-inspected={String(open)} data-hud-interactive aria-label={`Персонаж: ${model.heroName}`}
    role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-labelledby={open ? 'character-sheet-name' : undefined}
    onKeyDown={event => {
      if (!open || event.key !== 'Tab') return;
      const selector = 'button:not(:disabled), a[href], summary, [tabindex="0"]';
      const controls = [...(panel.current?.querySelectorAll<HTMLElement>(selector) ?? []), ...(tooltip.current?.querySelectorAll<HTMLElement>(selector) ?? [])]
        .filter(control => control.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <button ref={toggle} type="button" className="loadout-toggle" data-testid="loadout-toggle"
      disabled={disabled} aria-expanded={open} aria-controls="loadout-panel" aria-label={`Персонаж: ${model.heroName}`} title="Персонаж и снаряжение"
      onPointerDown={intercept} onPointerUp={intercept}
      onClick={event => { intercept(event); if (open) closePanel(); else setOpen(true); }}>
      <CharacterSilhouetteIcon />
    </button>
    {open && <div className="character-sheet-backdrop" aria-hidden="true" onPointerDown={event => { intercept(event); closePanel(); }} />}
    {open && <div ref={panel} id="loadout-panel" className={`loadout-panel${inventoryEnabled ? ' loadout-inventory-enabled' : ''}`} data-testid="loadout-panel"
      onPointerDown={intercept} onPointerUp={intercept} onClick={intercept} onScrollCapture={clearTransient}>
      <header className="character-sheet-heading"><div><span className="character-sheet-role">{model.role}</span><h2 id="character-sheet-name">{model.heroName}</h2></div>
        <button type="button" className="character-sheet-close" aria-label="Закрыть окно персонажа" onClick={closePanel}>×</button>
      </header>
      <div className="character-sheet-layout">
        <section className="character-sheet-equipment" aria-labelledby="character-equipment-heading">
          <h3 id="character-equipment-heading">Экипировка</h3>
          {inventoryEnabled && <p className="character-slot-hint">Нажмите на слот, чтобы увидеть подходящие находки.</p>}
          <div className="character-equipment-stage">
            <ol className="character-equipment-side" aria-label="Броня и правая рука" data-testid="armor-slots">{equipmentSides[0].map(id => model.equipment.find(slot => slot.id === id)).map(slot => slot && renderSlot(slot))}</ol>
            <div className="character-figure"><CharacterSilhouette body={model.body} /></div>
            <ol className="character-equipment-side" aria-label="Бижутерия и левая рука" data-testid="accessories-slots">{equipmentSides[1].map(id => model.equipment.find(slot => slot.id === id)).map(slot => slot && renderSlot(slot))}</ol>
          </div>
        </section>
        {inventoryEnabled && inventoryTarget && inventorySlot && progress && hero && onEquipInventory && <InventorySlotPanel
          key={`${controlledActorId}:${inventoryTarget}`} slot={inventorySlot} target={inventoryTarget} hero={hero} progress={progress} body={model.body}
          content={gameContent} attributes={model.attributes} onEquip={onEquipInventory} onClose={closeInventory} />}
        <section className="character-sheet-body" aria-labelledby="character-body-heading">
          <h3 id="character-body-heading">Состояние тела</h3>
          <BodyStatus body={model.body} armor={model.bodyArmor} detailed />
          {model.bodyNote && <p className="loadout-body-state">{model.bodyNote}</p>}
        </section>
        {model.attributes.length > 0 && <section className="character-sheet-attributes" aria-labelledby="character-attributes-heading"><h3 id="character-attributes-heading">Атрибуты</h3>
          <dl>{model.attributes.map(attribute => <div key={attribute.id} title={attribute.description} data-boosted={Boolean(attribute.boosted)} data-negative={attribute.numericValue < 0}>
            <dt>{attribute.name}</dt><dd>{attribute.value}</dd><span className="sr-only">{attribute.description}</span>
          </div>)}</dl>
          <p>С учётом экипировки и действующих эффектов</p>
        </section>}
        <CharacterEffects unit={model.unit} roster={state.units} content={content} active={state.status === 'running'} />
        <CharacterSkillList slots={skillSlots} content={content} onSelectSlot={inventoryEnabled ? openInventory : undefined} selectedSlot={inventoryTarget} />
      </div>
    </div>}
    {active && <div ref={tooltip} id="loadout-tooltip" role="region" aria-label={`Описание: ${active.name}`}
      className="loadout-tooltip" data-testid="loadout-tooltip" data-equipment-rarity={active.rarity} style={position}
      onPointerDown={intercept} onPointerUp={intercept} onClick={intercept}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(null); }}>
      <button type="button" className="loadout-tooltip-close" aria-label="Закрыть описание" onClick={closeDescription}>×</button>
      <LoadoutDescription slot={active} />
    </div>}
  </section>;
}
