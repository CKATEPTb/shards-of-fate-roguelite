import { effectiveMovementSpeed } from '@shards/game-core';
import type { Combatant, CombatState, GameContent, WorldActor } from '@shards/shared';
import { findDefinition, gameContent, roleNames } from '../../catalog';
import { BodyStatus } from './BodyStatus';
import { buildLoadout } from './loadoutModel';

export function HeroHoverDetails({ unit, actor, state, content = gameContent }: { unit: Combatant; actor?: WorldActor; state: CombatState; content?: GameContent }) {
  const definition = findDefinition(unit.definitionId, content);
  const movementSpeed = actor?.movement ? effectiveMovementSpeed({ ...actor, body: unit.body ?? actor.body }) : definition.movementSpeed ?? 100;
  const skills = definition.skillIds.map(id => content.skills.find(skill => skill.id === id)).filter(skill => !!skill);
  const model = buildLoadout(state, unit.id, content);
  return <div className="hero-hover-details" role="tooltip" id={`hero-details-${definition.id}`} data-testid={`hero-details-${definition.id}`} data-hud-hover={`hero:${definition.id}`}>
    <div className="hero-detail-heading"><strong>{definition.name}</strong><span>{roleNames[definition.role]}</span></div>
    <p>{definition.description}</p>
    <BodyStatus body={unit.body} armor={model.bodyArmor} detailed />
    <dl className="hero-hover-stats">
      {model.attributes.map(attribute => <div key={attribute.id} title={attribute.description}><dt>{attribute.name}</dt><dd>{attribute.value}</dd></div>)}
      <div className="hero-movement-speed"><dt>Скорость передвижения</dt><dd data-testid="hero-movement-speed">{movementSpeed.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%</dd></div>
    </dl>
    <div className="hero-hover-skills">{skills.map(skill => <div key={skill.id}><strong>{skill.name}</strong><span>{skill.description}</span></div>)}</div>
  </div>;
}
