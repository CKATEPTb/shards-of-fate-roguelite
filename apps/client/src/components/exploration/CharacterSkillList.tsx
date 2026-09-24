import { useId, useState } from 'react';
import { DiceLegend, DiceText } from '../DiceText';
import { gameContent } from '../../catalog';
import type { GameContent, InventoryTarget } from '@shards/shared';
import { SKILL_RARITY_NAMES, SkillRarityBadge } from '../SkillRarity';
import { SkillIcon } from '../SkillIcon';
import { AuraIcon } from '../AuraIcon';
import { LoadoutIcon } from './LoadoutIcon';
import type { LoadoutSlot } from './loadoutModel';
import './characterSkillList.css';

const SLOT_LABELS: Record<string, string> = {
  class: 'Классовая способность', characterActive: 'Активная способность', passive: 'Пассивная способность',
  extra1: 'Дополнительная · I', extra2: 'Дополнительная · II',
};

const SHORT_SLOT_LABELS: Record<string, string> = {
  class: 'Класс', characterActive: 'Герой', passive: 'Пассив', extra1: 'Навык I', extra2: 'Навык II',
};
const SHORT_RARITY = { common: 'Об.', rare: 'Редк.', epic: 'Эпик.', legendary: 'Лег.' } as const;

function skillTarget(slot: LoadoutSlot): 'skill0' | 'skill1' | undefined {
  return slot.id === 'extra1' ? 'skill0' : slot.id === 'extra2' ? 'skill1' : undefined;
}

function SkillArtwork({ slot, content }: { slot: LoadoutSlot; content: GameContent }) {
  const skill = content.skills.find(candidate => candidate.id === slot.contentId);
  if (!slot.empty && skill?.icon) return <SkillIcon icon={skill.icon} size={36} />;
  if (!slot.empty && slot.contentId && (slot.id === 'extra1' || slot.id === 'extra2')) return <AuraIcon id={slot.contentId} size={36} />;
  return <LoadoutIcon kind={slot.icon} />;
}

function turns(value: number): string {
  const ending = value % 100 >= 11 && value % 100 <= 14 ? 'ходов' : value % 10 === 1 ? 'ход' : value % 10 >= 2 && value % 10 <= 4 ? 'хода' : 'ходов';
  return `${value} ${ending}`;
}

function descriptionFor(slot: LoadoutSlot): string {
  const cooldown = /\s*Перезарядка:\s*(\d+)\s+ход(?:а|ов)?[.!]?\s*$/iu.exec(slot.description);
  return cooldown && Number(cooldown[1]) === slot.cooldown?.base
    ? slot.description.slice(0, cooldown.index).trim() : slot.description;
}

