import { useMemo, useRef } from 'react';
import type { CombatState, ExplorationState } from '@shards/shared';
import { PartyHud } from './PartyHud';
import { WorldMap } from './WorldMap';
import { useInformationalHover } from './useInformationalHover';

export function InformationHud({ world, state, selected, disabled }: { world: ExplorationState; state: CombatState; selected: string; disabled: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const hovered = useInformationalHover(root, disabled);
  const node = useMemo(() => world.graph.nodes.find(item => item.id === world.currentChunkId)!, [world.graph, world.currentChunkId]);
  const actor = world.actors.find(item => item.id === selected) ?? world.actors[0];
  const x = node.x * world.chunk.size + actor.position.x - Math.floor(world.chunk.size / 2);
  const y = node.y * world.chunk.size + actor.position.y - Math.floor(world.chunk.size / 2);

  return <div ref={root} className="information-hud" data-testid="information-hud">
    <PartyHud state={state} actors={world.actors} selected={selected} hovered={hovered} />
    <section className={`minimap-hud ${hovered === 'map' ? 'hud-hovered' : ''}`} data-hud-hover="map" data-inspected={String(hovered === 'map')} data-testid="minimap-hud" aria-label="Карта окрестностей">
      <div className="minimap-heading">Карта</div>
      <WorldMap world={world} />
      <div className="global-coordinates" data-testid="actor-position" data-x={x} data-y={y}>X {x}<i aria-hidden="true"> · </i>Y {y}</div>
    </section>
  </div>;
}
