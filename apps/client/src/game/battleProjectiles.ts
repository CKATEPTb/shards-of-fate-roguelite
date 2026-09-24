import { baseSkillId, PROJECTILE_KINDS, type CombatEvent, type Combatant, type GameContent, type ProjectileKind } from '@shards/shared';
import { findDefinition, gameContent } from '../catalog';

const ELEMENTS: [string, ProjectileKind][] = [
  ['FIRE', 'fire'], ['FROST', 'frost'], ['LIGHTNING', 'lightning'], ['HOLY', 'holy'],
  ['BLOOD', 'blood'], ['DEATH', 'bone'], ['DARK', 'shadow'], ['NATURE', 'nature'],
  ['POISON', 'poison'], ['STONE', 'stone'], ['ARCANE', 'arcane'],
];

/** Authored skill tags and the actual attacking hand choose the visual release. */
export function battleProjectileKind(actor: Combatant, action: CombatEvent, content: GameContent = gameContent): ProjectileKind | undefined {
  const definition = findDefinition(actor.definitionId, content);
  const skill = action.skillId ? content.skills.find(candidate => candidate.id === action.skillId) : undefined;
  if (skill?.projectile) return skill.projectile;
  const skillTags = skill?.tags ?? [];
  const explicit = PROJECTILE_KINDS.find(kind => skillTags.includes(`PROJECTILE_${kind.toUpperCase()}`))
    ?? ELEMENTS.find(([tag]) => skillTags.includes(`PROJECTILE_${tag}`))?.[1];
  if (explicit) return explicit;
  const canonicalId = action.skillId && baseSkillId(action.skillId);
  if (canonicalId === 'mage_ignite') return 'fire';
  if (canonicalId === 'necromancer_ward') return 'bone';
  const supportive = skill?.actions.some(entry => entry.type === 'heal' || entry.type === 'shield')
    || skill && ['ally', 'allAllies', 'lowestHealthAlly'].includes(skill.target);
  const element = ELEMENTS.find(([tag]) => skillTags.includes(tag))?.[1]
    ?? ELEMENTS.find(([tag]) => definition.tags.includes(tag))?.[1] ?? 'arcane';
  if (supportive) return element;
  const weapon = definition.anatomy?.equipment.find(item => item.slot === action.attackSlot)?.weapon
    ?? (!action.attackSlot ? definition.anatomy?.equipment.find(item => item.weapon?.kind !== 'shield' && item.weapon)?.weapon : undefined);
  if (weapon?.kind === 'bow' || definition.tags.includes('PROJECTILE')) return 'arrow';
  if (weapon?.kind === 'staff' || weapon?.kind === 'wand') return element;
  return undefined;
}

export function projectileTargets(actorId: string, events: readonly CombatEvent[]): string[] {
  const attack = events.find(event => event.type === 'ATTACK_STARTED' && event.actorId === actorId);
  if (attack?.targetId) return [attack.targetId];
  return [...new Set(events.filter(event => event.actorId === actorId && event.targetId !== actorId
    && ['HEALED', 'OVERHEALED', 'SHIELD_CREATED', 'STATUS_APPLIED'].includes(event.type))
    .flatMap(event => event.targetId ? [event.targetId] : []))].slice(0, 12);
}
