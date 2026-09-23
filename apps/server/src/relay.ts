import { randomBytes, randomUUID } from 'node:crypto';
import {
  MAX_ROOM_MEMBERS, MAX_FRAME_BYTES, MAX_CHECKPOINT_BYTES, MULTIPLAYER_VERSION, roomRequestSchema,
  type RoomErrorCode, type RoomEvent, type RoomMember, type RoomRequest, type RoomResponse, type RoomRun, type RoomState,
} from '@shards/protocol';

interface Session {
  id: string;
  roomCode: string | null;
  events: EventQueue | null;
  synced: boolean;
  deadline: number;
  rateStartedAt: number;
  requests: number;
  publishedBytes: number;
}

interface Room {
  state: RoomState;
  contentVersion: string;
  sequence: number;
  sessions: Map<string, Session>;
}

export interface RelayOptions {
  heroIds: readonly string[];
  maxRooms?: number;
  maxQueuedEvents?: number;
  maxQueuedBytes?: number;
  subscriptionTimeoutMs?: number;
  now?: () => number;
}

/** A demand-driven stream with explicit memory limits, including slow subscribers. */
class EventQueue implements AsyncIterableIterator<RoomEvent> {
  private values: { event: RoomEvent; bytes: number }[] = [];
  private bytes = 0;
  private pending: ((value: IteratorResult<RoomEvent>) => void) | null = null;
  private ended = false;

  constructor(private readonly maxEvents: number, private readonly maxBytes: number, private readonly onCancel: () => void) {}

  push(event: RoomEvent, bytes: number): boolean {
    if (this.ended) return false;
    if (this.pending) {
      const resolve = this.pending;
      this.pending = null;
      resolve({ done: false, value: event });
      return true;
    }
    if (this.values.length >= this.maxEvents || this.bytes + bytes > this.maxBytes) return false;
    this.values.push({ event, bytes });
    this.bytes += bytes;
    return true;
  }

  finish(event?: Extract<RoomEvent, { type: 'closed' }>): void {
    if (this.ended) return;
    this.values = [];
    this.bytes = 0;
    if (event) this.push(event, 128);
    this.ended = true;
    if (this.pending) {
      this.pending({ done: true, value: undefined });
      this.pending = null;
    }
  }

  next(): Promise<IteratorResult<RoomEvent>> {
    const value = this.values.shift();
    if (value) {
      this.bytes -= value.bytes;
      return Promise.resolve({ done: false, value: value.event });
    }
    if (this.ended) return Promise.resolve({ done: true, value: undefined });
    return new Promise(resolve => { this.pending = resolve; });
  }

  return(): Promise<IteratorResult<RoomEvent>> {
    this.finish();
    this.onCancel();
    return Promise.resolve({ done: true, value: undefined });
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<RoomEvent> { return this; }
}

class RoomFailure extends Error {
  constructor(readonly code: RoomErrorCode, message: string) { super(message); }
}

/** Keeps room metadata in memory. Gameplay frames/checkpoints stay opaque and exist only in delivery queues. */
export class RoomRelay {
  private readonly sessions = new WeakMap<object, Session>();
  private readonly rooms = new Map<string, Room>();
  private readonly heroIds: Set<string>;
  private readonly now: () => number;
  private readonly maxRooms: number;
  private readonly maxQueuedEvents: number;
  private readonly maxQueuedBytes: number;
  private readonly subscriptionTimeoutMs: number;

  constructor(options: RelayOptions) {
    this.heroIds = new Set(options.heroIds);
    this.now = options.now ?? Date.now;
    this.maxRooms = options.maxRooms ?? 100;
    this.maxQueuedEvents = options.maxQueuedEvents ?? 64;
    this.maxQueuedBytes = options.maxQueuedBytes ?? 2 * MAX_CHECKPOINT_BYTES;
    this.subscriptionTimeoutMs = options.subscriptionTimeoutMs ?? 15_000;
  }

