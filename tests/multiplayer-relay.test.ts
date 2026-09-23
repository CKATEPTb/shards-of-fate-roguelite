import { describe, expect, it } from 'vitest';
import { MULTIPLAYER_VERSION, type RoomEvent, type RoomResponse } from '@shards/protocol';
import { RoomRelay } from '../apps/server/src/relay';
import { startRelayServer } from '../apps/server/src/server';
import { RSocket } from 'rsocket-browser';
import { WellKnownMimeType } from 'rsocket-frames-ts';

const identity = (heroId: string) => ({ protocolVersion: MULTIPLAYER_VERSION, contentVersion: 'content-1', name: heroId, heroId });
const successful = (response: RoomResponse) => {
  expect(response.ok).toBe(true);
  if (!response.ok || !response.room) throw new Error('Expected a joined room.');
  return { memberId: response.memberId, room: response.room };
};
const createRelay = (options: Partial<ConstructorParameters<typeof RoomRelay>[0]> = {}) =>
  new RoomRelay({ heroIds: ['guardian', 'priest', 'mage', 'ranger', 'vampire'], ...options });

async function pair(relay = createRelay()) {
  const host = {}, guest = {};
  const created = successful(relay.request(host, { type: 'create', ...identity('guardian') }));
  const hostEvents = relay.events(host);
  await hostEvents.next();
  const joined = successful(relay.request(guest, { type: 'join', code: created.room.code, ...identity('priest') }));
  await hostEvents.next();
  const guestEvents = relay.events(guest);
  const ready = (await hostEvents.next()).value as Extract<RoomEvent, { type: 'room' }>;
  await guestEvents.next();
  const publication = { type: 'publish', sequence: 1, kind: 'snapshot', state: '{}', roomRevision: ready.room.revision };
  return { relay, host, guest, created, joined, hostEvents, guestEvents, publication };
}

