import { describe, expect, it } from 'vitest';
import { findRoamingEncounter, hasRoamingLineOfSight, inRoamingRange, previewRoamingEncounter } from '../packages/game-core/src/roaming';
import { paintRoamingTile, roamingChunk, roamingGroup, roamingHero } from './helpers/roaming';

describe('roaming battle proximity', () => {
  it('starts only within one Euclidean tile and includes the whole initiating group', () => {
    const chunk = roamingChunk(); const heroes = [roamingHero(10, 10)];
    const pack = roamingGroup('pack', [{ x: 10, y: 11 }, { x: 20, y: 20 }]);
    expect(findRoamingEncounter(chunk, [pack], heroes)?.enemyIds).toEqual(['rat', 'rat']);
    pack.members[0].position = { x: 11, y: 11 };
    expect(findRoamingEncounter(chunk, [pack], heroes)).toBeNull();
    pack.members[0].position = { x: 13, y: 14 };
    expect(findRoamingEncounter(chunk, [pack], heroes)).toBeNull();
    // Old active battles retain their original trigger geometry when restored.
    expect(findRoamingEncounter(chunk, [pack], heroes, 5)?.enemyIds).toEqual(['rat', 'rat']);
    pack.members[0].position = { x: 14, y: 14 };
    expect(findRoamingEncounter(chunk, [pack], heroes)).toBeNull();
    expect(findRoamingEncounter(chunk, [pack], heroes, 5)).toBeNull();
  });

  it.each(['wall', 'tree', 'rock'] as const)('never initiates combat through %s', terrain => {
    const chunk = roamingChunk();
    paintRoamingTile(chunk, 12, 10, terrain);
    expect(hasRoamingLineOfSight(chunk, { x: 10, y: 10 }, { x: 14, y: 10 })).toBe(false);
    expect(findRoamingEncounter(chunk, [roamingGroup('pack', [{ x: 14, y: 10 }])], [roamingHero(10, 10)])).toBeNull();
    expect(findRoamingEncounter(chunk, [roamingGroup('pack', [{ x: 14, y: 10 }])], [roamingHero(10, 10)], 5)).toBeNull();
  });

  it('blocks exact diagonal corner sight in both directions', () => {
    const chunk = roamingChunk();
    paintRoamingTile(chunk, 11, 10, 'rock');
    expect(hasRoamingLineOfSight(chunk, { x: 10, y: 10 }, { x: 12, y: 12 })).toBe(false);
    expect(hasRoamingLineOfSight(chunk, { x: 12, y: 12 }, { x: 10, y: 10 })).toBe(false);
  });

  it('can see over water but cannot fight across separate walkable regions', () => {
    const chunk = roamingChunk();
    for (let y = 1; y < chunk.size - 1; y++) paintRoamingTile(chunk, 12, y, 'water');
    const from = { x: 10, y: 10 }; const to = { x: 14, y: 10 };
    expect(hasRoamingLineOfSight(chunk, from, to)).toBe(true);
    expect(inRoamingRange(chunk, from, to, 5)).toBe(false);
    expect(findRoamingEncounter(chunk, [roamingGroup('pack', [to])], [roamingHero(from.x, from.y)])).toBeNull();
  });

  it('a nearby ally can trigger the entire party battle', () => {
    const chunk = roamingChunk();
    const battle = findRoamingEncounter(chunk, [roamingGroup('pack', [{ x: 25, y: 25 }])],
      [roamingHero(5, 5), roamingHero(25, 24, 'priest')]);
    expect(battle?.actorId).toBe('priest');
  });
});

