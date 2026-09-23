import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCoopFrame, commandCoop, coopView, createCoopState, createExpedition, enableRoaming, isTerminal, leaveEncounter, moveExpedition, stepCoop, stepExpedition, stepExpeditionCombat } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import type { CoopFrame, CoopState, ExpeditionState } from '@shards/shared';
import type { MultiplayerCommand, RoomEvent, RoomRequest, RoomResponse, RoomRun, RoomState } from '@shards/protocol';
import { decodeExpeditionUpdate, encodeExpeditionUpdate } from '../apps/client/src/network/codec';
import { NetworkSession } from '../apps/client/src/network/session';
import type { RoomConnection } from '../apps/client/src/network/transport';
import { DELTAS } from '../packages/game-core/src/world/grid';
import { formationPoints } from '../packages/game-core/src/roaming/navigation';

const initial = () => createExpedition('MULTIPLAYER-SYNC', ['guardian', 'priest'], gameContent);
const tick = (state: ExpeditionState) => stepExpedition(enableRoaming(state, gameContent), gameContent, 50);
const initialCoop = () => createCoopState('MULTIPLAYER-SYNC', ['guardian', 'priest'], gameContent);
const runOf = (state: CoopState): RoomRun => ({ seed: state.seed, characterIds: [...state.characterIds], difficultyId: state.difficultyId, generatorVersion: 1 });

