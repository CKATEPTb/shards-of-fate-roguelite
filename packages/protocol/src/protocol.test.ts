import { describe, expect, it } from 'vitest';
import { checkRunSequence, parseIntent } from './index';

const move = { protocolVersion: 1, messageId: 'm-1', lobbyId: 'l-1', runId: 'r-1', senderId: 'p-1', senderSequence: 0, type: 'MOVE_TO', payload: { chunkId: 'spring-0', x: 3, y: 8 } };
describe('versioned peer intent contracts', () => {
  it('accepts a valid movement intent', () => expect(parseIntent(move)).toEqual(move));
  it.each([
    { ...move, protocolVersion: 2 },
    { ...move, senderSequence: -1 },
    { ...move, senderSequence: Number.MAX_SAFE_INTEGER + 1 },
    { ...move, payload: { ...move.payload, damage: 9999 } },
    { ...move, type: 'DEAL_DAMAGE', payload: { damage: 9999 } },
    { ...move, payload: { ...move.payload, x: 35 } },
    { ...move, runSequence: 100 },
  ])('rejects malformed or authoritative peer mutations %#', value => expect(() => parseIntent(value)).toThrow());
  it('requires an explicit confirmation before equipment replacement', () => {
    const equip = { ...move, type: 'EQUIP_ITEM', payload: { itemId: 'item-1', slot: 'mainHand', confirmed: true } };
    expect(parseIntent(equip).type).toBe('EQUIP_ITEM');
    expect(() => parseIntent({ ...equip, payload: { ...equip.payload, confirmed: false } })).toThrow();
  });
  it('distinguishes duplicate delivery from a missing event', () => {
    expect(checkRunSequence(12, 13)).toBe('accept');
    expect(checkRunSequence(12, 12)).toBe('duplicate');
    expect(checkRunSequence(12, 9)).toBe('duplicate');
    expect(checkRunSequence(12, 14)).toBe('resync');
    expect(() => checkRunSequence(0, NaN)).toThrow();
  });
});