describe('one-time reinforcement union', () => {
  it('includes every pursuing pack regardless of distance or sight without recruiting their neighbors', () => {
    const chunk = roamingChunk();
    paintRoamingTile(chunk, 20, 10, 'wall');
    const groups = [
      roamingGroup('origin', [{ x: 10, y: 10 }]),
      roamingGroup('ordinary-pursuer', [{ x: 25, y: 10 }, { x: 25, y: 11 }], { mode: 'chase', targetActorId: 'guardian' }),
      roamingGroup('special-pursuer', [{ x: 28, y: 25 }, { x: 28, y: 26 }], { chases: true, mode: 'chase', targetActorId: 'priest' }),
      roamingGroup('patrol-near-pursuer', [{ x: 26, y: 14 }], { chases: true }),
    ];
    const heroes = [roamingHero(10, 11), roamingHero(6, 6, 'priest')];
    expect(hasRoamingLineOfSight(chunk, groups[0].members[0].position, groups[1].members[0].position)).toBe(false);
    const battle = findRoamingEncounter(chunk, groups, heroes)!;
    expect(battle.groupIds).toEqual(['origin', 'ordinary-pursuer', 'special-pursuer']);
    expect(battle.enemyIds).toHaveLength(5);
    expect(previewRoamingEncounter(chunk, groups, heroes, 'origin')).toEqual(battle);
    expect(findRoamingEncounter(chunk, groups, heroes, 1, false)?.groupIds).toEqual(['origin']);
  });

  it('pursuing groups alone cannot start a battle until someone makes contact', () => {
    const chunk = roamingChunk(); const heroes = [roamingHero(10, 11)];
    const groups = [roamingGroup('pursuer', [{ x: 25, y: 10 }], { mode: 'chase', targetActorId: 'guardian' })];
    expect(findRoamingEncounter(chunk, groups, heroes)).toBeNull();
    expect(previewRoamingEncounter(chunk, groups, heroes, 'pursuer')?.groupIds).toEqual(['pursuer']);
  });

  it('can validate older five-tile battles without retroactively adding distant pursuers', () => {
    const chunk = roamingChunk(); const heroes = [roamingHero(10, 14)];
    const groups = [roamingGroup('origin', [{ x: 10, y: 10 }]),
      roamingGroup('neighbor', [{ x: 15, y: 10 }]),
      roamingGroup('pursuer', [{ x: 25, y: 10 }], { mode: 'chase', targetActorId: 'guardian' })];
    expect(findRoamingEncounter(chunk, groups, heroes)).toBeNull();
    expect(findRoamingEncounter(chunk, groups, heroes, 5, false)?.groupIds).toEqual(['origin', 'neighbor']);
    expect(findRoamingEncounter(chunk, groups, heroes, 5, true)?.groupIds).toEqual(['origin', 'neighbor', 'pursuer']);
  });

  it('recruits complete groups near either initiator without recursively recruiting', () => {
    const chunk = roamingChunk();
    const groups = [
      roamingGroup('origin', [{ x: 10, y: 10 }]),
      roamingGroup('near-mob', [{ x: 15, y: 10 }, { x: 28, y: 28 }]),
      roamingGroup('chain-only', [{ x: 20, y: 10 }]),
      roamingGroup('near-hero', [{ x: 10, y: 16 }]),
    ];
    const heroes = [roamingHero(10, 11)];
    const battle = findRoamingEncounter(chunk, groups, heroes)!;
    expect(battle.groupIds).toEqual(['origin', 'near-mob', 'near-hero']);
    expect(battle.enemyIds).toHaveLength(4);
    expect(previewRoamingEncounter(chunk, groups, heroes, 'origin')).toEqual(battle);
  });

  it('does not let other heroes or distant pack members extend the recruitment radius', () => {
    const chunk = roamingChunk();
    const groups = [roamingGroup('origin', [{ x: 10, y: 10 }, { x: 25, y: 25 }]),
      roamingGroup('far', [{ x: 28, y: 25 }])];
    const battle = previewRoamingEncounter(chunk, groups, [roamingHero(10, 14), roamingHero(28, 31, 'priest')], 'origin');
    expect(battle?.groupIds).toEqual(['origin']);
  });

  it('does not recruit through opaque obstacles despite nearby coordinates', () => {
    const chunk = roamingChunk();
    for (let y = 1; y < chunk.size - 1; y++) paintRoamingTile(chunk, 12, y, 'wall');
    const groups = [roamingGroup('origin', [{ x: 10, y: 10 }]), roamingGroup('blocked', [{ x: 14, y: 10 }])];
    expect(findRoamingEncounter(chunk, groups, [roamingHero(10, 11)])?.groupIds).toEqual(['origin']);
  });

  it('returns no preview for an absent group or party', () => {
    const chunk = roamingChunk(); const group = roamingGroup('pack', [{ x: 10, y: 10 }]);
    expect(previewRoamingEncounter(chunk, [group], [roamingHero(5, 5)], 'missing')).toBeNull();
    expect(previewRoamingEncounter(chunk, [group], [], 'pack')).toBeNull();
  });
});
