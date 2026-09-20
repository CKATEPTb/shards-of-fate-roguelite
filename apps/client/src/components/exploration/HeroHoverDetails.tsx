import { effectiveMovementSpeed } from '@shards/game-core';
import type { Combatant, WorldActor } from '@shards/shared';
import { findDefinition, gameContent, roleNames } from '../../catalog';
import { BodyStatus } from './BodyStatus';

export function HeroHoverDetails({ unit, actor }: { unit: Combatant; actor?: WorldActor }) {
  const definition = findDefinition(unit.definitionId);
  const movementSpeed = actor?.movement ? effectiveMovementSpeed({ ...actor, body: unit.body ?? actor.body }) : definition.movementSpeed ?? 100;
  const skills = definition.skillIds.map(id => gameContent.skills.find(skill => skill.id === id)).filter(skill => !!skill);
  return <div className="hero-hover-details" role="tooltip" id={`hero-details-${definition.id}`} data-testid={`hero-details-${definition.id}`} data-hud-hover={`hero:${definition.id}`}>
    <div className="hero-detail-heading"><strong>{definition.name}</strong><span>{roleNames[definition.role]}</span></div>
    <p>{definition.description}</p>
    <BodyStatus body={unit.body} detailed />
    <dl className="hero-hover-stats">
      <div><dt>Сила</dt><dd>{unit.stats.power}</dd></div>
      <div><dt>Общая защита</dt><dd>{unit.stats.armor}</dd></div>
      <div><dt>Инициатива</dt><dd>{unit.stats.initiative}</dd></div>
      <div className="hero-movement-speed"><dt>Скорость передвижения</dt><dd data-testid="hero-movement-speed">{movementSpeed.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%</dd></div>
    </dl>
    <div className="hero-hover-skills">{skills.map(skill => <div key={skill.id}><strong>{skill.name}</strong><span>{skill.description}</span></div>)}</div>
  </div>;
}
