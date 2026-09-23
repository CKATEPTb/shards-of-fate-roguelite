import { useState, type CSSProperties } from 'react';
import type { AuraVisualDefinition, Combatant, GameContent } from '@shards/shared';
import { findDefinition, gameContent } from '../catalog';
import { equipmentAurasFor } from '../game/equipmentAuras';
import { AuraIcon } from './AuraIcon';
import './auraIcons.css';

export interface AuraDetails {
  id: string; name: string; description: string; timing: string;
  durations: (number | null)[]; color: string; negative: boolean; icon: string;
  stacks: number; decays?: boolean; expiresAtStart?: boolean; passive?: boolean;
  equipment?: boolean; visual?: AuraVisualDefinition;
}

export function unitAuras(unit: Combatant, roster: readonly Combatant[] = [unit], content: GameContent = gameContent): AuraDetails[] {
  const groups = new Map<string, AuraDetails>();
  for (const status of unit.statuses) {
    const found = groups.get(status.id);
    if (found) { found.durations.push(status.remaining); found.stacks += status.stacks ?? 1; continue; }
    const definition = content.statuses.find(item => item.id === status.id);
    const negative = definition?.polarity === 'negative';
    const decays = definition?.stacking === 'decay';
    const expiresAtStart = definition?.expiresAt === 'TURN_STARTED';
    groups.set(status.id, { id: status.id, name: definition?.name ?? status.id,
      description: definition?.description ?? 'Действующий эффект.',
      timing: decays ? 'В конце хода носителя: урон по числу зарядов, затем −1 заряд'
        : expiresAtStart ? 'Защита действует до начала следующего собственного хода'
        : definition?.trigger === 'TURN_STARTED' ? 'Срабатывает в начале собственного хода носителя'
        : definition?.trigger === 'TURN_ENDED' ? 'Срабатывает в конце собственного хода носителя' : 'Действует постоянно, пока активна аура',
      durations: [status.remaining], color: definition?.color ?? '#c6c592', negative,
      icon: status.id, stacks: status.stacks ?? 1, decays, expiresAtStart });
  }
  for (const { id, aura, timing } of equipmentAurasFor(unit, findDefinition(unit.definitionId, content))) {
    groups.set(id, { id, name: aura.name, description: aura.description, timing,
      durations: [null], color: aura.visual.colors[1], negative: false,
      icon: id, stacks: 1, equipment: true, visual: aura.visual });
  }
  const passive = findDefinition(unit.definitionId, content).passive;
  if (passive) groups.set('passive', { id: 'passive', name: passive.name, description: passive.description,
    timing: 'Постоянное свойство персонажа', durations: [null], color: '#c4b78a', negative: false,
    icon: `${unit.definitionId}:passive`, stacks: 1, passive: true });
  if (unit.shield > 0) {
    const layers = (unit.shieldLayers ?? []).filter(layer => layer.capacity > 0);
    const bone = layers.filter(layer => roster.find(source => source.id === layer.sourceId)?.definitionId === 'necromancer');
    const boneCapacity = Math.min(unit.shield, bone.reduce((sum, layer) => sum + layer.capacity, 0));
    if (boneCapacity > 0) groups.set('bone_shield', { id: 'bone_shield', name: 'Костяной щит',
      description: `Осталось ${boneCapacity} ед. поглощения. Перед расходованием ёмкости живой Некромант бросает 1d4: на 4 щит поглощает удар без потери ёмкости.`,
      timing: 'Поглощает входящий урон; длительность убывает в конце собственного хода',
      durations: bone.map(layer => layer.remaining), color: '#b9d6ba', negative: false, icon: 'bone_shield', stacks: bone.length });
    const otherCapacity = unit.shield - boneCapacity;
    if (otherCapacity > 0) {
      const others = layers.filter(layer => !bone.includes(layer));
      groups.set('shield', { id: 'shield', name: 'Защитный щит',
        description: `Осталось ${otherCapacity} ед. поглощения. Сначала расходуются слои с ближайшим сроком завершения.`,
        timing: 'Поглощает входящий урон; у каждого слоя свой срок действия',
        durations: others.length ? others.map(layer => layer.remaining) : [null],
        color: '#a7d9dc', negative: false, icon: 'shield', stacks: Math.max(1, others.length) });
    }
  }
  return [...groups.values()];
}

