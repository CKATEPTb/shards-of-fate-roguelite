import { applyCoopInput, MOVEMENT_TICK_MS, stepCoop } from '@shards/game-core';
import type { MultiplayerCommand } from '@shards/protocol';
import type { CoopResult, CoopState, GameContent } from '@shards/shared';

/** Stop speculating after five seconds without an authoritative frame. */
export const MAX_PREDICTION_TICKS = Math.floor(5_000 / MOVEMENT_TICK_MS);

export interface PredictedInput {
  id: number;
  tick: number;
  /** The hero's persistent counter, not the room's diagnostic total. */
  diceIndex?: number;
  command: MultiplayerCommand;
}

export interface PredictionAcknowledgement {
  inputId: number;
  accepted: boolean;
  reason?: string;
}

/** A disposable simulation branch; it never becomes the host's saved state. */
export class CoopPrediction {
  private predicted: CoopState | null = null;
  private confirmedAt = 0;
  private pending: PredictedInput[] = [];
  private applied = new Set<number>();

  constructor(private readonly content: GameContent, private readonly actorId: string) {}

  get state(): CoopState {
    if (!this.predicted) throw new Error('Prediction needs an initial confirmed state.');
    return this.predicted;
  }
  get inputs(): readonly PredictedInput[] { return this.pending; }
  get pendingCount(): number { return this.pending.length; }
  get confirmedTick(): number { return this.confirmedAt; }

  reset(confirmed: CoopState): void {
    this.confirmedAt = confirmed.tick;
    this.predicted = structuredClone(confirmed);
    this.pending = [];
    this.applied.clear();
  }

  /** Only valid intentions enter replay; a rejected click must never revive later. */
  issue(input: PredictedInput): CoopResult {
    if (!Number.isSafeInteger(input.id) || input.id < 1 || !Number.isSafeInteger(input.tick) || input.tick < 0) {
      throw new Error('Invalid predicted input identity or tick.');
    }
    if (this.pending.some(candidate => candidate.id === input.id)) throw new Error('Duplicate predicted input.');
    if (input.tick > this.confirmedAt + MAX_PREDICTION_TICKS) throw new Error('Predicted input exceeds the prediction window.');
    // Commands contain an optional mutable origin, so own that data as well.
    const owned = structuredClone(input);
    this.advanceTo(owned.tick);
    owned.diceIndex ??= this.heroDiceIndex(this.state);
    const result = applyCoopInput(this.state, this.actorId, owned.command, this.content, owned.tick);
    if (result.accepted === false) return result;
    this.pending.push(owned);
    this.pending.sort((a, b) => a.tick - b.tick || a.id - b.id);
    this.predicted = result.state;
    this.applied.add(owned.id);
    return result;
  }

  /** Run the same movement, encounters, AI and dice as the host on this branch. */
  advanceTo(tick: number): CoopState {
    if (!Number.isSafeInteger(tick) || tick < 0) throw new Error('Invalid prediction tick.');
    const target = Math.min(Math.max(tick, this.state.tick), this.confirmedAt + MAX_PREDICTION_TICKS);
    for (const input of this.pending) {
      if (this.applied.has(input.id) || input.tick > target) continue;
      this.simulateTo(input.tick);
      // Crossing a battle/escape invalidates an old movement origin. Replaying
      // it after the actor is released would resume the route from before combat.
      if (!this.staleAction(input, this.state)) this.predicted = applyCoopInput(this.state, this.actorId, input.command, this.content, input.tick).state;
      this.applied.add(input.id);
    }
    this.simulateTo(target);
    return this.state;
  }

  reconcile(confirmed: CoopState, acknowledgements: readonly PredictionAcknowledgement[], targetTick?: number): CoopState {
    const previousTick = this.state.tick;
    const acknowledged = new Set(acknowledgements.map(acknowledgement => acknowledgement.inputId));
    this.pending = this.pending.filter(input => !acknowledged.has(input.id) && !this.staleAction(input, confirmed));
    this.confirmedAt = confirmed.tick;
    this.predicted = structuredClone(confirmed);
    this.applied.clear();
    // Late inputs use their original timestamp: applyCoopInput catches up their
    // movement from the sent origin instead of waiting for another round trip.
    return this.advanceTo(Math.max(previousTick, targetTick ?? confirmed.tick, confirmed.tick));
  }

  reject(inputId: number, confirmed: CoopState): CoopState {
    return this.reconcile(confirmed, [{ inputId, accepted: false }]);
  }

  /** An unsent route superseded in the same outgoing batch needs no host ACK. */
  forget(inputId: number): void {
    this.pending = this.pending.filter(input => input.id !== inputId);
    this.applied.delete(inputId);
  }

  private heroDiceIndex(state: CoopState): number { return state.diceCounters?.[`hero:${this.actorId}`] ?? 0; }
  private staleAction(input: PredictedInput, state: CoopState): boolean {
    return (input.command.type === 'move' || input.command.type === 'battle')
      && input.diceIndex !== undefined && input.diceIndex < this.heroDiceIndex(state);
  }

  private simulateTo(tick: number): void {
    while (this.state.tick < tick) {
      const previousTick = this.state.tick;
      this.predicted = stepCoop(this.state, this.content).state;
      // Completed/failed runs intentionally keep their final simulation tick.
      if (this.state.tick <= previousTick) break;
    }
  }
}
