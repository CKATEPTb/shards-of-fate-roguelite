import { baseSkillId, type Combatant, type GameContent, type SkillDefinition, type UnitDefinition } from '@shards/shared';
import { gameContent } from '../../catalog';
import type { LoadoutIconKind, LoadoutSlot } from './loadoutModel';
import { passiveDiceRules, skillDiceRules } from './diceRules';

const skillIcons: Record<string, LoadoutIconKind> = {
  tank_taunt: 'class', healer_mend: 'mend', damage_burst: 'burst',
  guardian_bastion: 'characterActive', vampire_bloodlust: 'blood', paladin_radiance: 'radiance',
  priest_prayer: 'prayer', druid_regrowth: 'regrowth', necromancer_ward: 'ward',
  rogue_precision: 'precision', ranger_volley: 'volley', mage_ignite: 'fire',
};
const passiveIcons: Record<string, LoadoutIconKind> = {
  guardian: 'passive', vampire: 'blood', paladin: 'radiance', priest: 'prayer',
  druid: 'regrowth', necromancer: 'boneRenewal', rogue: 'evasion', ranger: 'volley', mage: 'fire',
};

export function activeLoadoutSlot(id: 'class' | 'characterActive' | 'extra1' | 'extra2', category: string, skill: SkillDefinition | undefined, unit?: Combatant, content: GameContent = gameContent): LoadoutSlot {
  const owner = unit && [...content.characters, ...content.enemies].find(definition => definition.id === unit.definitionId);
  const fallback = id === 'extra1' || id === 'extra2' ? 'extra' : id;
  return { id, icon: skill ? skillIcons[baseSkillId(skill.id)] ?? fallback : fallback, category, name: skill?.name ?? 'Не назначен',
    description: skill?.description ?? 'Способность в этом слоте пока не назначена.', empty: !skill,
    diceRules: skill ? skillDiceRules(skill, owner || undefined, content) : [],
    rarity: skill?.rarity ?? (skill && (id === 'class' || id === 'characterActive') ? 'common' : undefined),
    contentId: skill?.id, cooldown: skill ? { base: skill.cooldown, remaining: unit?.cooldowns[skill.id] ?? 0 } : undefined };
}

/** Metadata describes modifier passives too; effects still supply their real cooldown. */
export function passiveLoadoutSlot(definition?: UnitDefinition, unit?: Combatant, content: GameContent = gameContent): LoadoutSlot {
  const protection = definition?.modifiers.partyGuardDice;
  const effect = content.effects.find(candidate => definition?.effectIds.includes(candidate.id));
  const metadata = definition?.passive;
  const partyProtection = !!protection;
  return {
    id: 'passive', icon: definition ? passiveIcons[definition.id] ?? 'passive' : 'passive',
    category: 'Пассивная способность героя',
    name: metadata?.name ?? (partyProtection ? 'Защита союзников' : effect?.name ?? 'Не назначен'),
    description: metadata?.description ?? (partyProtection
      ? `Перед каждым ударом по союзнику бросает ${protection} и уменьшает входящий урон на результат броска, пока герой в строю.`
      : effect?.description ?? 'Пассивная способность пока не назначена.'),
    empty: !metadata && !partyProtection && !effect,
    contentId: definition && (metadata || partyProtection) ? `${definition.id}:passive` : effect?.id,
    rarity: metadata?.rarity ?? 'common',
    diceRules: passiveDiceRules(definition, content),
    badge: partyProtection ? `−${protection}` : undefined,
    cooldown: effect && effect.internalCooldown > 0 ? { base: effect.internalCooldown, remaining: unit?.effectCooldowns[effect.id] ?? 0 } : undefined,
  };
}
