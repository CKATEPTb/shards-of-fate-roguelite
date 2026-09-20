import { useId, useMemo } from 'react';
import type { ExplorationState, GridPoint } from '@shards/shared';
import { seasonColors, seasonLabels } from './labels';
import { buildMinimapDiscovery, minimapViewport, MINIMAP_GEOMETRY } from './minimap-discovery';
import './worldmap.css';

const { center: CENTER, radius: RADIUS, spacing: SPACING } = MINIMAP_GEOMETRY;

/** Circular surroundings with clipped passage lines towards off-map neighbors. */
export function WorldMap({ world }: { world: ExplorationState }) {
  const clipId = useId();
  const byId = useMemo(() => new Map(world.graph.nodes.map(node => [node.id, node])), [world.graph]);
  const current = byId.get(world.currentChunkId)!;
  const discovery = useMemo(() => buildMinimapDiscovery(byId, world.visited), [byId, world.visited]);
  const { nodes, edges } = useMemo(() => minimapViewport(byId, discovery, world.currentChunkId, world.graph.altarNodeId),
    [byId, discovery, world.currentChunkId, world.graph.altarNodeId]);
  const project = (point: GridPoint) => ({ x: CENTER + (point.x - current.x) * SPACING, y: CENTER + (point.y - current.y) * SPACING });

  return <svg className="world-map" viewBox="0 0 320 320" role="presentation">
    <defs><clipPath id={clipId}><circle cx={CENTER} cy={CENTER} r={RADIUS} /></clipPath></defs>
    <circle cx={CENTER} cy={CENTER} r={RADIUS} className="minimap-field" />
    <path d="M160 9v9m0 284v9M9 160h9m284 0h9" className="map-compass-ticks" />
    <g clipPath={`url(#${clipId})`}>
    {edges.map(({ id, from, to, traveled }) => <line key={id} data-from={from.id} data-to={to.id} x1={project(from).x} y1={project(from).y} x2={project(to).x} y2={project(to).y} className={`map-edge ${traveled ? 'traveled' : ''}`} />)}
    {nodes.map(node => {
      const position = project(node);
      return <g key={node.id} data-node-id={node.id} transform={`translate(${position.x} ${position.y})`} className={`map-node ${node.current ? 'current' : ''} ${node.visited ? 'visited' : ''}`} style={{ color: node.season ? seasonColors[node.season] : '#8c9785' }}>
        <title>{node.season ? `${seasonLabels[node.season]} · ${node.x}, ${node.y}${node.current ? ' · Вы здесь' : node.altar ? ' · Зимний алтарь' : ' · Исследовано'}` : 'Неисследованный участок'}</title>
        {node.current ? <><circle r="11" className="current-node-ring" /><path d="M0-7 6 0 0 7-6 0Z" className="current-node" /></> : node.altar ? <path d="m0-8 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" className="altar-node" /> : <circle r="4" className="node-dot" />}
      </g>;
    })}
    </g>
  </svg>;
}