  request(connection: object, input: unknown): RoomResponse {
    const session = this.session(connection);
    try {
      this.checkRate(session);
      if (input && typeof input === 'object' && 'protocolVersion' in input && input.protocolVersion !== MULTIPLAYER_VERSION) {
        throw new RoomFailure('INCOMPATIBLE_VERSION', 'Версия сетевого протокола не совпадает. Обновите игру.');
      }
      const parsed = roomRequestSchema.safeParse(input);
      if (!parsed.success) throw new RoomFailure('INVALID_REQUEST', 'Некорректный сетевой запрос.');
      const request = parsed.data;
      if (request.type === 'inspect') {
        return { ok: true, memberId: session.id, room: this.snapshot(this.inspect(request.code, request.contentVersion)) };
      } else if (request.type === 'create' || request.type === 'join') {
        this.enter(session, request);
      } else if (request.type === 'leave') {
        this.leave(session, 'left');
      } else {
        const room = this.room(session);
        if (request.type === 'select') this.select(room, session, request.heroId);
        else if (request.type === 'ready') this.ready(room, session, request.ready);
        else if (request.type === 'start') this.start(room, session, request);
        else if (request.type === 'publish') this.publish(room, session, request);
        else if (request.type === 'sync') this.sync(room, session, request);
        else this.command(room, session, request);
      }
      if (request.type === 'publish' || request.type === 'sync' || request.type === 'command' || request.type === 'commands') {
        return { ok: true, memberId: session.id };
      }
      const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
      return { ok: true, memberId: session.id, room: room ? this.snapshot(room) : null };
    } catch (error) {
      if (error instanceof RoomFailure) return { ok: false, code: error.code, message: error.message };
      throw error;
    }
  }

  events(connection: object): AsyncIterableIterator<RoomEvent> {
    const session = this.session(connection);
    const room = this.room(session);
    if (session.events) throw new Error('Для соединения уже открыт поток комнаты.');
    const events = new EventQueue(this.maxQueuedEvents, this.maxQueuedBytes, () => {
      if (session.events === events) this.leave(session, 'left');
    });
    session.events = events;
    session.deadline = Infinity;
    this.send(session, { type: 'room', room: this.snapshot(room) }, 2048);
    this.requestSync(room, session);
    return events;
  }

  disconnect(connection: object): void {
    const session = this.sessions.get(connection);
    if (session) this.leave(session, 'left');
    this.sessions.delete(connection);
  }

  sweep(): void {
    const now = this.now();
    for (const room of [...this.rooms.values()]) {
      for (const session of [...room.sessions.values()]) {
        if (session.deadline <= now) this.leave(session, 'subscription_timeout');
      }
    }
  }

  close(): void {
    for (const room of [...this.rooms.values()]) this.closeRoom(room, 'server_shutdown');
  }

  private session(connection: object): Session {
    let session = this.sessions.get(connection);
    if (!session) {
      session = { id: randomUUID(), roomCode: null, events: null, synced: false, deadline: Infinity, rateStartedAt: this.now(), requests: 0, publishedBytes: 0 };
      this.sessions.set(connection, session);
    }
    return session;
  }

  private room(session: Session): Room {
    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    if (!room) throw new RoomFailure('NOT_IN_ROOM', 'Соединение не состоит в комнате.');
    return room;
  }

  private member(room: Room, session: Session): RoomMember {
    return room.state.members.find(member => member.id === session.id)!;
  }

  private snapshot(room: Room): RoomState {
    return { ...room.state, members: room.state.members.map(member => ({ ...member })),
      heroIds: [...room.state.heroIds!], ...(room.state.run ? { run: this.copyRun(room.state.run) } : {}) };
  }

  private copyRun(run: RoomRun): RoomRun {
    return { ...run, characterIds: [...run.characterIds] };
  }

