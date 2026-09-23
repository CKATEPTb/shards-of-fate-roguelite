import { deserializeExpedition, deserializeSnapshot, restoreHeroBody, serializeExpedition, serializeSnapshot } from '@shards/game-core';
import { MAX_STATE_BYTES } from '@shards/protocol';
import type { ExpeditionState, GameContent, RoamingGroup, RoamingState, WorldActor } from '@shards/shared';

export interface ExpeditionUpdate { kind: 'snapshot' | 'patch'; state: string }
interface ExpeditionPatch {
  version: 1;
  world?: Partial<Pick<ExpeditionState['world'], 'actors' | 'tick' | 'transitions' | 'visited'>>;
  clearedPoiIds?: string[];
  activePoiId?: string | null;
  completed?: boolean;
  failed?: boolean;
  combat?: string | null;
  roaming?: { battleSerial: number; active: RoamingState['active']; chunks: Record<string, RoamingGroup[]> };
}

/** Maps are deterministic and rebuilt only when entering a new chunk, never on movement ticks. */
export function encodeExpeditionUpdate(previous: ExpeditionState | null, next: ExpeditionState, content: GameContent): ExpeditionUpdate {
  if (!previous || previous.world.graph !== next.world.graph || previous.world.chunk !== next.world.chunk
    || previous.difficultyId !== next.difficultyId || !!previous.roaming !== !!next.roaming) {
    return { kind: 'snapshot', state: serializeExpedition(next, content) };
  }
  const patch: ExpeditionPatch = { version: 1 };
  const world: NonNullable<ExpeditionPatch['world']> = {};
  for (const key of ['actors', 'tick', 'transitions', 'visited'] as const) {
    if (previous.world[key] !== next.world[key]) Object.assign(world, { [key]: next.world[key] });
  }
  if (Object.keys(world).length) patch.world = world;
  for (const key of ['clearedPoiIds', 'activePoiId', 'completed', 'failed'] as const) {
    if (previous[key] !== next[key]) Object.assign(patch, { [key]: key === 'failed' ? !!next[key] : next[key] });
  }
  if (previous.combat !== next.combat) patch.combat = next.combat ? serializeSnapshot(next.combat) : null;
  if (next.roaming && previous.roaming !== next.roaming) {
    const chunks: Record<string, RoamingGroup[]> = {};
    for (const [id, groups] of Object.entries(next.roaming.chunks)) {
      if (previous.roaming!.chunks[id] !== groups) chunks[id] = groups;
    }
    patch.roaming = { chunks, battleSerial: next.roaming.battleSerial, active: next.roaming.active };
  }
  return { kind: 'patch', state: JSON.stringify(patch) };
}

function object(value: unknown, allowed?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректное состояние хоста.');
  const result = value as Record<string, unknown>;
  if (allowed && Object.keys(result).some(key => !allowed.includes(key))) throw new Error('Неизвестное поле состояния хоста.');
  return result;
}
function integer(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0; }
function strings(value: unknown, max: number): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every(item => typeof item === 'string' && item.length <= 128);
}
function checkJson(value: unknown, depth = 0, budget = { remaining: 500_000 }): void {
  if (--budget.remaining < 0 || depth > 32) throw new Error('Состояние хоста слишком сложное.');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Некорректное число состояния.');
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('Некорректный ключ состояния.');
    checkJson(child, depth + 1, budget);
  }
}
function checkActor(value: unknown, size: number): asserts value is WorldActor {
  const actor = object(value);
  const checkPoint = (value: unknown) => {
    const point = object(value, ['x', 'y']);
    if (!integer(point.x) || !integer(point.y) || point.x >= size || point.y >= size) throw new Error('Некорректная позиция героя.');
  };
  if (typeof actor.id !== 'string' || actor.id.length > 128 || !Array.isArray(actor.path) || actor.path.length > size * size) throw new Error('Некорректный герой.');
  checkPoint(actor.position);
  actor.path.forEach(checkPoint);
  if (actor.movement !== undefined) {
    const movement = object(actor.movement, ['baseSpeed', 'bonusPercent', 'bootsBonusPercent', 'elapsedMs']);
    if (!['baseSpeed', 'bonusPercent', 'elapsedMs'].every(key => typeof movement[key] === 'number')
      || (movement.elapsedMs as number) < 0 || (movement.baseSpeed as number) <= 0) throw new Error('Некорректная скорость героя.');
  }
  if (actor.body !== undefined) restoreHeroBody(actor.body);
}
function checkRoaming(value: unknown, state: ExpeditionState): asserts value is NonNullable<ExpeditionPatch['roaming']> {
  const roaming = object(value, ['battleSerial', 'active', 'chunks']);
  if (!integer(roaming.battleSerial)) throw new Error('Некорректный счётчик боёв.');
  if (roaming.active !== null) {
    const active = object(roaming.active, ['groupIds', 'mobId', 'actorId', 'enemyIds', 'triggerRadius', 'includePursuers']);
    if (!strings(active.groupIds, 128) || !strings(active.enemyIds, 128) || typeof active.mobId !== 'string' || typeof active.actorId !== 'string') throw new Error('Некорректный бой.');
  }
  const chunks = object(roaming.chunks);
  for (const [id, groups] of Object.entries(chunks)) {
    if (id !== state.world.currentChunkId && !Object.hasOwn(state.roaming!.chunks, id)) throw new Error('Неизвестный регион противников.');
    if (!Array.isArray(groups) || groups.length > 128) throw new Error('Некорректные группы противников.');
    for (const value of groups) {
      const group = object(value);
      if (typeof group.id !== 'string' || !Array.isArray(group.members) || group.members.length > 128
        || !['normal', 'epic', 'miniboss'].includes(group.category as string) || !['patrol', 'chase'].includes(group.mode as string)
        || !integer(group.decision) || typeof group.pauseMs !== 'number' || typeof group.chases !== 'boolean') throw new Error('Некорректная группа противников.');
      for (const member of group.members) checkActor(member, state.world.chunk.size);
    }
  }
}

