import type { CombatState, WorldActor } from "@shards/shared";
import { findDefinition } from "../../catalog";
import { Portrait } from "../Portrait";
import { HeroHoverDetails } from './HeroHoverDetails';
import { BodyStatus } from './BodyStatus';

export function PartyHud({ state, actors, selected, hovered }: { state: CombatState; actors: WorldActor[]; selected: string; hovered: string | null }) {
  const inspected = hovered === 'party' || Boolean(hovered?.startsWith('hero:'));
  return <section className={`party-hud ${inspected ? 'hud-hovered' : ''}`} aria-label="Ваш отряд" data-testid="party-hud" data-hud-hover="party" data-inspected={String(inspected)}>
    <ul className="party-list">{state.units.filter((unit) => unit.team === "heroes").map((unit) => {
      const expanded = hovered === `hero:${unit.definitionId}`;
      return <li key={unit.id} className={`party-member ${selected === unit.definitionId ? 'selected' : ''} ${unit.hp <= 0 ? 'fallen' : ''} ${expanded ? 'hud-hovered' : ''}`} data-hud-hover={`hero:${unit.definitionId}`} data-inspected={String(expanded)} data-testid={`hero-info-${unit.definitionId}`} aria-current={selected === unit.definitionId ? 'true' : undefined} aria-describedby={expanded ? `hero-details-${unit.definitionId}` : undefined}>
        <span className="party-portrait"><Portrait unit={findDefinition(unit.definitionId)} /></span>
        <div className="party-copy"><span className="party-line"><strong>{unit.name}</strong><span className="party-protection" aria-label={`Общая защита: ${unit.stats.armor}`}>◇ {unit.stats.armor}</span></span><BodyStatus body={unit.body} /></div>
        {expanded && <HeroHoverDetails unit={unit} actor={actors.find(actor => actor.id === unit.definitionId)} />}
      </li>;
    })}</ul>
  </section>;
}
