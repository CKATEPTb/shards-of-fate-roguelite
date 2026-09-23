import type { WorldGraph, WorldNode } from '@shards/shared';

export interface BasementChunkIdentity { surfaceNodeId: string; houseOrdinal: number }

const SURFACE_ID = /^-?\d+,-?\d+$/;

/** A house keeps its own cellar even when the order of visiting chunks changes. */
export function basementChunkId(surfaceNodeId: string, houseOrdinal: number): string {
  if (!SURFACE_ID.test(surfaceNodeId) || !Number.isSafeInteger(houseOrdinal) || houseOrdinal < 0) throw new Error('Invalid basement identity');
  return `basement:${surfaceNodeId}:${houseOrdinal}`;
}

export function parseBasementChunkId(id: string): BasementChunkIdentity | undefined {
  const match = /^basement:(-?\d+,-?\d+):(0|[1-9]\d*)$/.exec(id);
  if (!match) return undefined;
  const houseOrdinal = Number(match[2]);
  return Number.isSafeInteger(houseOrdinal) ? { surfaceNodeId: match[1], houseOrdinal } : undefined;
}

/** Surface distance and season belong to the parent node, including while underground. */
export function surfaceNodeIdForChunk(id: string): string {
  return parseBasementChunkId(id)?.surfaceNodeId ?? id;
}

/** Resolves spatial metadata; use isWorldChunkId when the existence of a cellar matters. */
export function resolveWorldNode(graph: WorldGraph, chunkId: string): WorldNode | undefined {
  return graph.nodes.find(node => node.id === surfaceNodeIdForChunk(chunkId));
}