  private inspect(code: string, contentVersion: string): Room {
    const room = this.rooms.get(code);
    if (!room) throw new RoomFailure('ROOM_NOT_FOUND', 'Комната не существует.');
    if (room.contentVersion !== contentVersion) throw new RoomFailure('INCOMPATIBLE_VERSION', 'Версии игры не совпадают. Обновите игру у всех участников.');
    return room;
  }

  private checkRate(session: Session): void {
    const now = this.now();
    if (now - session.rateStartedAt >= 1000) {
      session.rateStartedAt = now;
      session.requests = 0;
      session.publishedBytes = 0;
    }
    if (++session.requests > 120) throw new RoomFailure('RATE_LIMITED', 'Слишком много запросов.');
  }

  private checkHero(pool: readonly string[], heroId: string): void {
    if (!this.heroIds.has(heroId) || !pool.includes(heroId)) throw new RoomFailure('INVALID_HERO', 'Персонаж недоступен в этом походе.');
  }

  private checkRun(run: RoomRun): void {
    const heroIds = [...this.heroIds];
    for (const heroId of run.characterIds) this.checkHero(heroIds, heroId);
  }

  private enter(session: Session, request: Extract<RoomRequest, { type: 'create' | 'join' }>): void {
    if (session.roomCode) throw new RoomFailure('ALREADY_IN_ROOM', 'Сначала покиньте текущую комнату.');
    let room: Room;
    if (request.type === 'create') {
      if (this.rooms.size >= this.maxRooms) throw new RoomFailure('SERVER_FULL', 'На сервере достигнут лимит комнат.');
      if (request.run) this.checkRun(request.run);
      const heroIds = request.run ? [...request.run.characterIds] : [...this.heroIds];
      this.checkHero(heroIds, request.heroId);
      let code: string;
      do { code = [...randomBytes(6)].map(value => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[value % 32]).join(''); } while (this.rooms.has(code));
      room = {
        state: { code, hostId: session.id, phase: 'lobby', members: [], revision: 0, heroIds,
          ...(request.run ? { run: this.copyRun(request.run) } : {}) },
        contentVersion: request.contentVersion, sequence: 0, sessions: new Map(),
      };
      this.rooms.set(code, room);
    } else {
      room = this.inspect(request.code, request.contentVersion);
      if (room.sessions.size >= MAX_ROOM_MEMBERS) throw new RoomFailure('ROOM_FULL', 'В комнате уже четыре игрока.');
      this.checkHero(room.state.heroIds!, request.heroId);
    }
    session.roomCode = room.state.code;
    session.synced = false;
    session.deadline = this.now() + this.subscriptionTimeoutMs;
    room.sessions.set(session.id, session);
    room.state.members.push({ id: session.id, name: request.name, heroId: request.heroId, ready: false });
    this.changed(room);
  }

  private select(room: Room, session: Session, heroId: string): void {
    if (this.member(room, session).ready) throw new RoomFailure('PLAYER_READY', 'Нажмите «Не готов», чтобы сменить персонажа.');
    this.checkHero(room.state.heroIds!, heroId);
    if (this.member(room, session).heroId === heroId) return;
    this.member(room, session).heroId = heroId;
    this.changed(room);
  }

  private ready(room: Room, session: Session, ready: boolean): void {
    if (!session.events) throw new RoomFailure('NOT_READY', 'Поток событий не подключён.');
    const member = this.member(room, session);
    if (member.ready === ready) { if (ready) this.requestSync(room, session); return; }
    if (ready && room.state.members.some(other => other.id !== member.id && other.ready && other.heroId === member.heroId)) {
      throw new RoomFailure('HERO_TAKEN', 'Этот персонаж уже занят готовым игроком.');
    }
    member.ready = ready;
    session.synced = ready && room.state.phase === 'playing' && room.state.hostId === session.id;
    this.changed(room);
    if (ready) this.requestSync(room, session);
  }