function auraDuration(aura: AuraDetails): string {
  if (aura.equipment) return 'Пока собран комплект';
  if (aura.decays) return `${aura.stacks} зарядов, −1 в конце собственного хода`;
  if (aura.expiresAtStart) return 'До начала следующего собственного хода';
  const finite = aura.durations.filter((duration): duration is number => duration !== null);
  if (!finite.length) return aura.passive ? 'Постоянная способность' : 'Бессрочно';
  const first = Math.min(...finite);
  const last = Math.max(...finite);
  return `Осталось своих ходов: ${first === last ? first : `${first}–${last}`}`;
}

export function AuraDescription({ aura, unitName, onClose }: { aura: AuraDetails; unitName: string; onClose: () => void }) {
  return <div className="aura-detail-backdrop" onClick={onClose}>
    <section className="aura-detail glass-panel" role="dialog" aria-label={`${aura.name}: ${unitName}`} aria-modal="true" onClick={event => event.stopPropagation()} onKeyDown={event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') { event.preventDefault(); event.currentTarget.querySelector('button')?.focus(); }
    }}>
      <button className="aura-close" onClick={onClose} autoFocus aria-label="Закрыть описание ауры">×</button>
      <span className="eyebrow">{unitName} · {aura.equipment ? 'Аура комплекта' : aura.passive ? 'Пассивная способность' : aura.negative ? 'Отрицательная аура' : 'Положительная аура'}</span>
      <div className="aura-detail-heading"><AuraIcon id={aura.icon} visual={aura.visual} size={56} /><h3>{aura.name}{aura.stacks > 1 ? ` ×${aura.stacks}` : ''}</h3></div>
      <p>{aura.description}</p><p className="aura-timing">{aura.timing}</p>
      {aura.decays ? <p className="aura-decay">Зарядов сейчас: <b>{aura.stacks}</b>. Следующее срабатывание нанесёт <b>{aura.stacks}</b> урона, после него останется <b>{Math.max(0, aura.stacks - 1)}</b>.</p>
        : aura.expiresAtStart || aura.equipment ? <p className="aura-duration-note">{auraDuration(aura)}</p>
        : <ul>{aura.durations.map((duration, index) => <li key={index}>{aura.durations.length > 1 ? `Слой ${index + 1}: ` : ''}{duration === null ? aura.passive ? 'Постоянно' : 'Бессрочно' : `Осталось своих ходов: ${duration}`}</li>)}</ul>}
    </section>
  </div>;
}

export function StatusBadges({ unit, roster, onInspect, content = gameContent }: { unit: Combatant; roster?: readonly Combatant[]; onInspect?: (aura: AuraDetails) => void; content?: GameContent }) {
  const [opened, setOpened] = useState<string>();
  const auras = unitAuras(unit, roster, content);
  const selected = auras.find(aura => aura.id === opened);
  if (!auras.length || unit.escaped) return null;
  return <>
    <div className="hero-statuses aura-grid" aria-label={`Ауры: ${unit.name}`}>
      {auras.map(aura => {
        const finite = aura.durations.filter((duration): duration is number => duration !== null);
        const remaining = aura.decays ? '−1' : aura.expiresAtStart ? '↥' : finite.length ? Math.min(...finite) : '∞';
        return <button key={aura.id} className="aura-icon" data-negative={aura.negative} style={{ '--aura-color': aura.color } as CSSProperties}
          title={`${aura.name}${aura.stacks > 1 ? ` ×${aura.stacks}` : ''}. ${aura.description} ${aura.timing}. ${auraDuration(aura)}.`}
          aria-label={`${aura.name}, зарядов: ${aura.stacks}. ${auraDuration(aura)}. Подробнее`}
          onClick={() => onInspect ? onInspect(aura) : setOpened(aura.id)}>
          <AuraIcon id={aura.icon} visual={aura.visual} /><small className="aura-turns">{remaining}</small>
          {(aura.stacks > 1 || aura.decays) && <b className="aura-stacks">{aura.stacks}</b>}
        </button>;
      })}
    </div>
    {selected && <AuraDescription aura={selected} unitName={unit.name} onClose={() => setOpened(undefined)} />}
  </>;
}
