import { describe, expect, it } from 'vitest';
import { createCombat } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import { buildLoadout, loadoutColumns } from '../apps/client/src/components/exploration/loadoutModel';

const createParty = () => createCombat({ seed: 'loadout-hud', characterIds: ['guardian', 'priest', 'mage'], encounterId: 'mossy_path' }, gameContent);

describe('informational loadout model', () => {
  it('shows ten equipment slots and five abilities in three complete columns', () => {
    const model = buildLoadout(createParty(), 'guardian');
    expect(model.equipment.map(slot => slot.id)).toEqual(['helmet', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2', 'mainHand', 'offHand']);
    expect(model.equipment.filter(slot => !slot.empty)).toHaveLength(gameContent.characters.find(hero => hero.id === 'guardian')!.anatomy!.equipment.length);
    expect(model.equipment.filter(slot => slot.empty).map(slot => slot.id)).toEqual(['amulet', 'ring1', 'ring2']);
    expect(model.equipment.filter(slot => !slot.empty).every(slot => slot.contentId && slot.condition === 'active' && !slot.cooldown)).toBe(true);
    expect(model.skills.map(slot => slot.id)).toEqual(['class', 'characterActive', 'passive', 'extra1', 'extra2']);
    expect(model.skills.filter(slot => slot.empty).map(slot => slot.id)).toEqual(['extra1', 'extra2']);
    const columns = loadoutColumns(model);
    expect(columns.map(column => column.slots.length)).toEqual([5, 5, 5]);
    expect(columns.flatMap(column => column.slots)).toEqual([...model.equipment, ...model.skills]);
  });

  it('uses the actual skill text, base cooldown and selected combatant countdown', () => {
    const state = createParty();
    const guardian = state.units.find(unit => unit.definitionId === 'guardian')!;
    guardian.cooldowns.tank_taunt = 4;
    guardian.cooldowns.guardian_bastion = 7;
    const before = structuredClone(state);
    const model = buildLoadout(state, guardian.id);
    for (const [slotId, skillId, remaining] of [['class', 'tank_taunt', 4], ['characterActive', 'guardian_bastion', 7]] as const) {
      const slot = model.skills.find(item => item.id === slotId)!;
      const skill = gameContent.skills.find(item => item.id === skillId)!;
      expect(slot.name).toBe(skill.name);
      expect(slot.description).toBe(skill.description);
      expect(slot.cooldown).toEqual({ base: skill.cooldown, remaining });
    }
    expect(model.skills.find(slot => slot.id === 'passive')).toMatchObject({
      name: gameContent.characters.find(hero => hero.id === 'guardian')!.passive!.name,
      badge: '25%', contentId: 'partyDamageReduction',
    });
    expect(state).toEqual(before);
  });

  it('follows the selected hero and existing passive effects', () => {
    const state = createParty();
    const priest = buildLoadout(state, 'priest');
    expect(priest.heroName).toBe('Жрица');
    expect(priest.skills.find(slot => slot.id === 'class')).toMatchObject({ contentId: 'healer_mend', category: 'Классовая способность · Целитель' });
    expect(priest.skills.find(slot => slot.id === 'characterActive')?.contentId).toBe('priest_prayer');
    const passive = priest.skills.find(slot => slot.id === 'passive')!;
    expect(passive.description).toBe(gameContent.characters.find(hero => hero.id === 'priest')!.passive?.description
      ?? gameContent.effects.find(effect => effect.id === 'priest_benediction')!.description);
  });

  it('never substitutes an ally when the controlled hero is missing', () => {
    const state = createParty();
    const missing = buildLoadout(state, 'unknown');
    expect(missing.heroName).toBe('Герой');
    expect(missing.skills.every(slot => slot.empty && !slot.contentId && !slot.cooldown)).toBe(true);
    const withoutGuardian = { ...state, units: state.units.filter(unit => unit.definitionId !== 'guardian') };
    expect(buildLoadout(withoutGuardian, 'guardian').skills.every(slot => slot.empty)).toBe(true);
  });

  it('shows the unavailable anatomical hand and ring and the surviving half of paired gloves', () => {
    const state = createParty();
    const unit = state.units.find(unit => unit.definitionId === 'guardian')!;
    const original = buildLoadout(state, 'guardian');
    unit.body!.rightArm.current = 0;
    const model = buildLoadout(state, 'guardian');
    expect(model.equipment.find(slot => slot.id === 'mainHand')).toMatchObject({ empty: false, condition: 'unavailable', bodyParts: ['rightArm'], bonuses: { power: 0 } });
    expect(model.equipment.find(slot => slot.id === 'ring1')).toMatchObject({ empty: true, condition: 'unavailable', bodyParts: ['rightArm'] });
    expect(model.equipment.find(slot => slot.id === 'offHand')?.condition).toBe('active');
    expect(model.equipment.find(slot => slot.id === 'ring2')?.condition).toBeUndefined();
    const gloves = model.equipment.find(slot => slot.id === 'gloves')!;
    expect(gloves).toMatchObject({ condition: 'partial', badge: '½' });
    expect(gloves.resources?.leftArm).toBeGreaterThan(0);
    expect(gloves.resources?.rightArm ?? 0).toBe(0);
    expect(model.armor).toBeLessThan(original.armor);
  });

  it('explains one-leg and no-leg movement and disables only the lost halves of leg equipment', () => {
    const state = createParty();
    const body = state.units.find(unit => unit.definitionId === 'guardian')!.body!;
    body.leftLeg.current = 0;
    expect(buildLoadout(state, 'guardian').bodyNote).toContain('хромотой');
    expect(buildLoadout(state, 'guardian').equipment.find(slot => slot.id === 'boots')?.condition).toBe('partial');
    body.rightLeg.current = 0;
    const model = buildLoadout(state, 'guardian');
    expect(model.bodyNote).toContain('ползком');
    expect(model.equipment.find(slot => slot.id === 'boots')?.condition).toBe('unavailable');
    expect(model.equipment.find(slot => slot.id === 'pants')?.condition).toBe('unavailable');
  });

  it.each(gameContent.characters)('shows the actual $id abilities, passive metadata and anatomical equipment', definition => {
    const state = createCombat({ seed: 'roster-loadout', characterIds: [definition.id], encounterId: 'mossy_path' }, gameContent);
    const model = buildLoadout(state, definition.id);
    expect(model.heroName).toBe(definition.name);
    expect(model.skills.slice(0, 3).every(slot => !slot.empty)).toBe(true);
    expect(model.skills.slice(0, 2).map(slot => slot.contentId)).toEqual(definition.skillIds);
    const passive = model.skills.find(slot => slot.id === 'passive')!;
    expect(passive.name).toBe(definition.passive!.name);
    expect(passive.description).toBe(definition.passive!.description);
    expect(model.equipment.filter(slot => !slot.empty).map(slot => slot.name))
      .toEqual(definition.anatomy!.equipment.map(item => item.name));
    expect(loadoutColumns(model).map(column => column.slots.length)).toEqual([5, 5, 5]);
    state.units[0].body!.rightArm.current = 0;
    expect(buildLoadout(state, definition.id).equipment.find(slot => slot.id === 'mainHand')!.condition).toBe('unavailable');
  });
});
