import type { WorldGraph } from '@shards/shared';

interface FlowEdge { to: number; reverse: number; capacity: number }

/** Independent verification: split vertices, then find unit flows to distinct winter nodes. */
export function independentWinterRoutes(graph: WorldGraph, required = 3): number {
  const indexes = new Map(graph.nodes.map((node, index) => [node.id, index]));
  const start = indexes.get(graph.startId);
  if (start === undefined) return 0;
  const sink = graph.nodes.length * 2;
  const adjacency: FlowEdge[][] = Array.from({ length: sink + 1 }, () => []);
  const add = (from: number, to: number, capacity: number) => {
    const forward: FlowEdge = { to, capacity, reverse: adjacency[to].length };
    const reverse: FlowEdge = { to: from, capacity: 0, reverse: adjacency[from].length };
    adjacency[from].push(forward); adjacency[to].push(reverse);
  };
  graph.nodes.forEach((node, index) => {
    add(index * 2, index * 2 + 1, node.id === graph.startId ? required : 1);
    if (node.season === 'winter') add(index * 2 + 1, sink, 1);
    for (const destination of Object.values(node.exits)) {
      const target = indexes.get(destination);
      if (target !== undefined) add(index * 2 + 1, target * 2, required);
    }
  });
  const source = start * 2;
  let flow = 0;
  while (flow < required) {
    const parentNode = new Int32Array(adjacency.length).fill(-1);
    const parentEdge = new Int32Array(adjacency.length);
    const queue = [source]; parentNode[source] = source;
    for (let cursor = 0; cursor < queue.length && parentNode[sink] === -1; cursor++) {
      const current = queue[cursor];
      adjacency[current].forEach((edge, edgeIndex) => {
        if (edge.capacity > 0 && parentNode[edge.to] === -1) {
          parentNode[edge.to] = current; parentEdge[edge.to] = edgeIndex; queue.push(edge.to);
        }
      });
    }
    if (parentNode[sink] === -1) break;
    for (let cursor = sink; cursor !== source; cursor = parentNode[cursor]) {
      const edge = adjacency[parentNode[cursor]][parentEdge[cursor]];
      edge.capacity--; adjacency[cursor][edge.reverse].capacity++;
    }
    flow++;
  }
  return flow;
}
