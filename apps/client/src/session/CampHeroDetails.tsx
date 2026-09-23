import { useId, useState, type CSSProperties } from 'react';
import type { UnitDefinition } from '@shards/shared';
import { gameContent, roleNames } from '../catalog';
import { AuraIcon } from '../components/AuraIcon';
import '../components/auraIcons.css';
import type { LoadoutSlot } from '../components/exploration/loadoutModel';
import { activeLoadoutSlot, passiveLoadoutSlot } from '../components/exploration/loadoutSkills';
import './campHeroDetails.css';

const turnForms: Record<string, string> = { one: 'ход', few: 'хода', many: 'ходов', other: 'хода' };
const turnPlural = new Intl.PluralRules('ru');

function describeHero(hero: UnitDefinition) {
  const skills = hero.skillIds.flatMap(id => gameContent.skills.find(skill => skill.id === id) ?? []);
  return {
    hero,
    summary: hero.description.match(/^[^.!?]+[.!?]/)?.[0] ?? hero.description,
    slots: [
      activeLoadoutSlot('class', `Классовое умение · ${roleNames[hero.role]}`, skills.find(skill => skill.tags.includes('ROLE'))),
      activeLoadoutSlot('characterActive', 'Активное умение героя', skills.find(skill => skill.tags.includes('CHARACTER'))),
      passiveLoadoutSlot(hero),
    ],
  };
}

// Every choice participates in layout before the user selects it.
const rosterDetails = gameContent.characters.map(describeHero);

function SkillDescription({ slot, reserve = false }: { slot: LoadoutSlot; reserve?: boolean }) {
  return <article className={`camp-skill-description${reserve ? ' camp-layout-reserve' : ''}`} data-selected={!reserve} aria-hidden={reserve || undefined}>
    <div className="camp-skill-description-heading"><h3>{slot.name}</h3>{slot.cooldown && slot.cooldown.base > 0 && <span className="camp-skill-cooldown" title="Перезарядка" aria-label={`Перезарядка: ${slot.cooldown.base} ${turnForms[turnPlural.select(slot.cooldown.base)]}`}><span aria-hidden="true">↻</span> {slot.cooldown.base} {turnForms[turnPlural.select(slot.cooldown.base)]}</span>}</div>
    <p>{slot.description}</p>
  </article>;
}

export function CampHeroDetails({ hero }: { hero: UnitDefinition }) {
  const [selection, setSelection] = useState({ heroId: hero.id, itemId: 'class' });
  const descriptionId = useId();
  if (selection.heroId !== hero.id) setSelection({ heroId: hero.id, itemId: 'class' });
  const { slots, summary } = rosterDetails.find(details => details.hero === hero) ?? describeHero(hero);
  const selectedId = selection.heroId === hero.id ? selection.itemId : 'class';
  const selectedSlot = slots.find(slot => slot.id === selectedId) ?? slots[0];
  const heroStyle = { '--hero-color': hero.color } as CSSProperties;

  return <section className="camp-hero-details" aria-label="Выбранный герой" style={heroStyle}>
    <div className="camp-hero-names">
      {rosterDetails.map(({ hero: candidate }) => <div key={candidate.id} className="camp-hero-name camp-layout-reserve" aria-hidden="true"><span className="camp-role">{roleNames[candidate.role]}</span><h2>{candidate.name}</h2></div>)}
      <div className="camp-hero-name"><span className="camp-role">{roleNames[hero.role]}</span><h2>{hero.name}</h2></div>
    </div>
    <div className="camp-hero-summaries">
      {rosterDetails.map(details => <p key={details.hero.id} className="camp-hero-summary camp-layout-reserve" aria-hidden="true">{details.summary}</p>)}
      <p className="camp-hero-summary">{summary}</p>
    </div>
    <div className="camp-hero-skills" role="group" aria-label="Умения героя">
      {slots.map((slot, index) => <button type="button" className="camp-skill-button" key={slot.id} aria-label={slot.name} aria-pressed={selectedId === slot.id} aria-controls={descriptionId} title={slot.name} disabled={slot.empty} onClick={() => setSelection({ heroId: hero.id, itemId: slot.id })}>
        <span className="camp-skill-icon"><AuraIcon id={slot.contentId ?? slot.icon} size={48} /></span>
        <span className="camp-skill-label">{['Класс', 'Умение', 'Пассивно'][index]}</span>
      </button>)}
    </div>
    <div id={descriptionId} className="camp-skill-descriptions" role="region" aria-label="Описание умения" aria-live="polite" aria-atomic="true">
      {rosterDetails.flatMap(details => details.slots.map(slot => <SkillDescription key={`${details.hero.id}:${slot.id}`} slot={slot} reserve />))}
      <SkillDescription slot={selectedSlot} />
    </div>
  </section>;
}
