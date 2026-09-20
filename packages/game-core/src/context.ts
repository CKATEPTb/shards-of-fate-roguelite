import type { CombatEvent, CombatState, GameContent, UnitDefinition } from '@shards/shared';

export type EventInput = Omit<CombatEvent, 'sequence' | 'turn' | 'round'>;
export interface CombatContext {
  state: CombatState;
  content: GameContent;
  eventCount: number;
  depth: number;
  /** A healing broadcast cannot start another broadcast anywhere in its trigger chain. */
  sharingHealing?: boolean;
  emit: (event: EventInput) => void;
}

export class CombatLimitError extends Error {
  constructor(message: string) { super(message); this.name = 'CombatLimitError'; }
}

export function definitionFor(ctx: CombatContext, definitionId: string): UnitDefinition {
  const definition = [...ctx.content.characters, ...ctx.content.enemies].find(unit => unit.id === definitionId);
  if (!definition) throw new Error(`Unknown unit definition: ${definitionId}`);
  return definition;
}

export function compareIds(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
