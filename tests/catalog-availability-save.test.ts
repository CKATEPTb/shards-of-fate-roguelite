import { describe, expect, it } from 'vitest';
import { gameContent } from '@shards/game-data';
import { createCombat, createCoopState, deserializeCoop, deserializeSnapshot, hashValue, restoreContentHash, serializeCoop, serializeSnapshot } from '@shards/game-core';
import { contentWithLoadouts } from '../packages/game-core/src/coop/progression';

function previousContent() {
  const previous = structuredClone(gameContent);
  const haste = previous.statuses.find(status => status.id === 'haste')!;
  haste.modifiers = { initiativeBonus: 5 };
  haste.description = haste.description.replace('+2 к уклонению. +3 к проворности при побеге.',
    '+5 к следующему броску инициативы; уже определённую очередь не перестраивает.');
  const skill = previous.skills.find(skill => skill.id === 'exit_between_heartbeats')!;
  skill.description = 'Даёт союзнику Последнее мгновение на 2 хода: Проворность для побега +6, Уклонение +1. Само действие побега не выполняется.';
  skill.actions = [{ type: 'status', statusId: 'last_instant', duration: 2 }];
  return previous;
}

describe('catalog availability save compatibility', () => {
  it('recognizes the exact preceding shipped catalog', () => {
    expect(hashValue(previousContent())).toBe('46142700');
    expect(restoreContentHash('46142700', gameContent, 'content')).toBe(hashValue(gameContent));
  });

  it('retains saved patrols and acquired inventory when loading an expedition', () => {
    const state = createCoopState('CATALOG-MIGRATION', ['guardian'], previousContent());
    state.progression!.heroes.guardian.inventory = [{ id: 'saved-find', kind: 'equipment', definitionId: 'steel-greatsword', rarity: 'common', source: 'chest:saved', luckRolls: [] }];
    const restored = deserializeCoop(serializeCoop(state), gameContent);
    expect(restored.contentHash).toBe(hashValue(gameContent));
    expect(restored.groups).toEqual(state.groups);
    expect(restored.progression).toEqual(state.progression);
  });

  it('accepts combat saves with fitted equipment and learned skills', () => {
    const loadout = { guardian: { equipment: [{ itemId: 'steel-greatsword', slot: 'rightHand' as const }],
      skills: ['exit_between_heartbeats', null] as [string, null] } };
    const previous = contentWithLoadouts(previousContent(), loadout);
    const current = contentWithLoadouts(gameContent, loadout);
    const battle = createCombat({ seed: 'FITTED-MIGRATION', characterIds: ['guardian'], encounterId: 'mossy_path' }, previous);
    const restored = deserializeSnapshot(serializeSnapshot(battle), current);
    expect(restored.contentHash).toBe(hashValue(current));
    expect(restored.units).toEqual(battle.units);
  });

  it('still rejects unrelated changes to content and haste mechanics', () => {
    const changed = structuredClone(gameContent);
    changed.enemies[0].stats.power += 1;
    expect(() => restoreContentHash('46142700', changed, 'content')).toThrow();
    const alteredHaste = structuredClone(gameContent);
    alteredHaste.statuses.find(status => status.id === 'haste')!.modifiers.evasionBonus = 9;
    expect(() => restoreContentHash('46142700', alteredHaste, 'content')).toThrow();
  });
});
