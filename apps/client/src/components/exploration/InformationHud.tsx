import { useMemo, useRef } from 'react';
import type { CombatState, ExplorationState, GameContent } from '@shards/shared';
import { resolveWorldNode } from '@shards/game-core';
import { gameContent } from '../../catalog';
import { PartyHud } from './PartyHud';
import { WorldMap } from './WorldMap';
import { useInformationalHover } from './useInformationalHover';

export function InformationHud({ world, state, selected, disabled, content = gameContent }: { world: ExplorationState; state: CombatState; selected: string; disabled: boolean; content?: GameContent }) {
  const root = useRef<HTMLDivElement>(null);
  const hovered = useInformationalHover(root, disabled);
  const node = useMemo(() => resolveWorldNode(world.graph, world.currentChunkId), [world.graph, world.currentChunkId]);
  const underground = world.chunk.layer === 'basement';
  const actor = world.actors.find(item => item.id === selected) ?? world.actors[0];
  const x = (node?.x ?? 0) * world.chunk.size + actor.position.x - Math.floor(world.chunk.size / 2);
  const y = (node?.y ?? 0) * world.chunk.size + actor.position.y - Math.floor(world.chunk.size / 2);

  return <div ref={root} className="information-hud" data-testid="information-hud">
    <PartyHud state={state} actors={world.actors} selected={selected} hovered={hovered} content={content} />
    <section className={`minimap-hud ${hovered === 'map' ? 'hud-hovered' : ''}`} data-hud-hover="map" data-inspected={String(hovered === 'map')} data-testid="minimap-hud" aria-label={underground ? 'Подвал. Карта поверхности над подземельем' : 'Карта окрестностей'}>
      <div className="minimap-heading">{underground ? 'Подвал · −1' : 'Карта'}</div>
      <WorldMap world={world} />
      <div className="global-coordinates" data-testid="actor-position" data-x={x} data-y={y} data-layer={world.chunk.layer ?? 'surface'} title={underground ? `Под участком ${node?.id ?? world.chunk.surfaceNodeId}. Миникарта показывает поверхность.` : undefined}>X {x}<i aria-hidden="true"> · </i>Y {y}</div>
    </section>
  </div>;
}
