import type { AuraVisualDefinition, CombatEvent, CombatState, Combatant, GameContent, ProjectileKind, SkillDefinition, WeaponKind } from '@shards/shared';
import { findDefinition } from '../catalog';
import { battleProjectileKind } from '../game/battleProjectiles';
import { playSound } from './engine';
import type { SoundCue } from './types';

const projectileCues: Record<ProjectileKind, SoundCue> = {
  arrow: 'bow', fire: 'fire', frost: 'frost', lightning: 'lightning', holy: 'holy',
  shadow: 'shadow', nature: 'nature', blood: 'blood', arcane: 'arcane', poison: 'nature', bone: 'shadow', stone: 'heavy',
};
const familyCues: Record<AuraVisualDefinition['family'], SoundCue> = {
  blood: 'blood', holy: 'holy', nature: 'nature', shadow: 'shadow', arcane: 'arcane', fire: 'fire', frost: 'frost',
  storm: 'lightning', stone: 'heavy', metal: 'sword', venom: 'nature', spirit: 'shadow', time: 'arcane', war: 'heavy', astral: 'arcane',
};
const weaponCues: Record<WeaponKind, SoundCue> = {
  sword: 'sword', greatsword: 'heavy', dagger: 'dagger', mace: 'heavy', greatmace: 'heavy', hammer: 'heavy',
  greathammer: 'heavy', sickle: 'sword', scythe: 'heavy', bow: 'bow', staff: 'staff', wand: 'magic', shield: 'block',
};
const tagCues: ReadonlyArray<readonly [string, SoundCue]> = [
  ['FIRE', 'fire'], ['FROST', 'frost'], ['LIGHTNING', 'lightning'], ['STORM', 'lightning'], ['HOLY', 'holy'],
  ['BLOOD', 'blood'], ['DEATH', 'shadow'], ['DARK', 'shadow'], ['SHADOW', 'shadow'], ['NATURE', 'nature'],
  ['POISON', 'nature'], ['STONE', 'heavy'], ['ARCANE', 'arcane'],
];
const taggedCue = (tags: readonly string[]): SoundCue | undefined => tagCues.find(([tag]) => tags.includes(tag))?.[1];

function skillCue(skill: SkillDefinition | undefined, content: GameContent): SoundCue | undefined {
  if (!skill) return undefined;
  if (skill.projectile) return projectileCues[skill.projectile];
  if (skill.icon) return familyCues[skill.icon.family];
  const element = taggedCue(skill.tags);
  if (element) return element;
  if (skill.actions.some(action => action.type === 'heal')) return 'heal';
  if (skill.actions.some(action => action.type === 'shield')) return 'shield';
  const statusId = skill.actions.find(action => action.type === 'status')?.statusId;
  if (statusId) {
    const status = content.statuses.find(entry => entry.id === statusId);
    return status?.visual ? familyCues[status.visual.family] : status ? taggedCue(status.tags) ?? 'aura' : 'aura';
  }
  return undefined;
}

/** Metadata covers catalog additions automatically; ordinary attacks use their real hand's weapon. */
export function playBattleAction(actor: Combatant, action: CombatEvent, content: GameContent, pan = 0): void {
  const definition = findDefinition(actor.definitionId, content);
  const skill = action.skillId ? content.skills.find(entry => entry.id === action.skillId) : undefined;
  const projectile = battleProjectileKind(actor, action, content);
  const weapon = definition.anatomy?.equipment.find(item => item.slot === action.attackSlot)?.weapon
    ?? (!action.attackSlot ? definition.anatomy?.equipment.find(item => item.weapon && item.weapon.kind !== 'shield')?.weapon : undefined);
  const cue = skillCue(skill, content) ?? (projectile ? projectileCues[projectile] : undefined)
    ?? (action.type === 'ATTACK_STARTED' && weapon ? weaponCues[weapon.kind] : undefined)
    ?? taggedCue(definition.tags) ?? (action.type === 'SKILL_USED' ? 'magic' : 'sword');
  playSound(cue, { pan, volume: .7, intensity: skill?.rarity === 'legendary' ? 1.3 : weapon?.hands === 2 ? 1.15 : 1 });
}

