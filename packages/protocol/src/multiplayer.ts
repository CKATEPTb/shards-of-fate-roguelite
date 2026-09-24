import { z } from 'zod';
import { DIFFICULTY_IDS } from '@shards/shared';

/** Version of the browser-hosted multiplayer session contract. */
export const MULTIPLAYER_VERSION = 18 as const;
export const ROOM_REQUEST_ROUTE = 'room.request';
export const ROOM_EVENTS_ROUTE = 'room.events';
export const MAX_ROOM_MEMBERS = 4;
export const MAX_STATE_BYTES = 16 * 1024 * 1024;
export const MAX_FRAME_BYTES = 128 * 1024;
export const MAX_CHECKPOINT_BYTES = MAX_STATE_BYTES;
export const MAX_REQUEST_BYTES = 2 * MAX_CHECKPOINT_BYTES + 4096;

const id = z.string().min(1).max(128);
const rewardId = z.string().min(1).max(1024);
const equipmentSlot = z.enum(['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2', 'rightHand', 'leftHand']);
const skillSlot = z.union([z.literal(0), z.literal(1)]);
const inventorySlot = z.union([equipmentSlot, z.enum(['skill0', 'skill1'])]);
const point = z.object({ x: z.number().int().min(0).max(34), y: z.number().int().min(0).max(34) }).strict();
const versions = {
  protocolVersion: z.literal(MULTIPLAYER_VERSION),
  contentVersion: z.string().min(1).max(128),
};
const memberIdentity = {
  ...versions,
  name: z.string().trim().min(1).max(32),
  heroId: id,
};

/** Immutable world recipe and hero pool, shared by every participant. */
export const roomRunSchema = z.object({
  seed: z.string().min(1).max(256),
  characterIds: z.array(id).min(1).max(MAX_ROOM_MEMBERS).refine(ids => new Set(ids).size === ids.length),
  difficultyId: z.enum(DIFFICULTY_IDS),
  generatorVersion: z.literal(1),
}).strict();
export type RoomRun = z.infer<typeof roomRunSchema>;

/** Client input identity and simulation time, interpreted only by the host and peers. */
export const multiplayerInputSchema = z.object({
  id: z.number().int().positive().safe(),
  tick: z.number().int().nonnegative().safe(),
  /** Personal hero counter at issuance; movement from an earlier fight is stale. */
  diceIndex: z.number().int().nonnegative().safe().optional(),
}).strict();
export type MultiplayerInput = z.infer<typeof multiplayerInputSchema>;

/** Guests send intentions; the host applies them to their own authoritative simulation. */
export const combatChoiceSchema = z.object({ type: z.enum(['attack', 'skill', 'flee']), actorId: id, targetId: id.optional(), skillId: id.optional() }).strict();
export const multiplayerCommandSchema = z.union([
  z.object({ type: z.literal('move'), chunkId: id, x: z.number().int().min(0).max(34), y: z.number().int().min(0).max(34), from: point.optional(), fromElapsedMs: z.number().finite().min(0).max(10_000).optional() }).strict(),
  z.object({ type: z.literal('rest'), chunkId: id, poiId: id }).strict(),
  z.object({ type: z.literal('interact'), chunkId: id, poiId: id }).strict(),
  z.object({ type: z.literal('equip'), selections: z.array(z.object({ rewardId, slot: equipmentSlot }).strict()).min(1).max(10) }).strict(),
  z.object({ type: z.literal('learn'), rewardId, slot: skillSlot }).strict(),
  z.object({ type: z.literal('discard-reward'), rewardId }).strict(),
  z.object({ type: z.literal('collect-reward'), rewardId }).strict(),
  z.object({ type: z.literal('equip-inventory'), inventoryId: rewardId, slot: inventorySlot }).strict(),
  z.object({ type: z.literal('resolve-rewards'),
    equipment: z.array(z.object({ rewardId, slot: equipmentSlot }).strict()).max(10),
    skills: z.array(z.object({ rewardId, slot: skillSlot }).strict()).max(2),
    rewardIds: z.array(rewardId),
  }).strict(),
  z.object({ type: z.literal('battle'), battleId: id, action: z.literal('continue') }).strict(),
  z.object({ type: z.literal('battle'), battleId: id, action: z.literal('choose'), choice: combatChoiceSchema,
    expectedTurn: z.number().int().nonnegative().safe().optional() }).strict(),
]);
export type MultiplayerCommand = z.infer<typeof multiplayerCommandSchema>;
const multiplayerCommandEntrySchema = z.object({ command: multiplayerCommandSchema, input: multiplayerInputSchema.optional() }).strict();
export type MultiplayerCommandEntry = z.infer<typeof multiplayerCommandEntrySchema>;

