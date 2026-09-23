import { DiceLegend, DiceText } from '../DiceText';
import { gameContent } from '../../catalog';
import type { GameContent, InventoryTarget } from '@shards/shared';
import { SkillRarityBadge } from '../SkillRarity';
import { AuraIcon } from '../AuraIcon';
import { LoadoutIcon } from './LoadoutIcon';
import type { LoadoutSlot } from './loadoutModel';

const SLOT_LABELS: Record<string, string> = {
  class: 'Классовая способность', characterActive: 'Активная способность', passive: 'Пассивная способность',
  extra1: 'Дополнительная · I', extra2: 'Дополнительная · II',
};

function turns(value: number): string {
  const ending = value % 100 >= 11 && value % 100 <= 14 ? 'ходов' : value % 10 === 1 ? 'ход' : value % 10 >= 2 && value % 10 <= 4 ? 'хода' : 'ходов';
  return `${value} ${ending}`;
}

function descriptionFor(slot: LoadoutSlot): string {
  const cooldown = /\s*Перезарядка:\s*(\d+)\s+ход(?:а|ов)?[.!]?\s*$/iu.exec(slot.description);
  return cooldown && Number(cooldown[1]) === slot.cooldown?.base
    ? slot.description.slice(0, cooldown.index).trim() : slot.description;
}

/** All five slots stay visible, with the rules beside the ability instead of behind a tooltip. */
export function CharacterSkillList({ slots, content = gameContent, onSelectSlot, selectedSlot }: {
  slots: readonly LoadoutSlot[]; content?: GameContent;
  onSelectSlot?: (target: 'skill0' | 'skill1') => void; selectedSlot?: InventoryTarget | null;
}) {
  return <section className="character-sheet-skills" aria-labelledby="character-skills-heading">
    <h3 id="character-skills-heading">Способности</h3>
    <DiceLegend rules={slots.flatMap(slot => slot.diceRules ?? [])} />
    <ol className="character-skill-list" data-testid="skill-slots">{slots.map(slot => {
      const target = slot.id === 'extra1' ? 'skill0' : slot.id === 'extra2' ? 'skill1' : undefined;
      const selectable = !!target && !!onSelectSlot;
      return <li key={slot.id}>
      <article className={`character-skill ${slot.empty ? 'character-skill-empty' : ''}${selectable ? ' character-skill-selectable' : ''}`}
        data-selected={!!target && selectedSlot === target}
        onClick={selectable ? () => onSelectSlot!(target!) : undefined}
        data-testid={`loadout-slot-${slot.id}`} data-empty={String(slot.empty)} data-content-id={slot.contentId}
        data-cooldown={slot.cooldown?.remaining} aria-label={`${SLOT_LABELS[slot.id] ?? slot.category}: ${slot.name}`}>
        <div className="character-skill-art" aria-hidden="true">{!slot.empty && slot.contentId && (slot.id === 'extra1' || slot.id === 'extra2')
          ? <AuraIcon id={slot.contentId} size={36} /> : <LoadoutIcon kind={slot.icon} />}</div>
        <div className="character-skill-content">
          <span className="character-skill-category">{SLOT_LABELS[slot.id] ?? slot.category}</span>
          <SkillRarityBadge rarity={content.skills.find(skill => skill.id === slot.contentId)?.rarity} />
          <div className="character-skill-heading"><h4>{selectable ? <button type="button" className="character-skill-open" data-loadout-slot={slot.id}
            aria-expanded={selectedSlot === target} aria-controls={selectedSlot === target ? 'inventory-slot-panel' : undefined}>
            {slot.name}<span className="sr-only">. Открыть подходящие находки для слота</span>
          </button> : slot.name}</h4>
            {!slot.empty && <span className={`character-skill-state ${(slot.cooldown?.remaining ?? 0) > 0 ? 'is-recharging' : ''}`}>
              {(slot.cooldown?.remaining ?? 0) > 0 ? `Через ${turns(slot.cooldown!.remaining)}` : slot.id === 'passive' ? 'Пассивно' : 'Готово'}
            </span>}
          </div>
          {selectable && <span className="character-skill-choose">Нажмите, чтобы выбрать находку</span>}
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
