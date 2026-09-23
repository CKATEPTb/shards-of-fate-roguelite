import { z } from 'zod';

export * from './multiplayer';

/** Transport contracts only. Authentication and host authority live in the Phase 2 coordinator. */
export const PROTOCOL_VERSION = 1 as const;
const id = z.string().min(1).max(128);
const slot = z.enum(['helmet', 'chest', 'gloves', 'belt', 'pants', 'boots', 'amulet', 'ring1', 'ring2', 'rightHand', 'leftHand', 'scroll1', 'scroll2']);
const header = {
  protocolVersion: z.literal(PROTOCOL_VERSION), messageId: id, lobbyId: id,
  runId: id, senderId: id, senderSequence: z.number().int().nonnegative().safe(),
};
const intent = <T extends string, S extends z.ZodRawShape>(type: T, payload: S) =>
  z.object({ ...header, type: z.literal(type), payload: z.object(payload).strict() }).strict();

export const intentSchema = z.discriminatedUnion('type', [
  intent('MOVE_TO', { chunkId: id, x: z.number().int().min(0).max(34), y: z.number().int().min(0).max(34) }),
  intent('INTERACT', { entityId: id }),
  intent('EQUIP_ITEM', { itemId: id, slot, confirmed: z.literal(true) }),
  intent('UNEQUIP_ITEM', { slot }),
  intent('SELECT_REWARD', { rewardId: id.nullable() }),
  intent('ACTIVATE_ALTAR', { altarId: id }),
  intent('VOTE', { voteId: id, optionId: id }),
  intent('CHANGE_SCROLL', { itemId: id, slot: z.enum(['scroll1', 'scroll2']), confirmed: z.literal(true) }),
]);

export type IntentEnvelope = z.infer<typeof intentSchema>;
export const parseIntent = (input: unknown): IntentEnvelope => intentSchema.parse(input);

export type SequenceDecision = 'accept' | 'duplicate' | 'resync';
/** Pure sequence check; caller commits a new sequence only after accepting the event. */
export function checkRunSequence(lastAccepted: number, incoming: number): SequenceDecision {
  if (!Number.isSafeInteger(lastAccepted) || lastAccepted < 0 || !Number.isSafeInteger(incoming) || incoming < 1) {
    throw new Error('Run sequences must be nonnegative safe integers; events start at 1.');
  }
  if (incoming <= lastAccepted) return 'duplicate';
  return incoming === lastAccepted + 1 ? 'accept' : 'resync';
}

export interface HostEventEnvelope<T> {
  protocolVersion: typeof PROTOCOL_VERSION;
  messageId: string; lobbyId: string; runId: string; senderId: string;
  senderSequence: number; runSequence: number; type: 'HOST_EVENT'; payload: T;
}
