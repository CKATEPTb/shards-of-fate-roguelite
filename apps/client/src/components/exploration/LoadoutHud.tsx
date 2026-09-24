import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { BODY_PARTS, type CombatState, type GameContent, type HeroProgress, type InventoryTarget } from '@shards/shared';
import { gameContent } from '../../catalog';
import { buildLoadout, type LoadoutSlot } from './loadoutModel';
import { LoadoutIcon } from './LoadoutIcon';
import { LoadoutDescription } from './LoadoutDescription';
import { BodyStatus } from './BodyStatus';
import { bodyPartAbbreviations, bodyPartNames, bodyPartView } from './body-status-model';
import { CharacterSilhouette, CharacterSilhouetteIcon } from './CharacterSilhouette';
import { CharacterEffects, CharacterEffectDetails } from './CharacterEffects';
import { characterEffects } from './characterEffectsModel';
import { CharacterSkillList } from './CharacterSkillList';
import { EQUIPMENT_RARITY_NAMES } from '../EquipmentRarity';
import { EquipmentIcon } from '../EquipmentIcon';
import { activeLoadoutSlot } from './loadoutSkills';
import { InventorySlotPanel } from './InventorySlotPanel';
import { RewardEquipmentDetails } from './RewardEquipmentDetails';
import './loadoutHud.css';
import './characterSheetCompact.css';

const intercept = (event: SyntheticEvent) => event.stopPropagation();
type Inspection = { kind: 'slot'; id: LoadoutSlot['id'] } | { kind: 'body' } | { kind: 'attribute'; id: string } | { kind: 'effect'; id: string };
const slotTarget = (id: LoadoutSlot['id']): InventoryTarget | null => id === 'helmet' ? 'head' : id === 'extra1' ? 'skill0' : id === 'extra2' ? 'skill1'
  : id === 'class' || id === 'characterActive' || id === 'passive' ? null : id;