  private start(room: Room, session: Session, request: Extract<RoomRequest, { type: 'start' }>): void {
    this.checkHost(room, session);
    if (room.state.phase !== 'lobby') throw new RoomFailure('ROOM_STARTED', 'Экспедиция уже началась.');
    if (request.roomRevision !== room.state.revision) throw new RoomFailure('NOT_READY', 'Состав или готовность комнаты изменились. Запустите экспедицию ещё раз.');
    if (room.state.members.some(member => !member.ready || !room.sessions.get(member.id)?.events)) {
      throw new RoomFailure('NOT_READY', 'Дождитесь готовности всех участников.');
    }
    this.checkRun(request.run);
    const previousRun = room.state.run;
    if (previousRun) {
      if (previousRun.seed !== request.run.seed || previousRun.difficultyId !== request.run.difficultyId
        || previousRun.generatorVersion !== request.run.generatorVersion
        || previousRun.characterIds.join('\0') !== request.run.characterIds.join('\0') || !request.checkpoint) {
        throw new RoomFailure('INVALID_REQUEST', 'Для продолжения нужны исходный состав похода и сохранение.');
      }
    } else if (request.run.characterIds.length !== room.state.members.length
      || room.state.members.some(member => !request.run.characterIds.includes(member.heroId))) {
      throw new RoomFailure('NOT_READY', 'Состав похода не совпадает с готовыми участниками.');
    }
    const bytes = request.checkpoint ? this.checkPayload(session, request.checkpoint, MAX_CHECKPOINT_BYTES) : 0;
    room.state.run = this.copyRun(request.run);
    room.state.heroIds = [...request.run.characterIds];
    room.state.phase = 'playing';
    this.changed(room);
    const event: RoomEvent = { type: 'bootstrap', run: this.copyRun(request.run), sequence: 0,
      ...(request.checkpoint ? { checkpoint: request.checkpoint } : {}) };
    for (const target of [...room.sessions.values()]) {
      if (!this.rooms.has(room.state.code)) break;
      if (room.sessions.get(target.id) === target && this.member(room, target).ready) {
        target.synced = this.send(target, event, bytes + 2048);
      }
    }
  }

  private checkHost(room: Room, session: Session): void {
    if (room.state.hostId !== session.id) throw new RoomFailure('HOST_ONLY', 'Только хост может обновлять состояние игры.');
    if (!session.events) throw new RoomFailure('NOT_READY', 'Поток событий не подключён.');
  }

  private checkPayload(session: Session, payload: string, limit: number): number {
    const bytes = Buffer.byteLength(payload, 'utf8');
    if (bytes > limit) throw new RoomFailure('INVALID_REQUEST', 'Сетевое сообщение превышает лимит.');
    if (session.publishedBytes + bytes > 4 * MAX_CHECKPOINT_BYTES) throw new RoomFailure('RATE_LIMITED', 'Превышен лимит данных за секунду.');
    session.publishedBytes += bytes;
    return bytes;
  }

  private publish(room: Room, session: Session, request: Extract<RoomRequest, { type: 'publish' }>): void {
    this.checkHost(room, session);
    if (room.state.phase !== 'playing' || !session.synced) throw new RoomFailure('NOT_READY', 'Экспедиция ещё не готова к синхронизации.');
    if (request.sequence !== room.sequence + 1) throw new RoomFailure('INVALID_SEQUENCE', 'Нарушен порядок обновлений состояния.');
    const bytes = this.checkPayload(session, request.frame, MAX_FRAME_BYTES);
    room.sequence = request.sequence;
    const event: RoomEvent = { type: 'frame', sequence: request.sequence, frame: request.frame };
    for (const target of [...room.sessions.values()]) {
      if (target !== session && target.synced && this.member(room, target).ready) this.send(target, event, bytes + 128);
    }
  }