describe('host-authoritative room relay', () => {
  it('binds authority and command identity to the connection and forwards snapshots only to guests', async () => {
    const { relay, host, guest, hostEvents, guestEvents, joined, publication } = await pair();
    publication.state = '{"world":1}';
    expect(relay.request(guest, publication)).toMatchObject({ ok: false, code: 'HOST_ONLY' });
    expect(relay.request(guest, { type: 'command', command: { type: 'move', chunkId: '0', x: 3, y: 4 }, senderId: 'forged' }))
      .toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    expect(relay.request(host, publication)).toMatchObject({ ok: true, room: { phase: 'playing' } });
    expect((await hostEvents.next()).value).toMatchObject({ type: 'room', room: { phase: 'playing' } });
    expect((await guestEvents.next()).value).toMatchObject({ type: 'room', room: { phase: 'playing' } });
    expect((await guestEvents.next()).value).toEqual({ type: 'state', sequence: 1, kind: 'snapshot', state: '{"world":1}' });
    const command = { type: 'move', chunkId: '0', x: 3, y: 4 };
    expect(relay.request(guest, { type: 'command', command })).toMatchObject({ ok: true });
    expect((await hostEvents.next()).value).toEqual({ type: 'command', memberId: joined.memberId, heroId: 'priest', command });
    relay.close();
  });

  it('rejects missing, duplicate, and out-of-order state updates and late joins', async () => {
    const { relay, host, created, publication } = await pair();
    expect(relay.request(host, { type: 'publish', sequence: 1, kind: 'patch', state: '{}' })).toMatchObject({ ok: false, code: 'INVALID_SEQUENCE' });
    expect(relay.request(host, publication).ok).toBe(true);
    for (const sequence of [1, 3]) {
      expect(relay.request(host, { type: 'publish', sequence, kind: 'patch', state: '{}' })).toMatchObject({ ok: false, code: 'INVALID_SEQUENCE' });
    }
    expect(relay.request(host, { type: 'publish', sequence: 2, kind: 'patch', state: '{}' }).ok).toBe(true);
    expect(relay.request({}, { type: 'join', code: created.room.code, ...identity('mage') })).toMatchObject({ ok: false, code: 'ROOM_STARTED' });
    expect(relay.request(host, { type: 'select', heroId: 'mage' })).toMatchObject({ ok: false, code: 'ROOM_STARTED' });
    relay.close();
  });

  it('requires matching protocol/content, valid distinct heroes, and at most four players', () => {
    const relay = createRelay();
    const host = {};
    const { room } = successful(relay.request(host, { type: 'create', ...identity('guardian') }));
    const join = { type: 'join', code: room.code, ...identity('priest') };
    expect(relay.request({}, { ...join, protocolVersion: 999 })).toMatchObject({ ok: false, code: 'INCOMPATIBLE_VERSION' });
    expect(relay.request({}, { ...join, contentVersion: 'different' })).toMatchObject({ ok: false, code: 'INCOMPATIBLE_VERSION' });
    expect(relay.request({}, { ...join, heroId: 'invalid' })).toMatchObject({ ok: false, code: 'INVALID_HERO' });
    expect(relay.request({}, { ...join, heroId: 'guardian' })).toMatchObject({ ok: false, code: 'HERO_TAKEN' });
    const guest = {};
    successful(relay.request(guest, join));
    expect(relay.request(guest, { type: 'select', heroId: 'guardian' })).toMatchObject({ ok: false, code: 'HERO_TAKEN' });
    successful(relay.request({}, { ...join, heroId: 'mage' }));
    successful(relay.request({}, { ...join, heroId: 'ranger' }));
    expect(relay.request({}, { ...join, heroId: 'vampire' })).toMatchObject({ ok: false, code: 'ROOM_FULL' });
    relay.close();
  });

  it('requires subscriptions before starting and expires members that never subscribe', async () => {
    let now = 0;
    const relay = createRelay({ now: () => now, subscriptionTimeoutMs: 100 });
    const host = {}, guest = {};
    const { room } = successful(relay.request(host, { type: 'create', ...identity('guardian') }));
    const events = relay.events(host);
    await events.next();
    successful(relay.request(guest, { type: 'join', code: room.code, ...identity('priest') }));
    await events.next();
    expect(relay.request(host, { type: 'publish', sequence: 1, kind: 'snapshot', state: '{}' })).toMatchObject({ ok: false, code: 'NOT_READY' });
    now = 101;
    relay.sweep();
    const changed = (await events.next()).value as Extract<RoomEvent, { type: 'room' }>;
    expect(changed.room.members).toHaveLength(1);
    expect(relay.request(guest, { type: 'select', heroId: 'mage' })).toMatchObject({ ok: false, code: 'NOT_IN_ROOM' });
    expect(relay.request(host, { type: 'publish', sequence: 1, kind: 'snapshot', state: '{}', roomRevision: changed.room.revision }).ok).toBe(true);
    relay.close();
  });

  it('closes the room when its host disconnects and releases its room capacity', async () => {
    const { relay, host, guest, guestEvents, created } = await pair(createRelay({ maxRooms: 1 }));
    expect(relay.request({}, { type: 'create', ...identity('mage') })).toMatchObject({ ok: false, code: 'SERVER_FULL' });
    relay.disconnect(host);
    expect((await guestEvents.next()).value).toEqual({ type: 'closed', reason: 'host_left' });
    expect((await guestEvents.next()).done).toBe(true);
    expect(relay.request(guest, { type: 'join', code: created.room.code, ...identity('priest') })).toMatchObject({ ok: false, code: 'ROOM_NOT_FOUND' });
    expect(relay.request(guest, { type: 'create', ...identity('priest') }).ok).toBe(true);
    relay.close();
  });

  it('removes a disconnected guest while keeping its host in the room', async () => {
    const { relay, guest, host, hostEvents, created } = await pair();
    relay.disconnect(guest);
    const event = (await hostEvents.next()).value as Extract<RoomEvent, { type: 'room' }>;
    expect(event.room.code).toBe(created.room.code);
    expect(event.room.members).toHaveLength(1);
    expect(relay.request(host, { type: 'select', heroId: 'priest' }).ok).toBe(true);
    relay.close();
  });

  it('does not let cancellation of an old stream evict a newer room membership', async () => {
    const { relay, guest, guestEvents } = await pair();
    relay.request(guest, { type: 'leave' });
    successful(relay.request(guest, { type: 'create', ...identity('priest') }));
    const newEvents = relay.events(guest);
    await newEvents.next();
    await guestEvents.return?.();
    expect(relay.request(guest, { type: 'select', heroId: 'mage' }).ok).toBe(true);
    await newEvents.return?.();
    expect(relay.request(guest, { type: 'select', heroId: 'mage' })).toMatchObject({ ok: false, code: 'NOT_IN_ROOM' });
    relay.close();
  });

  it('disconnects slow consumers instead of retaining unlimited state updates', async () => {
    const { relay, host, guest, guestEvents, publication } = await pair(createRelay({ maxQueuedEvents: 2 }));
    expect(relay.request(host, publication).ok).toBe(true);
    expect(relay.request(host, { type: 'publish', sequence: 2, kind: 'patch', state: '{}' }).ok).toBe(true);
    expect((await guestEvents.next()).value).toEqual({ type: 'closed', reason: 'slow_consumer' });
    expect(relay.request(guest, { type: 'command', command: { type: 'rest', chunkId: '0', poiId: 'camp' } })).toMatchObject({ ok: false, code: 'NOT_IN_ROOM' });
    relay.close();
  });

  it('refuses to start a snapshot built from an obsolete lobby roster', async () => {
    const { relay, host, guest, publication } = await pair();
    const selected = successful(relay.request(guest, { type: 'select', heroId: 'mage' }));
    expect(relay.request(host, publication)).toMatchObject({ ok: false, code: 'NOT_READY' });
    expect(relay.request(host, { ...publication, roomRevision: selected.room.revision })).toMatchObject({ ok: true, room: { phase: 'playing' } });
    relay.close();
  });
});