export const roomRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('inspect'), code: z.string().regex(/^[A-Z2-9]{6}$/), ...versions }).strict(),
  z.object({ type: z.literal('create'), ...memberIdentity, run: roomRunSchema.optional() }).strict(),
  z.object({ type: z.literal('join'), ...memberIdentity, code: z.string().regex(/^[A-Z2-9]{6}$/) }).strict(),
  z.object({ type: z.literal('select'), heroId: id }).strict(),
  z.object({ type: z.literal('ready'), ready: z.boolean() }).strict(),
  z.object({ type: z.literal('start'), roomRevision: z.number().int().nonnegative().safe(), run: roomRunSchema, checkpoint: z.string().min(1).max(MAX_CHECKPOINT_BYTES).optional() }).strict(),
  z.object({ type: z.literal('publish'), sequence: z.number().int().positive().safe(), frame: z.string().min(1).max(MAX_FRAME_BYTES) }).strict(),
  z.object({ type: z.literal('sync'), memberId: id, sequence: z.number().int().nonnegative().safe(), checkpoint: z.string().min(1).max(MAX_CHECKPOINT_BYTES) }).strict(),
  z.object({ type: z.literal('command'), command: multiplayerCommandSchema, input: multiplayerInputSchema.optional() }).strict(),
  z.object({ type: z.literal('commands'), commands: z.array(multiplayerCommandEntrySchema).min(1).max(32) }).strict(),
  z.object({ type: z.literal('leave') }).strict(),
]);
export type RoomRequest = z.infer<typeof roomRequestSchema>;

export interface RoomMember {
  id: string;
  name: string;
  heroId: string;
  /** True while this player has confirmed and claimed their selected hero. */
  ready: boolean;
}

export interface RoomState {
  code: string;
  hostId: string;
  phase: 'lobby' | 'playing';
  members: RoomMember[];
  revision: number;
  run?: RoomRun;
  /** Before starting: available heroes; afterwards: the immutable run hero pool. */
  heroIds?: string[];
}

export type RoomErrorCode = 'INVALID_REQUEST' | 'INCOMPATIBLE_VERSION' | 'ROOM_NOT_FOUND' | 'ROOM_FULL'
  | 'ROOM_STARTED' | 'HERO_TAKEN' | 'INVALID_HERO' | 'PLAYER_READY' | 'NOT_IN_ROOM' | 'ALREADY_IN_ROOM' | 'HOST_ONLY'
  | 'NOT_READY' | 'INVALID_SEQUENCE' | 'RATE_LIMITED' | 'SERVER_FULL';

export type RoomResponse =
  | { ok: true; memberId: string; room?: RoomState | null }
  | { ok: false; code: RoomErrorCode; message: string };

export type RoomEvent =
  | { type: 'room'; room: RoomState }
  | { type: 'bootstrap'; run: RoomRun; sequence: number; checkpoint?: string }
  | { type: 'frame'; sequence: number; frame: string }
  | { type: 'sync-request'; memberId: string }
  | { type: 'command'; memberId: string; heroId: string; command: MultiplayerCommand; input?: MultiplayerInput }
  | { type: 'commands'; memberId: string; heroId: string; commands: MultiplayerCommandEntry[] }
  | { type: 'closed'; reason: 'host_left' | 'left' | 'slow_consumer' | 'server_shutdown' | 'subscription_timeout' };
