import { contentWithLoadouts, applyCoopInput, applyCoopFrame, coopView, createCoopState, deserializeCoop, hashValue, MOVEMENT_TICK_MS, serializeCoop, stepCoop } from '@shards/game-core';
import { MAX_FRAME_BYTES, MULTIPLAYER_VERSION, multiplayerCommandSchema, type MultiplayerCommand, type MultiplayerInput, type RoomErrorCode, type RoomEvent, type RoomRequest, type RoomRun, type RoomState } from '@shards/protocol';
import type { CoopFrame, CoopInputAcknowledgement, CoopState, ExpeditionState, GameContent } from '@shards/shared';
import { createSessionId, saveNetworkSession, type SavedSession, type SessionIdentity } from '../session/storage';
import { connectRSocket, type RoomConnection, type RoomConnector } from './transport';
import { CoopPrediction, type PredictedInput } from './prediction';
import { resolveControllableHeroIds } from './combat-ownership';

export interface NetworkSessionView {
  status: 'idle' | 'connecting' | 'connected' | 'closed';
  error: string | null;
  room: RoomState | null;
  memberId: string | null;
  initialState: ExpeditionState | null;
}
const initialView = (): NetworkSessionView => ({ status: 'idle', error: null, room: null, memberId: null, initialState: null });
const roomErrors: Record<RoomErrorCode, string> = {
  INVALID_REQUEST: 'Сервер отклонил запрос.', INCOMPATIBLE_VERSION: 'У игроков разные версии игры. Обновите страницу.',
  ROOM_NOT_FOUND: 'Комната не существует.', ROOM_FULL: 'В комнате уже четыре игрока.', ROOM_STARTED: 'Поход уже начался.',
  HERO_TAKEN: 'Другой игрок уже нажал «Готов» с этим героем.', INVALID_HERO: 'Этот герой недоступен в походе.', NOT_IN_ROOM: 'Подключение к комнате потеряно.',
  ALREADY_IN_ROOM: 'Вы уже находитесь в комнате.', HOST_ONLY: 'Это действие доступно только хосту.', NOT_READY: 'Дождитесь готовности всех игроков.',
  PLAYER_READY: 'Сначала нажмите «Не готов», чтобы сменить персонажа.',
  INVALID_SEQUENCE: 'Нарушен порядок синхронизации. Подключитесь к комнате заново.', RATE_LIMITED: 'Слишком много сетевых действий. Повторите через секунду.',
  SERVER_FULL: 'Сервер занят. Попробуйте позже.',
};
class RoomRequestError extends Error {
  constructor(readonly code: RoomErrorCode) { super(roomErrors[code]); }
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'Сетевая ошибка.'; }
type Publication = { frame: CoopFrame; state: CoopState } | { memberId: string };
const PUBLICATION_BATCH_MS = 80;
const COMMAND_BATCH_MS = 40;
const CLOCK_HEARTBEAT_TICKS = Math.ceil(2_000 / MOVEMENT_TICK_MS);
const MAX_CLOCK_CATCHUP_TICKS = 5;