/** All dice in the visible group share a single rattle, regardless of party size. */
export function playBattleDice(events: readonly CombatEvent[], pan = 0): void {
  const count = events.reduce((total, event) => total + (event.rolls?.length ?? 0), 0);
  if (count) playSound('dice', { pan, volume: .42, intensity: Math.min(1.2, .7 + count * .045) });
}

interface BattleImpactAudio {
  content: GameContent;
  units: ReadonlyMap<string, Combatant>;
  outcome: CombatState['status'];
  panForUnit(id: string | undefined): number;
}

/** Resolve a whole impact at once, with at most three layers for a multi-target spell. */
export function playBattleImpact(events: readonly CombatEvent[], context: BattleImpactAudio): void {
  const layers = new Map<SoundCue, { events: CombatEvent[]; priority: number; volume: number }>();
  const add = (cue: SoundCue, event: CombatEvent, priority: number, volume = .7) => {
    const existing = layers.get(cue);
    if (existing) { existing.events.push(event); existing.priority = Math.max(existing.priority, priority); existing.volume = Math.max(existing.volume, volume); }
    else layers.set(cue, { events: [event], priority, volume });
  };
  const critical = events.some(event => event.type === 'CRIT');
  for (const event of events) {
    switch (event.type) {
      case 'DAMAGE':
        if ((event.amount ?? 0) > 0) add(critical ? 'critical' : 'hit', event, 7);
        break;
      case 'HEALED': if ((event.amount ?? 0) > 0) add('heal', event, 6, .62); break;
      case 'SHIELD_CREATED': if ((event.amount ?? 0) > 0) add('shield', event, 6, .58); break;
      case 'BLOCKED': case 'SHIELD_BROKEN': add('block', event, 5, .55); break;
      case 'MISS': add('dodge', event, 4, .55); break;
      case 'STATUS_APPLIED': case 'STATUS_UPDATED': {
        const status = context.content.statuses.find(entry => entry.id === event.statusId);
        add(status?.visual ? familyCues[status.visual.family] : status ? taggedCue(status.tags) ?? 'aura' : 'aura', event, 3, .36);
        break;
      }
      case 'STATUS_EXPIRED': add('aura', event, 1, .22); break;
      case 'ENTITY_DIED': add('death', event, 9, .75); break;
      case 'FLEE_SUCCEEDED': add('flee', event, 8, .65); break;
      case 'FLEE_FAILED': add('block', event, 5, .45); break;
      case 'TURN_STARTED': {
        const hero = context.units.get(event.actorId ?? '')?.team === 'heroes';
        add('turn', event, 2, hero ? .4 : .22);
        break;
      }
      case 'COMBAT_STARTED':
        if ([...context.units.values()].some(unit => findDefinition(unit.definitionId, context.content).tags.includes('BOSS'))) add('bossArrival', event, 8, .65);
        break;
      case 'COMBAT_ENDED':
        add(context.outcome === 'victory' ? 'victory' : context.outcome === 'escaped' ? 'flee' : 'defeat', event, 10, .8);
        break;
    }
    // Periodic aura ticks have no casting animation: retain their authored school beneath the result.
    if (event.statusId && ['DAMAGE', 'HEALED', 'SHIELD_CREATED'].includes(event.type)) {
      const status = context.content.statuses.find(entry => entry.id === event.statusId);
      if (status?.visual) add(familyCues[status.visual.family], event, 3, .3);
    }
  }
  for (const [cue, layer] of [...layers].sort(([, a], [, b]) => b.priority - a.priority).slice(0, 3)) {
    const amount = Math.max(0, ...layer.events.map(event => event.amount ?? 0));
    const pan = layer.events.reduce((sum, event) => sum + context.panForUnit(event.targetId ?? event.actorId), 0) / layer.events.length;
    playSound(cue, { pan, volume: layer.volume, intensity: Math.min(1.4, .8 + Math.log1p(amount) / 10) });
  }
}