/** Applies a bounded patch by copying only changed branches. Unchanged geometry retains its identity. */
export function decodeExpeditionUpdate(previous: ExpeditionState | null, update: ExpeditionUpdate, content: GameContent): ExpeditionState {
  if (typeof update.state !== 'string' || new TextEncoder().encode(update.state).byteLength > MAX_STATE_BYTES) throw new Error('Состояние хоста слишком большое.');
  if (update.kind === 'snapshot') {
    const next = deserializeExpedition(update.state, content);
    if (previous && previous.world.graph.seed === next.world.graph.seed
      && previous.world.graph.structureVersion === next.world.graph.structureVersion) {
      next.world.graph = previous.world.graph;
      if (previous.world.currentChunkId === next.world.currentChunkId) next.world.chunk = previous.world.chunk;
    }
    return next;
  }
  if (!previous) throw new Error('Изменения получены до начального состояния.');
  const raw: unknown = JSON.parse(update.state);
  checkJson(raw);
  const patch = object(raw, ['version', 'world', 'clearedPoiIds', 'activePoiId', 'completed', 'failed', 'combat', 'roaming']);
  if (patch.version !== 1) throw new Error('Несовместимая версия состояния.');
  let world = previous.world;
  if (patch.world !== undefined) {
    const changes = object(patch.world, ['actors', 'tick', 'transitions', 'visited']);
    for (const key of ['tick', 'transitions']) if (changes[key] !== undefined && !integer(changes[key])) throw new Error('Некорректные часы мира.');
    if (changes.actors !== undefined) {
      if (!Array.isArray(changes.actors) || changes.actors.length !== previous.world.actors.length) throw new Error('Изменился состав отряда.');
      changes.actors.forEach((actor, index) => {
        checkActor(actor, world.chunk.size);
        if (actor.id !== previous.world.actors[index].id) throw new Error('Изменился состав отряда.');
      });
    }
    if (changes.visited !== undefined && !strings(changes.visited, world.graph.nodes.length * 8)) throw new Error('Некорректные посещённые регионы.');
    world = { ...world, ...changes } as ExpeditionState['world'];
  }
  if (patch.clearedPoiIds !== undefined && !strings(patch.clearedPoiIds, world.graph.nodes.length * 16 + 1)) throw new Error('Некорректные завершённые события.');
  if (patch.activePoiId !== undefined && patch.activePoiId !== null && typeof patch.activePoiId !== 'string') throw new Error('Некорректное событие.');
  for (const key of ['completed', 'failed']) if (patch[key] !== undefined && typeof patch[key] !== 'boolean') throw new Error('Некорректный результат похода.');
  let combat = previous.combat;
  if (Object.hasOwn(patch, 'combat')) {
    if (patch.combat !== null && typeof patch.combat !== 'string') throw new Error('Некорректное состояние боя.');
    combat = patch.combat === null ? null : deserializeSnapshot(patch.combat as string, content);
  }
  let roaming = previous.roaming;
  if (patch.roaming !== undefined) {
    if (!roaming) throw new Error('Изменения противников получены до начального состояния.');
    checkRoaming(patch.roaming, previous);
    roaming = { ...roaming, battleSerial: patch.roaming.battleSerial, active: patch.roaming.active,
      chunks: { ...roaming.chunks, ...patch.roaming.chunks } };
  }
  const { version: _version, world: _world, combat: _combat, roaming: _roaming, ...fields } = patch;
  return { ...previous, ...fields, world, combat, ...(roaming ? { roaming } : {}) } as ExpeditionState;
}