/** The host owns simulation and storage; peers rebuild geometry and paths from seed and decisions. */
export class NetworkSession {
  private view = initialView();
  private readonly listeners = new Set<() => void>();
  private readonly stateListeners = new Set<(state: ExpeditionState) => void>();
  private connection: RoomConnection | null = null;
  private connectAbort: AbortController | null = null;
  private stopWatching: (() => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private publicationTimer: ReturnType<typeof setTimeout> | null = null;
  private commandTimer: ReturnType<typeof setTimeout> | null = null;
  private outgoingCommands: PredictedInput[] = [];
  private generation = 0;
  private state: CoopState | null = null;
  private display: CoopState | null = null;
  private sentState: CoopState | null = null;
  private publications: Publication[] = [];
  private earlyCommands: { heroId: string; command: MultiplayerCommand; memberId?: string; input?: MultiplayerInput }[] = [];
  private prediction: CoopPrediction | null = null;
  private nextInputId = 0;
  private publishing = false;
  private starting = false;
  private sentSequence = 0;
  private receivedSequence = 0;
  private predictionClock = 0;
  private predictionClockTick = 0;
  private simulationClock = 0;
  private lastFrameTick = 0;
  private lastSaved = 0;
  private saveIdentity: SessionIdentity | null = null;
  private resume: SavedSession | null = null;
  private observedBattleId: string | null = null;
  private presentationEpoch = 0;
  private readonly contentVersion: string;

  constructor(private readonly content: GameContent, private readonly connector: RoomConnector = connectRSocket) {
    this.contentVersion = hashValue(content);
  }
  getSnapshot = (): NetworkSessionView => this.view;
  getCoopState = (): CoopState | null => this.display ?? this.state;
  /** Local presentation marker only: checkpoint replacements must not replay world sounds. */
  getPresentationEpoch = (): number => this.presentationEpoch;
  /** Authoritative state only; arrival-triggered actions must not outrun the host. */
  getConfirmedCoopState = (): CoopState | null => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  subscribeState = (listener: (state: ExpeditionState) => void): (() => void) => {
    this.stateListeners.add(listener);
    const state = this.projection();
    if (state) listener(state);
    return () => { this.stateListeners.delete(listener); };
  };
  get isHost(): boolean { return !!this.view.memberId && this.view.room?.hostId === this.view.memberId; }
  get controlledHeroId(): string | undefined { return this.view.room?.members.find(member => member.id === this.view.memberId)?.heroId; }
  get controllableHeroIds(): string[] { return resolveControllableHeroIds(this.view.room, this.view.memberId, this.getCoopState()?.characterIds ?? []); }
  prepareResume(saved: SavedSession): void { this.resume = saved; this.saveIdentity = saved; }

  async connect(url: string): Promise<void> {
    this.dispose();
    const generation = this.generation;
    this.connectAbort = new AbortController();
    this.update({ ...initialView(), status: 'connecting' });
    try {
      const connection = await this.connector(url, () => {
        if (generation === this.generation) this.fail('Связь с сервером потеряна. Подключитесь снова по приглашению. Хост может продолжить сохранённый поход из меню.');
      }, this.connectAbort.signal);
      if (generation !== this.generation) { connection.close(); throw new Error('Подключение отменено.'); }
      this.connection = connection;
      this.update({ status: 'connected' });
    } catch (error) {
      if (generation === this.generation) this.fail('Не удалось подключиться к сетевой игре. Повторите попытку.');
      throw error;
    }
  }
  async inspect(code: string): Promise<RoomState> {
    const response = await this.request({ type: 'inspect', code: code.trim().toUpperCase(), protocolVersion: MULTIPLAYER_VERSION, contentVersion: this.contentVersion });
    if (!response.room) throw new RoomRequestError('ROOM_NOT_FOUND');
    return response.room;
  }
  async create(identity: { name: string; heroId: string }, run?: RoomRun): Promise<void> {
    await this.enter({ type: 'create', protocolVersion: MULTIPLAYER_VERSION, contentVersion: this.contentVersion, ...identity, ...(run ? { run } : {}) });
  }
  async join(identity: { code: string; name: string; heroId: string }): Promise<void> {
    await this.enter({ type: 'join', protocolVersion: MULTIPLAYER_VERSION, contentVersion: this.contentVersion, ...identity, code: identity.code.trim().toUpperCase() });
  }
  async select(heroId: string): Promise<void> { await this.request({ type: 'select', heroId }); }
  async setReady(ready: boolean): Promise<void> { await this.request({ type: 'ready', ready }); }
  async start(state: CoopState): Promise<void> {
    if (!this.isHost || this.view.room?.phase !== 'lobby' || this.starting) throw new Error('Поход может начать только хост в комнате.');
    this.starting = true;
    const generation = this.generation;
    try {
      const room = this.view.room;
      if (!room.members.length || room.members.some(member => !member.ready)) throw new RoomRequestError('NOT_READY');
      const run: RoomRun = { seed: state.seed, characterIds: [...state.characterIds], difficultyId: state.difficultyId, generatorVersion: 1 };
      await this.request({ type: 'start', roomRevision: room.revision, run, ...(this.resume ? { checkpoint: serializeCoop(state) } : {}) });
      if (generation !== this.generation) return;
      this.state = this.display = this.sentState = state;
      this.saveIdentity ??= { id: createSessionId(), startedAt: Date.now() };
      this.sentSequence = this.receivedSequence = 0;
      this.lastFrameTick = state.tick;
      this.save(true);
      this.beginSimulation();
      this.present(true);
      for (const item of this.earlyCommands.splice(0)) this.applyCommand(item.heroId, item.command, item.memberId, item.input);
      void this.flushPublications();
    } finally { if (generation === this.generation) this.starting = false; }
  }
  sendCommand(command: MultiplayerCommand): boolean {
    if (this.view.status !== 'connected' || this.view.room?.phase !== 'playing') return false;
    const parsed = multiplayerCommandSchema.safeParse(command);
    if (!parsed.success) return false;
    if (this.isHost) {
      const data = parsed.data;
      const combat = data.type === 'battle' ? this.state?.battles.find(battle => battle.id === data.battleId)?.combat : undefined;
      const chosen = data.type === 'battle' ? data.action === 'choose'
        ? combat?.units.find(unit => unit.id === data.choice.actorId)?.definitionId
        : combat?.units.find(unit => unit.team === 'heroes' && !unit.escaped && this.controllableHeroIds.includes(unit.definitionId))?.definitionId
        : this.controlledHeroId;
      return Boolean(chosen && this.controllableHeroIds.includes(chosen) && this.applyCommand(chosen, data));
    }
    if (!this.prediction || !this.state) return false;
    if (this.prediction.pendingCount >= 64) { this.update({ error: 'Связь задерживается. Дождитесь синхронизации последних действий.' }); return false; }
    const input: PredictedInput = { id: ++this.nextInputId, tick: this.prediction.state.tick,
      diceIndex: this.prediction.state.diceCounters?.[`hero:${this.controlledHeroId}`] ?? 0, command: parsed.data };
    const result = this.prediction.issue(input);
    this.display = result.state;
    if (result.accepted === false) { this.update({ error: result.reason ?? 'Это действие сейчас недоступно.' }); return false; }
    this.present();
    // Several pointer updates in one render frame describe one final route.
    // Keep causal actions and chunk crossings in their original order.
    const previous = this.outgoingCommands.at(-1);
    if (previous?.command.type === 'move' && input.command.type === 'move'
      && previous.command.chunkId === input.command.chunkId && previous.diceIndex === input.diceIndex) {
      this.outgoingCommands.pop(); this.prediction.forget(previous.id);
    }
    this.outgoingCommands.push(input);
    if (!this.commandTimer) this.commandTimer = setTimeout(() => { this.commandTimer = null; void this.flushCommands(); }, COMMAND_BATCH_MS);
    return true;
  }
  leave(): void { this.dispose(); this.update(initialView()); }
  private async flushCommands(): Promise<void> {
    if (!this.outgoingCommands.length) return;
    const inputs = this.outgoingCommands.splice(0, 32), generation = this.generation;
    if (this.outgoingCommands.length && !this.commandTimer) this.commandTimer = setTimeout(() => { this.commandTimer = null; void this.flushCommands(); }, COMMAND_BATCH_MS);
    try {
      // Relay acknowledgement is delivery only. Simulation frames retire inputs.
      await this.request({ type: 'commands', commands: inputs.map(input => ({ command: input.command,
        input: { id: input.id, tick: input.tick, diceIndex: input.diceIndex } })) });
    } catch (error) {
      if (generation !== this.generation) return;
      if (error instanceof RoomRequestError && this.state && this.prediction) {
        this.display = this.prediction.reconcile(this.state, inputs.map(input => ({ inputId: input.id, accepted: false })));
        this.present();
      }
      this.update({ error: errorMessage(error) });
    }
  }
  private applyCommand(heroId: string, command: MultiplayerCommand, memberId?: string, input?: MultiplayerInput): boolean {
    if (!this.state) {
      if (this.starting && this.earlyCommands.length < 64) this.earlyCommands.push({ heroId, command, memberId, input });
      return false;
    }
    const staleAction = (command.type === 'move' || command.type === 'battle') && input?.diceIndex !== undefined
      && input.diceIndex < (this.state.diceCounters?.[`hero:${heroId}`] ?? 0);
    const result = staleAction ? { state: this.state, events: [], accepted: false, reason: 'Это действие относится к предыдущему состоянию боя.' }
      : applyCoopInput(this.state, heroId, command, this.content, input?.tick);
    this.state = this.display = result.state;
    if (result.accepted === false && !memberId) this.update({ error: result.reason ?? 'Это действие сейчас недоступно.' });
    if (result.accepted && command.type === 'battle') this.save(true);
    const acknowledgements: CoopInputAcknowledgement[] = input && memberId
      ? [{ memberId, inputId: input.id, accepted: result.accepted !== false, ...(result.reason ? { reason: result.reason } : {}) }] : [];
    if (result.events.length || acknowledgements.length) this.enqueueFrame(result.events, acknowledgements);
    this.present();
    return result.accepted !== false;
  }
  private beginSimulation(): void {
    if (this.timer) return;
    this.predictionClock = this.simulationClock = performance.now();
    this.predictionClockTick = this.state?.tick ?? 0;
    this.timer = setInterval(() => {
      if (!this.state || this.view.status !== 'connected') return;
      try {
        if (this.isHost) {
          // Backpressure pauses the clock; causal events are never dropped.
          if (this.publications.length > 250) { this.simulationClock = performance.now(); return; }
          const now = performance.now(), elapsed = Math.max(0, now - this.simulationClock);
          const ticks = Math.min(MAX_CLOCK_CATCHUP_TICKS, Math.floor(elapsed / MOVEMENT_TICK_MS));
          this.simulationClock = now - elapsed % MOVEMENT_TICK_MS;
          for (let index = 0; index < ticks; index++) {
            const result = stepCoop(this.state, this.content);
            this.state = this.display = result.state;
            if (result.events.length || this.state.tick - this.lastFrameTick >= CLOCK_HEARTBEAT_TICKS) this.enqueueFrame(result.events);
          }
          this.save();
        } else {
          const now = performance.now();
          if (this.prediction) {
            // Absolute room time: receiving a newer frame must not add the
            // same elapsed interval to its already advanced tick a second time.
            const target = this.predictionClockTick + Math.floor((now - this.predictionClock) / MOVEMENT_TICK_MS);
            this.display = this.prediction.advanceTo(Math.min(target, this.prediction.state.tick + MAX_CLOCK_CATCHUP_TICKS));
          }
        }
        this.present();
      } catch (error) { this.fail(errorMessage(error)); }
    }, MOVEMENT_TICK_MS);
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.saveBeforeUnload);
      document.addEventListener('visibilitychange', this.saveBeforeUnload);
    }
  }
  private enqueueFrame(events: CoopFrame['events'], acknowledgements: CoopInputAcknowledgement[] = []): void {
    if (!this.state) return;
    this.lastFrameTick = this.state.tick;
    const previous = this.publications.at(-1);
    if (previous && 'frame' in previous && previous.frame.tick === this.state.tick) {
      previous.frame = { tick: this.state.tick, diceIndex: this.state.diceIndex, events: [...previous.frame.events, ...events],
        ...((previous.frame.acknowledgements?.length || acknowledgements.length) ? { acknowledgements: [...(previous.frame.acknowledgements ?? []), ...acknowledgements] } : {}) };
      previous.state = this.state;
    } else this.publications.push({ frame: { tick: this.state.tick, diceIndex: this.state.diceIndex, events,
      ...(acknowledgements.length ? { acknowledgements } : {}) }, state: this.state });
    if (!this.publicationTimer) this.publicationTimer = setTimeout(() => { this.publicationTimer = null; void this.flushPublications(); }, PUBLICATION_BATCH_MS);
  }
  private projection(): ExpeditionState | null {
    const state = this.display ?? this.state;
    if (!state || !this.controlledHeroId) return null;
    const own = coopView(state, this.controlledHeroId, this.content);
    if (own.combat) return own;
    // Keep the escape roll visible while simulation has already released the hero.
    const fleeing = state.battles.find(battle => (battle.presentationUntilTick ?? 0) > state.tick
      && battle.combat.units.some(unit => unit.definitionId === this.controlledHeroId && unit.escaped));
    const controlled = new Set(this.controllableHeroIds);
    const observed = this.isHost ? state.battles.find(battle => battle.id === this.observedBattleId
      // The hero is released before the final escape dice finish. Observation
      // lasts through that presentation; action ownership is still checked live.
      && ((battle.presentationUntilTick ?? 0) > state.tick
        || battle.combat.units.some(unit => unit.team === 'heroes' && !unit.escaped && controlled.has(unit.definitionId)))) : undefined;
    const unattended = observed ?? (this.isHost ? state.battles.find(battle => battle.combat.units.some(unit => unit.team === 'heroes'
      && controlled.has(unit.definitionId) && !unit.escaped)
      && (battle.combat.pendingActorId && battle.combat.units.some(unit => unit.id === battle.combat.pendingActorId && controlled.has(unit.definitionId))
        || ['victory', 'defeat', 'draw'].includes(battle.combat.status))) : undefined);
    this.observedBattleId = unattended?.id ?? null;
    const battle = fleeing ?? unattended;
    return battle ? { ...own, content: contentWithLoadouts(this.content, battle.loadouts), combat: battle.combat, activePoiId: battle.initiatorMobId } : own;
  }
  private present(initial = false): void {
    if (initial) this.presentationEpoch++;
    const projected = this.projection();
    if (!projected) return;
    if (initial || !this.view.initialState) this.update({ initialState: projected });
    for (const listener of this.stateListeners) listener(projected);
  }
  private saveBeforeUnload = (): void => { this.save(true); };
  private save(force = false): void {
    if (!this.isHost || !this.state || !this.saveIdentity || typeof localStorage === 'undefined') return;
    if (!force && Date.now() - this.lastSaved < 1000) return;
    try {
      saveNetworkSession(localStorage, this.saveIdentity, this.state, this.content, this.controlledHeroId ?? this.state.characterIds[0]);
      this.lastSaved = Date.now();
    } catch { this.update({ error: 'Не удалось сохранить поход: хранилище браузера недоступно.' }); }
  }
  private async enter(request: RoomRequest): Promise<void> {
    const generation = this.generation;
    await this.request(request);
    if (generation !== this.generation || !this.connection) return;
    this.stopWatching?.();
    this.stopWatching = this.connection.watch(event => {
      if (generation !== this.generation) return;
      try { this.receive(event); } catch (error) { this.fail(errorMessage(error)); }
    }, () => { if (generation === this.generation) this.fail('Связь с комнатой потеряна. Подключитесь снова по приглашению.'); });
  }
  private async request(request: RoomRequest) {
    if (!this.connection || this.view.status !== 'connected') throw new Error('Нет подключения к серверу.');
    const generation = this.generation;
    const response = await this.connection.request(request);
    if (generation !== this.generation) throw new Error('Подключение отменено.');
    if (!response.ok) throw new RoomRequestError(response.code);
    if (request.type !== 'inspect' && response.room !== undefined) this.applyRoom(response.room, response.memberId);
    return response;
  }
  private applyRoom(room: RoomState | null, memberId = this.view.memberId): void {
    if (room && this.view.room?.code === room.code && this.view.room.revision > room.revision) return;
    const previous = this.view.room;
    const previousSelf = previous?.members.find(member => member.id === this.view.memberId);
    const self = room?.members.find(member => member.id === memberId);
    const invalidateGuest = room?.hostId !== memberId && (previousSelf?.heroId !== self?.heroId || !self?.ready);
    if (invalidateGuest && this.state) {
      this.state = this.display = null;
      this.prediction = null;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      if (this.commandTimer) clearTimeout(this.commandTimer);
      this.commandTimer = null; this.outgoingCommands = [];
    }
    this.update({ room, memberId, ...(invalidateGuest ? { initialState: null } : {}) });
    if (this.isHost && this.state && previous?.phase === 'playing') {
      for (const member of previous.members) {
        if (!member.ready || room?.members.some(current => current.ready && current.heroId === member.heroId)) continue;
        const actor = this.state.actors.find(actor => actor.id === member.heroId);
        if (actor?.path.length) this.applyCommand(actor.id, { type: 'move', chunkId: actor.chunkId, x: actor.position.x, y: actor.position.y });
      }
    }
  }
  private receive(event: RoomEvent): void {
    if (event.type === 'room') { this.applyRoom(event.room); return; }
    if (event.type === 'closed') {
      this.fail(event.reason === 'host_left' ? 'Хост вышел из игры. Комната закрыта.' : 'Комната закрыта.');
      return;
    }
    if (event.type === 'command' || event.type === 'commands') {
      if (this.isHost && this.view.room?.members.some(member => member.id === event.memberId && member.heroId === event.heroId && member.ready)) {
        const commands = event.type === 'commands' ? event.commands : [event];
        for (const item of commands) this.applyCommand(event.heroId, item.command, event.memberId, item.input);
      }
      return;
    }
    if (event.type === 'sync-request') {
      if (this.isHost) { this.publications.push({ memberId: event.memberId }); void this.flushPublications(); }
      return;
    }
    if (event.type === 'bootstrap') {
      if (this.isHost || !this.view.room?.members.some(member => member.id === this.view.memberId && member.ready)) return;
      this.state = event.checkpoint ? deserializeCoop(event.checkpoint, this.content)
        : createCoopState(event.run.seed, event.run.characterIds, this.content, event.run.difficultyId);
      this.display = this.state;
      this.prediction = new CoopPrediction(this.content, this.controlledHeroId!);
      this.prediction.reset(this.state);
      this.receivedSequence = event.sequence;
      this.predictionClock = performance.now();
      this.predictionClockTick = this.state.tick;
      if (this.commandTimer) clearTimeout(this.commandTimer);
      this.commandTimer = null; this.outgoingCommands = [];
      this.beginSimulation();
      this.present(true);
      return;
    }
    if (event.type !== 'frame' || this.isHost || !this.state) return;
    if (event.sequence !== this.receivedSequence + 1) throw new RoomRequestError('INVALID_SEQUENCE');
    const decoded: CoopFrame | CoopFrame[] = JSON.parse(event.frame);
    const frames = Array.isArray(decoded) ? decoded : [decoded];
    const acknowledgements: CoopInputAcknowledgement[] = [];
    for (const frame of frames) {
      this.state = applyCoopFrame(this.state, frame, this.content);
      acknowledgements.push(...(frame.acknowledgements ?? []).filter(item => item.memberId === this.view.memberId));
    }
    // Host stalls/backpressure can slow room time below wall time. Re-anchor
    // in both directions, otherwise a guest keeps that artificial lead forever.
    // Reconciliation retains its already drawn tick while the host catches up.
    this.predictionClock = performance.now();
    this.predictionClockTick = this.state.tick;
    this.display = this.prediction ? this.prediction.reconcile(this.state, acknowledgements) : this.state;
    this.receivedSequence = event.sequence;
    this.present();
  }
  private async flushPublications(): Promise<void> {
    if (this.publishing || !this.sentState) return;
    if (this.publicationTimer) clearTimeout(this.publicationTimer);
    this.publicationTimer = null;
    this.publishing = true;
    const generation = this.generation;
    try {
      while (this.publications.length && generation === this.generation) {
        const item = this.publications.shift()!;
        if ('memberId' in item) {
          if (!this.sentState) continue;
          try { await this.request({ type: 'sync', memberId: item.memberId, sequence: this.sentSequence, checkpoint: serializeCoop(this.sentState) }); }
          catch (error) {
            if (!(error instanceof RoomRequestError) || error.code === 'INVALID_SEQUENCE') throw error;
            if (!['NOT_IN_ROOM', 'NOT_READY'].includes(error.code)) this.update({ error: `Не удалось синхронизировать нового участника: ${error.message} Попросите его повторить готовность.` });
          }
        } else {
          const encoded = [JSON.stringify(item.frame)];
          let bytes = new TextEncoder().encode(encoded[0]).byteLength + 2;
          if (bytes > MAX_FRAME_BYTES) throw new Error('Сетевое событие превышает лимит.');
          let lastState = item.state;
          // A delayed ACK can accumulate many ticks. Send them together, in
          // order, without losing decisions or slowing the host's simulation.
          while (this.publications.length) {
            const next = this.publications[0];
            if ('memberId' in next) break;
            const json = JSON.stringify(next.frame);
            const size = new TextEncoder().encode(json).byteLength + 1;
            if (bytes + size > MAX_FRAME_BYTES) break;
            this.publications.shift(); encoded.push(json); bytes += size; lastState = next.state;
          }
          const frame = encoded.length === 1 ? encoded[0] : `[${encoded.join(',')}]`;
          const sequence = this.sentSequence + 1;
          await this.request({ type: 'publish', sequence, frame });
          if (generation !== this.generation) return;
          this.sentSequence = sequence;
          this.sentState = lastState;
          // Leave a short batching window even when an ACK arrives immediately.
          if (this.publications.length && !('memberId' in this.publications[0])) break;
        }
      }
    } catch (error) { if (generation === this.generation) this.fail(errorMessage(error)); }
    finally {
      if (generation === this.generation) {
        this.publishing = false;
        if (this.publications.length && !this.publicationTimer) this.publicationTimer = setTimeout(() => { this.publicationTimer = null; void this.flushPublications(); }, PUBLICATION_BATCH_MS);
      }
    }
  }
  private update(changes: Partial<NetworkSessionView>): void {
    if (Object.entries(changes).every(([key, value]) => this.view[key as keyof NetworkSessionView] === value)) return;
    this.view = { ...this.view, ...changes };
    for (const listener of this.listeners) listener();
  }
  private fail(message: string): void {
    this.dispose();
    this.update({ ...initialView(), status: 'closed', error: message });
  }
  private dispose(): void {
    this.save(true);
    ++this.generation;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.publicationTimer) clearTimeout(this.publicationTimer);
    if (this.commandTimer) clearTimeout(this.commandTimer);
    this.publicationTimer = this.commandTimer = null;
    this.outgoingCommands = [];
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.saveBeforeUnload);
      document.removeEventListener('visibilitychange', this.saveBeforeUnload);
    }
    this.connectAbort?.abort(); this.connectAbort = null;
    this.stopWatching?.(); this.stopWatching = null;
    this.connection?.close(); this.connection = null;
    this.state = this.display = this.sentState = null;
    this.prediction = null; this.nextInputId = 0; this.publications = []; this.earlyCommands = [];
    this.resume = null; this.saveIdentity = null; this.observedBattleId = null;
    this.lastSaved = 0;
    this.sentSequence = this.receivedSequence = 0;
    this.predictionClock = this.predictionClockTick = this.simulationClock = 0;
    this.publishing = this.starting = false;
  }
}
