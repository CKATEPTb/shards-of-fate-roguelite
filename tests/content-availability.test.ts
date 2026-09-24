import { describe, expect, it } from 'vitest';
import { gameContent } from '@shards/game-data';
import { assertContentAvailability, auditContentAvailability } from '../tools/content-validator/src/playability';

describe('shipped content availability gate', () => {
  it('covers every catalog through production pools, compatible outfits and rooted aura sources', () => {
    const result = assertContentAvailability(gameContent);
    expect(result.counts).toMatchObject({ enemies: 550, bosses: 50, items: 4861, sets: 500, learnedSkills: 400, auras: 150, setAuras: 28 });
    expect(Object.values(result.missing).flat()).toEqual([]);
    expect(Object.keys(result.enemyRoutes)).toHaveLength(gameContent.enemies.length);
  });

  it('rejects a valid enemy definition that cannot appear in any production pool', () => {
    const content = structuredClone(gameContent);
    content.enemies.push({ ...content.enemies[0], id: 'unreachable-enemy', tags: ['ACT_1', 'SEASON_VOID', 'TIER_1'] });
    expect(auditContentAvailability(content).missing.enemies).toContain('unreachable-enemy');
    expect(() => assertContentAvailability(content)).toThrow('unreachable-enemy');
  });

  it('does not mistake an unreachable enemy-only skill for an obtainable aura', () => {
    const content = structuredClone(gameContent);
    content.statuses.push({ ...content.statuses[0], id: 'unreachable-aura' });
    content.skills.push({ ...content.skills[0], id: 'unreachable-skill', rarity: undefined,
      actions: [{ type: 'status', statusId: 'unreachable-aura', duration: 3 }] });
    content.enemies.push({ ...content.enemies[0], id: 'unreachable-caster', skillIds: ['unreachable-skill'], tags: [] });
    expect(auditContentAvailability(content).missing.auras).toContain('unreachable-aura');
  });

  it('checks that the aura of every set activates from its own obtainable outfit', () => {
    const content = structuredClone(gameContent);
    const set = Object.values(content.equipmentCatalog!.sets).find(set => set.bonuses?.some(bonus => bonus.aura))!;
    set.loadout = { head: set.loadout!.head };
    expect(auditContentAvailability(content).missing.sets).toContain(set.id);
  });
});