describe('expedition network updates', () => {
  it('matches the host over successive patches and keeps static map references', () => {
    let host = initial();
    let guest = decodeExpeditionUpdate(null, encodeExpeditionUpdate(null, host, gameContent), gameContent);
    const graph = guest.world.graph;
    const chunk = guest.world.chunk;
    for (let i = 0; i < 10; i++) {
      const next = tick(host);
      const update = encodeExpeditionUpdate(host, next, gameContent);
      expect(update.kind).toBe('patch');
      expect(update.state).not.toContain('"graph"');
      expect(update.state).not.toContain('"tiles"');
      guest = decodeExpeditionUpdate(guest, update, gameContent);
      expect(guest).toEqual(next);
      expect(guest.world.graph).toBe(graph);
      expect(guest.world.chunk).toBe(chunk);
      host = next;
    }
  });

  it('rejects invalid updates without mutating the previous state', () => {
    const state = initial();
    expect(() => decodeExpeditionUpdate(null, { kind: 'patch', state: '{"version":1}' }, gameContent)).toThrow();
    for (const raw of ['{"version":1,"world":{"graph":{}}}', '{"version":1,"world":{"tick":-1}}',
      '{"version":1,"world":{"actors":[]}}', '{"version":1,"roaming":{"__proto__":{"polluted":true}}}']) {
      expect(() => decodeExpeditionUpdate(state, { kind: 'patch', state: raw }, gameContent)).toThrow();
    }
    expect(state.world.tick).toBe(0);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('synchronizes a joint chunk transition with wounds and then resumes compact updates', () => {
    let host = createExpedition('FIRST-CAMPFIRE', ['guardian', 'priest'], gameContent);
    host.roaming!.chunks[host.world.currentChunkId] = [];
    const exit = host.world.chunk.exits[0];
    const delta = DELTAS[exit.direction];
    host.world.actors[0].position = { x: exit.position.x - delta.x, y: exit.position.y - delta.y };
    host.world.actors[0].body!.leftArm.current = 0;
    let guest = decodeExpeditionUpdate(null, encodeExpeditionUpdate(null, host, gameContent), gameContent);
    const originalGraph = guest.world.graph;
    const originalChunk = guest.world.chunk;
    const commanded = moveExpedition(host, 'guardian', exit.position).state;
    guest = decodeExpeditionUpdate(guest, encodeExpeditionUpdate(host, commanded, gameContent), gameContent);
    host = commanded;
    let snapshots = 0;
    for (let i = 0; i < 20 && host.world.currentChunkId !== exit.targetNodeId; i++) {
      const next = tick(host);
      const update = encodeExpeditionUpdate(host, next, gameContent);
      if (update.kind === 'snapshot') snapshots++;
      guest = decodeExpeditionUpdate(guest, update, gameContent);
      expect(guest).toEqual(next);
      host = next;
    }
    expect(host.world.currentChunkId).toBe(exit.targetNodeId);
    expect(snapshots).toBe(1);
    expect(guest.world.graph).toBe(originalGraph);
    expect(guest.world.chunk).not.toBe(originalChunk);
    expect(guest.world.actors[0].body!.leftArm.current).toBe(0);
    const next = tick(host);
    const update = encodeExpeditionUpdate(host, next, gameContent);
    expect(update.kind).toBe('patch');
    expect(decodeExpeditionUpdate(guest, update, gameContent)).toEqual(next);
  });

  it('synchronizes roaming combat turns and carries battle wounds back to exploration', () => {
    let host = createExpedition('FIRST-CAMPFIRE', ['guardian', 'priest', 'mage'], gameContent);
    let guest = decodeExpeditionUpdate(null, encodeExpeditionUpdate(null, host, gameContent), gameContent);
    const position = host.roaming!.chunks[host.world.currentChunkId][0].members[0].position;
    const adjacent = formationPoints(host.world.chunk, position, 2).find(point => point.x !== position.x || point.y !== position.y)!;
    const approached = { ...host, world: { ...host.world, actors: host.world.actors.map((actor, index) => index ? actor : { ...actor, position: adjacent }) } };
    guest = decodeExpeditionUpdate(guest, encodeExpeditionUpdate(host, approached, gameContent), gameContent);
    host = approached;
    const entered = tick(host);
    guest = decodeExpeditionUpdate(guest, encodeExpeditionUpdate(host, entered, gameContent), gameContent);
    host = entered;
    expect(host.combat).not.toBeNull();
    let turns = 0;
    while (host.combat && !isTerminal(host.combat) && turns++ < 500) {
      const next = stepExpeditionCombat(host, gameContent);
      guest = decodeExpeditionUpdate(guest, encodeExpeditionUpdate(host, next, gameContent), gameContent);
      expect(guest).toEqual(next);
      host = next;
    }
    expect(host.combat && isTerminal(host.combat)).toBe(true);
    const wounds = host.combat!.units.filter(unit => unit.team === 'heroes').map(unit => unit.body);
    const returned = leaveEncounter(host);
    guest = decodeExpeditionUpdate(guest, encodeExpeditionUpdate(host, returned, gameContent), gameContent);
    expect(guest).toEqual(returned);
    expect(guest.combat).toBeNull();
    expect(guest.world.actors.map(actor => actor.body)).toEqual(wounds);
  });
});

function fixture(host = true) {
  const room: RoomState = { code: 'ABCDEF', hostId: 'host', revision: 1, phase: 'lobby', members: [
    { id: 'host', heroId: 'guardian', name: 'Host', ready: true },
    { id: 'guest', heroId: 'priest', name: 'Guest', ready: true },
  ] };
  const requests: RoomRequest[] = [];
  let receiver: (event: RoomEvent) => void = () => {};
  const connection: RoomConnection = {
    request: vi.fn(async (request: RoomRequest): Promise<RoomResponse> => {
      requests.push(request);
      if (request.type === 'start') { room.phase = 'playing'; room.run = request.run; room.heroIds = [...request.run.characterIds]; room.revision++; }
      if (request.type === 'publish' || request.type === 'sync' || request.type === 'command') return { ok: true, memberId: host ? 'host' : 'guest' };
      return { ok: true, room: structuredClone(room), memberId: host ? 'host' : 'guest' };
    }),
    watch: vi.fn(onEvent => { receiver = onEvent; onEvent({ type: 'room', room: structuredClone(room) }); return () => {}; }),
    close: vi.fn(),
  };
  const session = new NetworkSession(gameContent, async () => connection);
  return { session, requests, connection, room, emit: (event: RoomEvent) => receiver(event) };
}

describe('network session lifecycle and flow control', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('preserves pending causal events and assigns consecutive sequences after acknowledgements', async () => {
    const f = fixture();
    await f.session.connect('ws://localhost');
    await f.session.create({ name: 'Host', heroId: 'guardian' });
    const state = initialCoop();
    await f.session.start(state);
    let resolvePublish!: (response: RoomResponse) => void;
    vi.mocked(f.connection.request).mockImplementationOnce(request => {
      f.requests.push(request);
      return new Promise(resolve => { resolvePublish = resolve; });
    });
    const actor = state.actors.find(member => member.id === 'guardian')!;
    const chunk = coopView(state, actor.id, gameContent).world.chunk;
    const commands: MultiplayerCommand[] = formationPoints(chunk, actor.position, 3)
      .map(target => ({ type: 'move', chunkId: actor.chunkId, x: target.x, y: target.y }));
    let expected = state;
    for (const command of commands) {
      expected = commandCoop(expected, actor.id, command, gameContent).state;
      f.session.sendCommand(command);
    }
    expect(f.requests.filter(request => request.type === 'publish')).toHaveLength(1);
    resolvePublish({ ok: true, memberId: 'host' });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.requests.filter(request => request.type === 'publish')).toHaveLength(3);
    const updates = f.requests.filter(request => request.type === 'publish');
    expect(updates.map(update => update.sequence)).toEqual([1, 2, 3]);
    let guest = initialCoop();
    for (const update of updates) guest = applyCoopFrame(guest, JSON.parse(update.frame) as CoopFrame, gameContent);
    expect(guest).toEqual(expected);
    expect(f.session.getCoopState()).toEqual(expected);
    f.session.leave();
  });

  it('replays the latest guest state and closes when a sequence is missing', async () => {
    const f = fixture(false);
    await f.session.connect('ws://localhost');
    await f.session.join({ code: 'abcdef', name: 'Guest', heroId: 'priest' });
    const state = initialCoop();
    const next = stepCoop(state, gameContent);
    f.room.phase = 'playing'; f.room.run = runOf(state); f.room.revision++;
    f.emit({ type: 'room', room: structuredClone(f.room) });
    f.emit({ type: 'bootstrap', sequence: 0, run: runOf(state) });
    const frame: CoopFrame = { tick: next.state.tick, diceIndex: next.state.diceIndex, events: next.events };
    f.emit({ type: 'frame', sequence: 1, frame: JSON.stringify(frame) });
    const listener = vi.fn();
    f.session.subscribeState(listener);
    expect(listener).toHaveBeenCalledExactlyOnceWith(coopView(next.state, 'priest', gameContent));
    f.emit({ type: 'frame', sequence: 3, frame: JSON.stringify(frame) });
    expect(f.session.getSnapshot().status).toBe('closed');
    expect(f.connection.close).toHaveBeenCalledOnce();
    expect(f.session.getSnapshot().initialState).toBeNull();
  });

  it('keeps a rejected start visible and supports retry', async () => {
    const f = fixture();
    await f.session.connect('ws://localhost');
    await f.session.create({ name: 'Host', heroId: 'guardian' });
    vi.mocked(f.connection.request).mockResolvedValueOnce({ ok: false, code: 'NOT_READY', message: 'not ready' });
    await expect(f.session.start(initialCoop())).rejects.toThrow('Дождитесь');
    expect(f.session.getSnapshot().status).toBe('connected');
    expect(f.session.getSnapshot().initialState).toBeNull();
    await f.session.start(initialCoop());
    expect(f.session.getSnapshot().initialState).not.toBeNull();
    f.session.leave();
  });

  it('disposes a late connection after leaving and can connect again', async () => {
    const f = fixture();
    let resolveConnect!: (connection: RoomConnection) => void;
    const connector = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveConnect = resolve; })).mockResolvedValue(f.connection);
    const session = new NetworkSession(gameContent, connector);
    const opening = session.connect('ws://localhost');
    const rejected = expect(opening).rejects.toThrow('отменено');
    session.leave();
    resolveConnect(f.connection);
    await rejected;
    expect(f.connection.close).toHaveBeenCalledOnce();
    expect(session.getSnapshot().status).toBe('idle');
    await session.connect('ws://localhost');
    expect(session.getSnapshot().status).toBe('connected');
    session.leave();
  });

  it('buffers guest commands until the host start is acknowledged', async () => {
    const f = fixture();
    await f.session.connect('ws://localhost');
    await f.session.create({ name: 'Host', heroId: 'guardian' });
    const state = initialCoop();
    const actor = state.actors.find(member => member.id === 'priest')!;
    const chunk = coopView(state, actor.id, gameContent).world.chunk;
    const target = formationPoints(chunk, actor.position, 2)[1];
    const command: MultiplayerCommand = { type: 'move', chunkId: actor.chunkId, x: target.x, y: target.y };
    const event: RoomEvent = { type: 'command', memberId: 'guest', heroId: actor.id, command };
    let resolveStart!: (response: RoomResponse) => void;
    vi.mocked(f.connection.request).mockImplementationOnce(request => {
      f.requests.push(request);
      return new Promise(resolve => { resolveStart = resolve; });
    });
    const opening = f.session.start(state);
    f.room.phase = 'playing'; f.room.run = runOf(state); f.room.revision++;
    f.emit({ type: 'room', room: structuredClone(f.room) });
    f.emit(event);
    expect(f.requests.filter(request => request.type === 'publish')).toHaveLength(0);
    resolveStart({ ok: true, room: structuredClone(f.room), memberId: 'host' });
    await opening;
    await vi.advanceTimersByTimeAsync(0);
    expect(f.requests.filter(request => request.type === 'publish')).toHaveLength(1);
    expect(f.session.getCoopState()).toEqual(commandCoop(state, actor.id, command, gameContent).state);
    f.session.leave();
  });

  it('preserves rest between movement commands while an earlier command awaits acknowledgement', async () => {
    const f = fixture(false);
    await f.session.connect('ws://localhost');
    await f.session.join({ code: 'ABCDEF', name: 'Guest', heroId: 'priest' });
    f.room.phase = 'playing'; f.room.revision++;
    f.emit({ type: 'room', room: structuredClone(f.room) });
    f.emit({ type: 'bootstrap', sequence: 0, run: runOf(initialCoop()) });
    let resolveCommand!: (response: RoomResponse) => void;
    vi.mocked(f.connection.request).mockImplementationOnce(request => {
      f.requests.push(request);
      return new Promise(resolve => { resolveCommand = resolve; });
    });
    f.session.sendCommand({ type: 'move', chunkId: '0,0', x: 10, y: 10 });
    f.session.sendCommand({ type: 'rest', chunkId: '0,0', poiId: '0,0:campfire' });
    f.session.sendCommand({ type: 'move', chunkId: '0,0', x: 12, y: 12 });
    f.session.sendCommand({ type: 'move', chunkId: '0,0', x: 13, y: 13 });
    resolveCommand({ ok: true, room: structuredClone(f.room), memberId: 'guest' });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.requests.filter(request => request.type === 'command')).toHaveLength(3);
    const commands = f.requests.filter(request => request.type === 'command').map(request => request.command);
    expect(commands.map(command => command.type)).toEqual(['move', 'rest', 'move']);
    expect(commands[2]).toMatchObject({ x: 13, y: 13 });
    f.session.leave();
  });
});
