import { activeEquipmentSetAuras, activeEquipmentSetBonuses, isBodyAlive } from '@shards/game-core';
import type { Combatant, Modifiers, StatusDefinition, UnitDefinition } from '@shards/shared';
import { findDefinition } from '../catalog';

/** Equipment effects are derived from usable parts, never saved as temporary status stacks. */
export function equipmentAurasFor(unit: Combatant, definition: UnitDefinition = findDefinition(unit.definitionId)) {
  if (unit.escaped || (unit.body ? !isBodyAlive(unit.body) : unit.hp <= 0)) return [];
  return activeEquipmentSetAuras(definition, unit.body).map(entry => {
    const id = `${entry.setId}:${entry.aura.id}`;
    const status: StatusDefinition = {
      schemaVersion: 1, id, name: entry.aura.name, description: entry.aura.description,
      color: entry.aura.visual.colors[1], visual: entry.aura.visual,
      modifiers: entry.aura.modifiers, actions: [], tags: ['BUFF', 'EQUIPMENT'],
      polarity: 'positive', defaultDuration: null, stacking: 'refresh',
    };
    return { ...entry, id, status, timing: `Действует, пока доступны ${entry.pieces} частей комплекта «${entry.setName}»` };
  });
}

export function equipmentModifierSources(unit: Combatant, definition: UnitDefinition = findDefinition(unit.definitionId)): Modifiers[] {
  return activeEquipmentSetBonuses(definition, unit.body).flatMap(set => set.bonuses.flatMap(bonus =>
    bonus.aura ? [bonus.modifiers, bonus.aura.modifiers] : [bonus.modifiers]));
}