describe('RSocket WebSocket transport', () => {
  it('delivers fragmented state, bound commands and host disconnection over real sockets', async () => {
    const server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const options = {
      reconnect: false,
      setup: {
        keepAlive: 10_000, lifetime: 30_000, fragmentSize: 64 * 1024,
        mimetype: { data: WellKnownMimeType.APPLICATION_JSON, metadata: WellKnownMimeType.MESSAGE_RSOCKET_COMPOSITE_METADATA },
      },
    };
    const host = new RSocket(`ws://127.0.0.1:${server.port}/rsocket`, options);
    const guest = new RSocket(`ws://127.0.0.1:${server.port}/rsocket`, options);
    const route = (name: string) => WellKnownMimeType.MESSAGE_RSOCKET_ROUTING.toMetadata([name]);
    const request = async (socket: typeof host, data: unknown) => (await socket.requestResponse(data, route('room.request')).block())!.data as RoomResponse;
    const connectedHost = await host.connect().block();
    const connectedGuest = await guest.connect().block();
    try {
      const created = successful(await request(host, { type: 'create', ...identity('guardian') }));
      const hostEvents = host.requestStream({}, route('room.events'))[Symbol.asyncIterator]();
      await hostEvents.next();
      const joined = successful(await request(guest, { type: 'join', code: created.room.code, ...identity('priest') }));
      await hostEvents.next();
      const guestEvents = guest.requestStream({}, route('room.events'))[Symbol.asyncIterator]();
      const ready = (await guestEvents.next()).value!.data as Extract<RoomEvent, { type: 'room' }>;
      await hostEvents.next();
      const state = JSON.stringify({ snapshot: 'Фрагмент'.repeat(32_768) });
      expect(await request(host, { type: 'publish', sequence: 1, kind: 'snapshot', state, roomRevision: ready.room.revision })).toMatchObject({ ok: true });
      expect((await hostEvents.next()).value!.data).toMatchObject({ type: 'room', room: { phase: 'playing' } });
      await guestEvents.next();
      expect((await guestEvents.next()).value!.data).toEqual({ type: 'state', sequence: 1, kind: 'snapshot', state });
      const command = { type: 'move', chunkId: 'origin', x: 8, y: 9 };
      expect(await request(guest, { type: 'command', command })).toMatchObject({ ok: true });
      expect((await hostEvents.next()).value!.data).toEqual({ type: 'command', memberId: joined.memberId, heroId: 'priest', command });
      connectedHost!.disconnect();
      expect((await guestEvents.next()).value!.data).toEqual({ type: 'closed', reason: 'host_left' });
      expect((await guestEvents.next()).done).toBe(true);
    } finally {
      connectedHost?.disconnect();
      connectedGuest?.disconnect();
      await server.close();
    }
  });
});
