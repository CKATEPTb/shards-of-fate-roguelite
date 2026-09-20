import type { CombatState, GameContent } from '@shards/shared';
import { CombatLimitError, type CombatContext } from './context';
import { triggerEffects } from './effects';

export function createContext(state: CombatState, content: GameContent): CombatContext {
  const ctx: CombatContext = {
    state, content, eventCount: 0, depth: 0,
    emit(event) {
      if (ctx.eventCount >= content.balance.maxEventsPerStep) throw new CombatLimitError('Maximum events per combat step exceeded');
      if (ctx.depth >= content.balance.maxTriggerDepth) throw new CombatLimitError('Maximum effect trigger depth exceeded');
      const entry = { ...event, sequence: state.nextSequence++, turn: state.turn, round: state.round };
      ctx.eventCount++;
      state.events.push(entry);
      ctx.depth++;
      try { triggerEffects(ctx, entry); } finally { ctx.depth--; }
    },
  };
  return ctx;
}
