import type { CombatEvent } from '@shards/shared';

/** The scene owns this clock. React never rolls dice or predicts the next turn. */
export interface InitiativePresentation {
  key: number;
  events: readonly CombatEvent[];
  elapsed: number;
  duration: number;
  finished: boolean;
  tie: boolean;
}

export const isInitiativeRoll = (event: CombatEvent): boolean => event.type === 'DICE_ROLLED'
  && (event.rollReason === 'initiative' || event.rollReason === 'initiativeTie');