/** A fixed overview and a contextual inspector share the same screen space. */
export function LoadoutHud({ state, controlledActorId, disabled, initialOpen = false, content = gameContent, progress, onEquipInventory }: {
  state: CombatState; controlledActorId: string; disabled: boolean; initialOpen?: boolean; content?: GameContent;
  progress?: HeroProgress; onEquipInventory?: (inventoryId: string, slot: InventoryTarget) => boolean;
}) {
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(initialOpen);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const model = useMemo(() => buildLoadout(state, controlledActorId, content), [state, controlledActorId, content]);
  const inventoryEnabled = !!progress && !!onEquipInventory;
  const hero = gameContent.characters.find(character => character.id === model.unit?.definitionId)
    ?? content.characters.find(character => character.id === model.unit?.definitionId);
  const skillSlots = useMemo(() => progress ? model.skills.map(slot => {
    if (slot.id !== 'extra1' && slot.id !== 'extra2') return slot;
    const skillId = progress.skills[slot.id === 'extra1' ? 0 : 1];
    return activeLoadoutSlot(slot.id, 'Найденная способность', content.skills.find(skill => skill.id === skillId), model.unit, content);
  }) : model.skills, [progress, model.skills, model.unit, content]);
  const selectedSlot = inspection?.kind === 'slot' ? [...model.equipment, ...skillSlots].find(slot => slot.id === inspection.id) : undefined;
  const target = selectedSlot ? slotTarget(selectedSlot.id) : null;
  const equipped = useMemo(() => model.equipment.flatMap(slot => slot.equipment && !slot.occupiedBy ? [slot.equipment] : []), [model.equipment]);
  const attribute = inspection?.kind === 'attribute' ? model.attributes.find(entry => entry.id === inspection.id) : undefined;
  const effect = inspection?.kind === 'effect' ? characterEffects(model.unit, state.units, state.status === 'running', content).find(entry => entry.id === inspection.id) : undefined;

  const inspect = (next: Inspection) => {
    if (!inspection) origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setInspection(next);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('.character-inspector-title')?.focus({ preventScroll: true }));
  };
  const back = useCallback(() => {
    setInspection(null);
    requestAnimationFrame(() => origin.current?.isConnected && origin.current.focus({ preventScroll: true }));
  }, []);
  const closePanel = useCallback(() => {
    setOpen(false);
    setInspection(null);
    requestAnimationFrame(() => toggle.current?.focus({ preventScroll: true }));
  }, []);
  useEffect(() => { if (disabled) { setOpen(false); setInspection(null); } }, [disabled]);
  useEffect(() => { setInspection(null); }, [controlledActorId]);
  useEffect(() => {
    if (open && !disabled) panel.current?.querySelector<HTMLButtonElement>('.character-sheet-close')?.focus({ preventScroll: true });
  }, [open, disabled]);
  useEffect(() => {
    if (!open || disabled) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      if (inspection) back(); else closePanel();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open, disabled, inspection, back, closePanel]);

  const renderSlot = (slot: LoadoutSlot) => <li key={slot.id}>
    <button type="button" disabled={disabled}
      className={`loadout-slot ${slot.empty ? 'loadout-empty' : 'loadout-filled'} ${slot.condition ? `loadout-${slot.condition}` : ''}`}
      data-testid={`loadout-slot-${slot.id}`} data-loadout-slot={slot.id} data-empty={String(slot.empty)} data-content-id={slot.contentId}
      data-equipment-condition={slot.condition} data-reserved={!!slot.occupiedBy} data-equipment-rarity={slot.rarity}
      title={`${slot.slotLabel}: ${slot.occupiedBy ?? (slot.empty ? 'Пусто' : slot.name)}`}
      aria-label={`${slot.slotLabel}. ${slot.occupiedBy ?? slot.name}.${slot.rarity ? ` ${EQUIPMENT_RARITY_NAMES[slot.rarity]} предмет.` : ''}${slot.empty ? ' Пустой слот.' : ''}${slot.occupiedBy ? ' Занята двуручным оружием.' : ''}`}
      onClick={() => inspect({ kind: 'slot', id: slot.id })}>
      <span className="loadout-slot-art">{slot.equipment ? <EquipmentIcon item={slot.equipment} /> : <LoadoutIcon kind={slot.icon} />}</span>
      <span className="loadout-slot-copy"><small>{slot.slotLabel}</small></span>
      {slot.occupiedBy && <span className="character-hand-link" aria-hidden="true">↔</span>}
      {slot.empty && <span className="loadout-empty-mark" aria-hidden="true" />}
    </button>
  </li>;

  return <section className={`loadout-hud ${open ? 'loadout-inspected' : ''}`} data-testid="loadout-hud" data-inspected={String(open)} data-hud-interactive
    aria-label={`Персонаж: ${model.heroName}`} role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-labelledby={open ? 'character-sheet-name' : undefined}
    onKeyDown={event => {
      if (!open || event.key !== 'Tab') return;
      const controls = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], summary, [tabindex="0"]') ?? [])]
        .filter(control => control.getClientRects().length > 0 && !control.closest('[hidden]'));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <button ref={toggle} type="button" className="loadout-toggle" data-testid="loadout-toggle" disabled={disabled} aria-expanded={open} aria-controls="loadout-panel"
      aria-label={`Персонаж: ${model.heroName}`} title="Персонаж и снаряжение" onPointerDown={intercept} onPointerUp={intercept}
      onClick={event => { intercept(event); if (open) closePanel(); else setOpen(true); }}><CharacterSilhouetteIcon /></button>
    {open && <div className="character-sheet-backdrop" aria-hidden="true" onPointerDown={event => { intercept(event); closePanel(); }} />}
    {open && <div ref={panel} id="loadout-panel" className="loadout-panel character-sheet-compact" data-testid="loadout-panel"
      onPointerDown={intercept} onPointerUp={intercept} onClick={intercept}>
      <header className="character-sheet-heading">
        {inspection && <button type="button" className="character-sheet-back" aria-label="Назад к персонажу" onClick={back}>←</button>}
        <div><span className="character-sheet-role">{model.role}</span><h2 id="character-sheet-name">{model.heroName}</h2></div>
        <button type="button" className="character-sheet-close" aria-label="Закрыть окно персонажа" onClick={closePanel}>×</button>
      </header>
      <div className="character-sheet-workspace">
        <div className="character-sheet-overview" hidden={!!inspection}>
          <section className="character-sheet-equipment" aria-labelledby="character-equipment-heading">
            <h3 id="character-equipment-heading">Снаряжение <span>Нажмите на ячейку</span></h3>
            <div className="character-equipment-stage">
              <ol className="character-equipment-grid" aria-label="Экипировка">{model.equipment.map(renderSlot)}</ol>
              <button className="character-body-open" type="button" aria-label="Подробнее о состоянии тела" onClick={() => inspect({ kind: 'body' })}>
                <CharacterSilhouette body={model.body} />
                <span className="character-body-readings">{model.body && BODY_PARTS.map(part => {
                  const view = bodyPartView(model.body!, part);
                  return <span key={part} data-state={view.state} title={`${bodyPartNames[part]}: ${view.current} / ${view.max}`}>
                    <span>{bodyPartAbbreviations[part]}</span><b>{view.state === 'lost' ? '×' : view.current}</b>
                  </span>;
                })}</span>
                <span className="character-body-link">Состояние тела ↗</span>
              </button>
            </div>
          </section>
          <section className="character-sheet-attributes" aria-labelledby="character-attributes-heading"><h3 id="character-attributes-heading">Атрибуты</h3>
            <dl>{model.attributes.map(entry => <div key={entry.id} data-boosted={Boolean(entry.boosted)} data-negative={entry.numericValue < 0}>
              <dt><button type="button" onClick={() => inspect({ kind: 'attribute', id: entry.id })}>{entry.name}</button></dt><dd>{entry.value}</dd>
            </div>)}</dl>
          </section>
          <CharacterEffects compact includeEquipment={false} unit={model.unit} roster={state.units} content={content} active={state.status === 'running'} onInspectEffect={effect => inspect({ kind: 'effect', id: effect.id })} />
        </div>
        {inspection && <div className="character-sheet-inspector">
          {selectedSlot && target && inventoryEnabled && progress && hero && onEquipInventory ? <InventorySlotPanel
            key={`${controlledActorId}:${target}`} slot={selectedSlot} target={target} hero={hero} progress={progress} body={model.body}
            content={gameContent} attributes={model.attributes} onEquip={onEquipInventory} onClose={back} />
            : selectedSlot ? <section className="character-detail-pane" aria-label={selectedSlot.name}>
              <h3 className="character-inspector-title" tabIndex={-1}>{selectedSlot.slotLabel ?? selectedSlot.category}</h3>
              <div className="character-detail-scroll">{selectedSlot.equipment ? <><h4 data-equipment-rarity={selectedSlot.rarity}>{selectedSlot.occupiedBy ?? selectedSlot.name}</h4>
                <RewardEquipmentDetails item={selectedSlot.equipment} body={model.body} equipment={equipped} /></> : <LoadoutDescription slot={selectedSlot} />}</div>
            </section> : inspection.kind === 'body' ? <section className="character-detail-pane character-body-details">
              <h3 className="character-inspector-title" tabIndex={-1}>Состояние тела</h3>
              <div className="character-detail-scroll"><BodyStatus body={model.body} armor={model.bodyArmor} detailed />{model.bodyNote && <p>{model.bodyNote}</p>}</div>
            </section> : attribute ? <section className="character-detail-pane"><h3 className="character-inspector-title" tabIndex={-1}>{attribute.name} · {attribute.value}</h3>
              <p>{attribute.description}</p></section> : inspection.kind === 'effect' ? <section className="character-detail-pane">
              <h3 className="character-inspector-title" tabIndex={-1}>{effect?.name ?? 'Эффект завершился'}</h3>{effect && <div className="character-detail-scroll"><CharacterEffectDetails effect={effect} content={content} /></div>}
            </section> : null}
        </div>}
      </div>
      <CharacterSkillList compact slots={skillSlots} content={content} onInspectSlot={slot => inspect({ kind: 'slot', id: slot.id })} selectedId={selectedSlot?.id} />
    </div>}
  </section>;
}
