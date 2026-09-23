import type { GridPoint, WorldGraph, WorldNode, WorldPoi } from '@shards/shared';
import { createRng, hashString } from '../random';
import { worldDie } from './generation-dice';
import { insidePocketMask, type DetachedPocket } from './pockets';

/** A symmetric pairing needs no global mutable registry and no destination chunk generation. */
export function portalForNode(graph: WorldGraph, node: WorldNode, pocket: DetachedPocket | null, pois: readonly WorldPoi[]): WorldPoi | undefined {
  if ((graph.structureVersion ?? 1) < 3 || node.x === 0 && node.y === 0) return undefined;
  const targetId = `${-node.x},${-node.y}`;
  const pair = [node.id, targetId].sort();
  const rng = createRng(`portal-pair-v3:${hashString(graph.seed)}:${pair.join(':')}`);
  if (worldDie(rng, 24) !== 24) return undefined;
  const positions: GridPoint[] = [{ x: 25, y: 17 }, { x: 17, y: 25 }, { x: 9, y: 17 }, { x: 17, y: 9 }];
  const offset = worldDie(createRng(`portal-position-v3:${hashString(graph.seed)}:${node.id}`), positions.length) - 1;
  const position = positions.map((_, index) => positions[(index + offset) % positions.length]).find(point =>
    !insidePocketMask(point, pocket) && pois.every(poi => Math.abs(poi.position.x - point.x) > 2 || Math.abs(poi.position.y - point.y) > 2));
  if (!position) throw new Error(`No portal placement at ${node.id}`);
  return { id: `${node.id}:portal`, kind: 'portal', position: { ...position }, destination: { chunkId: targetId, poiId: `${targetId}:portal` } };
}