  private requestSync(room: Room, session: Session): void {
    if (room.state.phase !== 'playing' || session.synced || !session.events || session.id === room.state.hostId
      || room.sessions.get(session.id) !== session || !this.member(room, session).ready) return;
    const host = room.sessions.get(room.state.hostId);
    if (host) this.send(host, { type: 'sync-request', memberId: session.id }, 256);
  }

  private sync(room: Room, session: Session, request: Extract<RoomRequest, { type: 'sync' }>): void {
    this.checkHost(room, session);
    if (room.state.phase !== 'playing' || !room.state.run || !session.synced) throw new RoomFailure('NOT_READY', 'Экспедиция ещё не готова к синхронизации.');
    if (request.sequence !== room.sequence) throw new RoomFailure('INVALID_SEQUENCE', 'Сохранение должно соответствовать последнему событию.');
    const target = room.sessions.get(request.memberId);
    if (!target) throw new RoomFailure('NOT_IN_ROOM', 'Игрок уже покинул комнату.');
    if (!target.events || !this.member(room, target).ready) throw new RoomFailure('NOT_READY', 'Игрок ещё не готов.');
    if (target.synced) return;
    const bytes = this.checkPayload(session, request.checkpoint, MAX_CHECKPOINT_BYTES);
    target.synced = this.send(target, { type: 'bootstrap', run: this.copyRun(room.state.run), sequence: request.sequence, checkpoint: request.checkpoint }, bytes + 2048);
  }

  private command(room: Room, session: Session, request: Extract<RoomRequest, { type: 'command' | 'commands' }>): void {
    if (room.state.phase !== 'playing') throw new RoomFailure('NOT_READY', 'Экспедиция ещё не началась.');
    if (!session.events || !session.synced || !this.member(room, session).ready) throw new RoomFailure('NOT_READY', 'Дождитесь готовности и синхронизации героя.');
    const host = room.sessions.get(room.state.hostId)!;
    const identity = { memberId: session.id, heroId: this.member(room, session).heroId };
    const event: RoomEvent = request.type === 'commands'
      ? { type: 'commands', ...identity, commands: request.commands }
      : { type: 'command', ...identity, command: request.command, ...(request.input ? { input: { ...request.input } } : {}) };
    this.send(host, event, Buffer.byteLength(JSON.stringify(event), 'utf8'));
  }

  private changed(room: Room): void {
    if (!this.rooms.has(room.state.code)) return;
    room.state.revision++;
    const event: RoomEvent = { type: 'room', room: this.snapshot(room) };
    for (const session of [...room.sessions.values()]) {
      if (room.state.revision !== event.room.revision) break;
      this.send(session, event, 2048);
    }
  }

  private send(session: Session, event: RoomEvent, bytes: number): boolean {
    if (!session.events) return false;
    if (session.events.push(event, bytes)) return true;
    this.leave(session, 'slow_consumer');
    return false;
  }

  private leave(session: Session, reason: Extract<RoomEvent, { type: 'closed' }>['reason']): void {
    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    if (room?.state.hostId === session.id) {
      this.closeRoom(room, reason === 'server_shutdown' ? reason : 'host_left');
      return;
    }
    session.roomCode = null;
    session.synced = false;
    session.deadline = Infinity;
    const events = session.events;
    session.events = null;
    events?.finish({ type: 'closed', reason });
    if (room) {
      room.sessions.delete(session.id);
      room.state.members = room.state.members.filter(member => member.id !== session.id);
      this.changed(room);
    }
  }

  private closeRoom(room: Room, reason: Extract<RoomEvent, { type: 'closed' }>['reason']): void {
    this.rooms.delete(room.state.code);
    for (const session of room.sessions.values()) {
      session.roomCode = null;
      session.synced = false;
      session.deadline = Infinity;
      const events = session.events;
      session.events = null;
      events?.finish({ type: 'closed', reason });
    }
    room.sessions.clear();
  }
}