/** Compact inspection keeps all five slots visible; the default retains the expanded rules. */
export function CharacterSkillList({ slots, content = gameContent, onSelectSlot, selectedSlot, compact = false, onInspectSlot, selectedId, dropTargets, hoveredDropTarget }: {
  slots: readonly LoadoutSlot[]; content?: GameContent;
  onSelectSlot?: (target: 'skill0' | 'skill1') => void; selectedSlot?: InventoryTarget | null;
  compact?: boolean; onInspectSlot?: (slot: LoadoutSlot) => void; selectedId?: string | null;
  dropTargets?: readonly { target: InventoryTarget; reason: string }[];
  hoveredDropTarget?: InventoryTarget | null;
}) {
  const heading = useId();
  const [localId, setLocalId] = useState<string | null>(null);
  const isSelected = (slot: LoadoutSlot) => selectedId !== undefined ? selectedId === slot.id
    : selectedSlot !== undefined ? !!skillTarget(slot) && selectedSlot === skillTarget(slot) : localId === slot.id;
  const inspect = (slot: LoadoutSlot) => {
    const target = skillTarget(slot);
    if (onInspectSlot) onInspectSlot(slot);
    else if (target && onSelectSlot) onSelectSlot(target);
    else setLocalId(previous => previous === slot.id ? null : slot.id);
  };
  const localSlot = !onInspectSlot ? slots.find(slot => slot.id === localId) : undefined;

  if (compact) return <section className="character-skills-compact" aria-labelledby={heading}>
    <h3 id={heading}>Способности</h3>
    <ol className="character-skills-strip" data-testid="skill-slots">{slots.map(slot => {
      const target = skillTarget(slot);
      const drop = dropTargets?.find(choice => choice.target === target);
      const rarity = slot.rarity ?? content.skills.find(skill => skill.id === slot.contentId)?.rarity;
      const remaining = slot.cooldown?.remaining ?? 0;
      const cooldownLabel = remaining > 0 ? `Доступно через ${turns(remaining)}`
        : slot.cooldown?.base ? `Перезарядка: ${turns(slot.cooldown.base)}` : slot.id === 'passive' ? 'Пассивная способность' : 'Без перезарядки';
      const label = `${SLOT_LABELS[slot.id] ?? slot.category}: ${slot.name}${rarity ? `. ${SKILL_RARITY_NAMES[rarity]}` : ''}${slot.empty ? '. Пустой слот' : `. ${cooldownLabel}`}`;
      return <li key={slot.id}><button type="button" className="character-skill-tile" onClick={() => inspect(slot)}
        data-loadout-slot={slot.id} data-testid={`loadout-slot-${slot.id}`} data-empty={String(slot.empty)}
        data-inventory-drop-target={dropTargets ? target : undefined} data-drop-allowed={drop ? !drop.reason : dropTargets?.length === 0 ? true : undefined}
        data-drop-hover={!!drop && hoveredDropTarget === target}
        data-content-id={slot.contentId} data-cooldown={remaining} data-rarity={rarity}
        data-selected={isSelected(slot)} data-recharging={remaining > 0} aria-expanded={isSelected(slot)} aria-label={label} title={label}>
        <span className="character-skill-tile-label">{SHORT_SLOT_LABELS[slot.id] ?? slot.category}</span>
        <span className="character-skill-tile-art" aria-hidden="true"><SkillArtwork slot={slot} content={content} /></span>
        <span className="character-skill-tile-name">{slot.empty ? 'Не назначен' : slot.name}</span>
        <span className="character-skill-tile-meta" aria-hidden="true">
          {slot.empty ? 'Пусто' : <>{rarity && <span title={SKILL_RARITY_NAMES[rarity]}>{SHORT_RARITY[rarity]}</span>}
            {slot.cooldown && slot.cooldown.base > 0 ? <span title={cooldownLabel}>↻{remaining || slot.cooldown.base}</span>
              : !rarity && <span>{slot.id === 'passive' ? 'Всегда' : 'Готово'}</span>}</>}
        </span>
      </button></li>;
    })}</ol>
    {localSlot && <div className="character-skill-local-details"><h4>{localSlot.name}</h4>
      <p><DiceText text={localSlot.description} rules={localSlot.diceRules} /></p></div>}
  </section>;

  return <section className="character-sheet-skills" aria-labelledby={heading}>
    <h3 id={heading}>Способности</h3>
    <DiceLegend rules={slots.flatMap(slot => slot.diceRules ?? [])} />
    <ol className="character-skill-list" data-testid="skill-slots">{slots.map(slot => {
      const target = skillTarget(slot);
      const selectable = !!onInspectSlot || !!target && !!onSelectSlot;
      return <li key={slot.id}>
      <article className={`character-skill ${slot.empty ? 'character-skill-empty' : ''}${selectable ? ' character-skill-selectable' : ''}`}
        data-selected={isSelected(slot)}
        onClick={selectable ? () => inspect(slot) : undefined}
        data-testid={`loadout-slot-${slot.id}`} data-empty={String(slot.empty)} data-content-id={slot.contentId}
        data-cooldown={slot.cooldown?.remaining} aria-label={`${SLOT_LABELS[slot.id] ?? slot.category}: ${slot.name}`}>
        <div className="character-skill-art" aria-hidden="true"><SkillArtwork slot={slot} content={content} /></div>
        <div className="character-skill-content">
          <span className="character-skill-category">{SLOT_LABELS[slot.id] ?? slot.category}</span>
          <SkillRarityBadge rarity={slot.rarity ?? content.skills.find(skill => skill.id === slot.contentId)?.rarity} />
          <div className="character-skill-heading"><h4>{selectable ? <button type="button" className="character-skill-open" data-loadout-slot={slot.id}
            aria-expanded={isSelected(slot)} aria-controls={!onInspectSlot && isSelected(slot) ? 'inventory-slot-panel' : undefined}>
            {slot.name}<span className="sr-only">{onInspectSlot ? '. Открыть описание способности' : '. Открыть подходящие находки для слота'}</span>
          </button> : slot.name}</h4>
            {!slot.empty && <span className={`character-skill-state ${(slot.cooldown?.remaining ?? 0) > 0 ? 'is-recharging' : ''}`}>
              {(slot.cooldown?.remaining ?? 0) > 0 ? `Через ${turns(slot.cooldown!.remaining)}` : slot.id === 'passive' ? 'Пассивно' : 'Готово'}
            </span>}
          </div>
          {selectable && <span className="character-skill-choose">{onInspectSlot ? 'Нажмите, чтобы открыть описание' : 'Нажмите, чтобы выбрать находку'}</span>}
          {slot.empty ? <p className="character-skill-vacant">Способность не назначена</p>
            : <p className="character-skill-description"><DiceText text={descriptionFor(slot)} rules={slot.diceRules} /></p>}
          {!slot.empty && slot.cooldown && <span className="character-skill-cooldown">
            {slot.cooldown.base > 0 ? `Перезарядка: ${turns(slot.cooldown.base)}` : 'Без перезарядки'}
          </span>}
        </div>
      </article>
    </li>; })}</ol>
  </section>;
}
