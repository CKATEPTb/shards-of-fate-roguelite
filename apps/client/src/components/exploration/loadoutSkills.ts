import type { Combatant, SkillDefinition, UnitDefinition } from '@shards/shared';
import { gameContent } from '../../catalog';
import type { LoadoutIconKind, LoadoutSlot } from './loadoutModel';

const skillIcons: Record<string, LoadoutIconKind> = {
  tank_taunt: 'class', healer_mend: 'mend', damage_burst: 'burst',
  guardian_bastion: 'characterActive', vampire_bloodlust: 'blood', paladin_radiance: 'radiance',
  priest_prayer: 'prayer', druid_regrowth: 'regrowth', necromancer_ward: 'ward',
  rogue_precision: 'precision', ranger_volley: 'volley', mage_ignite: 'fire',
};
const passiveIcons: Record<string, LoadoutIconKind> = {
  guardian: 'passive', vampire: 'blood', paladin: 'radiance', priest: 'prayer',
  druid: 'regrowth', necromancer: 'ward', rogue: 'evasion', ranger: 'volley', mage: 'fire',
};

export function activeLoadoutSlot(id: 'class' | 'characterActive', category: string, skill: SkillDefinition | undefined, unit?: Combatant): LoadoutSlot {
  return { id, icon: skill ? skillIcons[skill.id] ?? id : id, category, name: skill?.name ?? 'Не назначен',
    description: skill?.description ?? 'Способность в этом слоте пока не назначена.', empty: !skill,
    contentId: skill?.id, cooldown: skill ? { base: skill.cooldown, remaining: unit?.cooldowns[skill.id] ?? 0 } : undefined };
}

/** Metadata describes modifier passives too; effects still supply their real cooldown. */
export function passiveLoadoutSlot(definition?: UnitDefinition, unit?: Combatant): LoadoutSlot {
  const reduction = definition?.modifiers.partyDamageReduction;
  const effect = gameContent.effects.find(candidate => definition?.effectIds.includes(candidate.id));
  const metadata = definition?.passive;
  const partyProtection = reduction !== undefined && reduction > 0;
  return {
    id: 'passive', icon: definition ? passiveIcons[definition.id] ?? 'passive' : 'passive',
    category: 'Пассивная способность героя',
    name: metadata?.name ?? (partyProtection ? 'Защита союзников' : effect?.name ?? 'Не назначен'),
    description: metadata?.description ?? (partyProtection
      ? `Снижает входящий урон всех союзников, включая самого героя, на ${Math.round(reduction * 100)}%, пока герой в строю.`
      : effect?.description ?? 'Пассивная способность пока не назначена.'),
    empty: !metadata && !partyProtection && !effect,
    contentId: partyProtection ? 'partyDamageReduction' : effect?.id ?? (metadata ? `${definition!.id}:passive` : undefined),
    badge: partyProtection ? `${Math.round(reduction * 100)}%` : undefined,
    cooldown: effect && effect.internalCooldown > 0 ? { base: effect.internalCooldown, remaining: unit?.effectCooldowns[effect.id] ?? 0 } : undefined,
  };
}
