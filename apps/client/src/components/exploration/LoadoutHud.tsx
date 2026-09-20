import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import type { CombatState } from '@shards/shared';
import { buildLoadout, loadoutColumns, type LoadoutSlot } from './loadoutModel';
import { LoadoutIcon } from './LoadoutIcon';
import { LoadoutDescription } from './LoadoutDescription';
import { useLoadoutTooltipPosition } from './useLoadoutTooltipPosition';
import { BodyStatus } from './BodyStatus';
import './loadoutHud.css';

const intercept = (event: SyntheticEvent) => event.stopPropagation();

export function LoadoutHud({ state, controlledActorId, disabled }: { state: CombatState; controlledActorId: string; disabled: boolean }) {
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const model = useMemo(() => buildLoadout(state, controlledActorId), [state, controlledActorId]);
  const columns = useMemo(() => loadoutColumns(model), [model]);
  const candidate = pinned ?? hovered ?? focused;
  const activeId = open && !disabled && candidate !== dismissed ? candidate : null;
  const active = [...model.equipment, ...model.skills].find(slot => slot.id === activeId);
  const position = useLoadoutTooltipPosition(active, panel, toggle, tooltip);

  const clearTransient = useCallback(() => { setHovered(null); setFocused(null); }, []);
  const closePanel = useCallback(() => {
    setOpen(false);
    setPinned(null);
    setDismissed(null);
    clearTransient();
    toggle.current?.focus();
  }, [clearTransient]);

  useEffect(() => {
    if (disabled) {
      clearTransient();
      setPinned(null);
      setDismissed(null);
    }
  }, [disabled, clearTransient]);

  useEffect(() => {
    if (!open || disabled) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closePanel();
    };
    window.addEventListener('keydown', escape);
    window.addEventListener('resize', clearTransient);
    window.addEventListener('blur', clearTransient);
    return () => {
      window.removeEventListener('keydown', escape);
      window.removeEventListener('resize', clearTransient);
      window.removeEventListener('blur', clearTransient);
    };
  }, [open, disabled, closePanel, clearTransient]);

  const closeDescription = () => {
    setPinned(null);
    panel.current?.querySelector<HTMLButtonElement>(`[data-loadout-slot="${activeId}"]`)?.focus({ preventScroll: true });
    setDismissed(activeId);
  };

  const renderSlot = (slot: LoadoutSlot) => <li key={slot.id}>
    <button type="button" disabled={disabled}
      className={`loadout-slot ${slot.empty ? 'loadout-empty' : 'loadout-filled'} ${slot.condition ? `loadout-${slot.condition}` : ''} ${active?.id === slot.id ? 'loadout-selected' : ''}`}
      data-testid={`loadout-slot-${slot.id}`} data-loadout-slot={slot.id}
      data-empty={String(slot.empty)} data-content-id={slot.contentId} data-cooldown={slot.cooldown?.remaining}
      data-equipment-condition={slot.condition}
      aria-label={`${slot.name}. ${slot.category}.${slot.empty ? ' Пустой слот.' : ''}${slot.condition === 'unavailable' ? ' Недоступно.' : slot.condition === 'partial' ? ' Действует частично.' : ''}`}
      aria-expanded={active?.id === slot.id} aria-controls={active?.id === slot.id ? 'loadout-tooltip' : undefined}
      aria-describedby={active?.id === slot.id ? 'loadout-tooltip' : undefined}
      onPointerEnter={event => {
        if (event.pointerType === 'touch') return;
        setHovered(slot.id);
        setDismissed(null);
      }}
      onPointerLeave={() => setHovered(null)}
      onFocus={event => {
        if (!event.currentTarget.matches(':focus-visible')) return;
        setFocused(slot.id);
        setDismissed(null);
      }}
      onBlur={() => setFocused(null)}
      onClick={() => {
        if (pinned === slot.id) {
          setPinned(null);
          setDismissed(slot.id);
        } else {
          setPinned(slot.id);
          setDismissed(null);
        }
      }}>
      <LoadoutIcon kind={slot.icon} />
      {slot.cooldown && slot.cooldown.remaining > 0 && <span className="loadout-badge">{slot.cooldown.remaining}</span>}
      {slot.badge && <span className="loadout-badge loadout-passive-badge">{slot.badge}</span>}
      {slot.empty && <span className="loadout-empty-mark" aria-hidden="true" />}
    </button>
  </li>;

  return <section className={`loadout-hud ${open ? 'loadout-inspected' : ''}`} data-testid="loadout-hud"
    data-inspected={String(open)} data-hud-interactive aria-label={`Снаряжение и способности: ${model.heroName}`}>
    <button ref={toggle} type="button" className="loadout-toggle" data-testid="loadout-toggle"
      disabled={disabled} aria-expanded={open} aria-controls="loadout-panel"
      onPointerDown={intercept} onPointerUp={intercept}
      onClick={event => { intercept(event); if (open) closePanel(); else setOpen(true); }}>
      Экипировка
    </button>
    {open && <div ref={panel} id="loadout-panel" className="loadout-panel" data-testid="loadout-panel"
      onPointerDown={intercept} onPointerUp={intercept} onClick={intercept} onScrollCapture={clearTransient}>
      <section className="loadout-condition" aria-label={`Состояние: ${model.heroName}`}>
        <div className="loadout-condition-heading">{model.heroName}<span>Защита {model.armor}</span></div>
        <BodyStatus body={model.body} detailed />
        {model.bodyNote && <p className="loadout-body-state">{model.bodyNote}</p>}
      </section>
      <div className="loadout-columns">
        {columns.map(column => <div key={column.id} className="loadout-column">
          <span className="loadout-column-label">{column.label}</span>
          <ol className="loadout-slots" data-testid={`${column.id === 'skills' ? 'skill' : column.id}-slots`} aria-label={column.label}>
            {column.slots.map(renderSlot)}
          </ol>
        </div>)}
      </div>
    </div>}
    {active && <div ref={tooltip} id="loadout-tooltip" role="region" aria-label={`Описание: ${active.name}`}
      className="loadout-tooltip" data-testid="loadout-tooltip" style={position}
      onPointerDown={intercept} onPointerUp={intercept} onClick={intercept}>
      <button type="button" className="loadout-tooltip-close" aria-label="Закрыть описание" onClick={closeDescription}>×</button>
      <LoadoutDescription slot={active} />
    </div>}
  </section>;
}
