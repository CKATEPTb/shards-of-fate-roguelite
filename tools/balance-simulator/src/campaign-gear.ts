import { BODY_PARTS, equipmentItemFitsSlot, type ActionDefinition, type CoopState, type GameContent, type HeroBody, type HeroProgress, type InventoryTarget, type Modifiers, type SkillDefinition, type TargetSelector } from '@shards/shared';
import { activeEquipmentSetBonuses, bodyCombatStats, bodyPartArmor, equipmentCondition, getCoopBattle, isBodyAlive } from '@shards/game-core';
import { changeLoadout, equippedHero, previewInventoryEquip } from '../../../packages/game-core/src/coop/progression';

const equipmentSlots: InventoryTarget[] = ['head', 'chest', 'gloves', 'pants', 'boots', 'amulet', 'ring1', 'ring2', 'rightHand', 'leftHand'];

function diceMean(expression?: string): number {
  const match = expression?.match(/^(\d+)d(\d+)(?:([+-]\d+))?$/);
  return match ? Number(match[1]) * (Number(match[2]) + 1) / 2 + Number(match[3] ?? 0) : 0;
}

/** A transparent greedy gear policy, independent of the simulation's seeded dice. */
export function campaignSkillValue(skill: SkillDefinition, content: GameContent, power: number, partySize: number): number {
  // Positive means an ally benefits; negative means an enemy benefits. A periodic
  // action targeting "self" belongs to the aura bearer, not necessarily the hero.
  const relation = (target: TargetSelector, selected: number, periodic: boolean) => target === 'self' ? periodic ? selected : 1
    : ['enemy', 'lowestHealthEnemy', 'allEnemies', 'randomEnemy'].includes(target) ? -1
    : ['ally', 'lowestHealthAlly', 'allAllies', 'randomAlly'].includes(target) ? 1 : selected;
  const actionValue = (action: ActionDefinition, selected: number, depth = 0): number => {
    const amount = action.damagePerStack ?? diceMean(action.dice) + (action.scaling ? power * (action.factor ?? 1) : 0);
    const target = action.target ?? (depth ? 'self' : skill.target);
    const side = relation(target, selected, depth > 0);
    if (action.targetRelation && (action.targetRelation === 'ally' ? side < 0 : side > 0)) return 0;
    const count = target === 'allAllies' ? partySize : target === 'allEnemies' ? 2 : 1;
    if (action.type === 'damage') {
      const aura = action.onHitStatusId ? actionValue({ type: 'status', statusId: action.onHitStatusId,
        duration: action.onHitDuration, target }, selected, depth) : 0;
      return -side * amount * (action.hits ?? 1) * count + aura;
    }
    if (action.type === 'heal') return side * amount * count * 1.1;
    if (action.type === 'shield') return side * amount * count * .7;
    if (depth > 1) return 0;
    const status = content.statuses.find(entry => entry.id === action.statusId);
    if (!status) return 0;
    const duration = Math.min(5, action.duration ?? status.defaultDuration ?? 3);
    const modifiers = status.modifiers;
    const direct = (modifiers.powerBonus ?? 0) * 1.8 + (modifiers.damageBonus ?? 0) * 1.8
      + (modifiers.armorBonus ?? 0) * 2 + (modifiers.damageReduction ?? 0) * 2 + (modifiers.partyDamageReduction ?? 0) * partySize * 2
      + (modifiers.evasionBonus ?? 0) * .7 + (modifiers.accuracyBonus ?? 0) * .7 + (modifiers.critBonus ?? 0) * .6
      + diceMean(modifiers.vampirismDice) + diceMean(modifiers.damageBonusDice) * 1.5
      + diceMean(modifiers.partyGuardDice) * partySize + (modifiers.invulnerable ? power : 0);
    return count * duration * (side * direct + status.actions.reduce((sum, action) => sum + actionValue(action, side, depth + 1), 0));
  };
  const selectedValue = (selected: number) => skill.actions.reduce((sum, action) => sum + actionValue(action, selected), 0);
  const value = skill.target === 'any' ? Math.max(selectedValue(1), selectedValue(-1))
    : skill.target === 'randomUnit' ? (partySize * selectedValue(1) + 2 * selectedValue(-1)) / (partySize + 2)
    : selectedValue(relation(skill.target, -1, false));
  return value / Math.max(2, skill.cooldown + 1);
}

export function campaignGearScore(heroId: string, progress: HeroProgress, content: GameContent, body: HeroBody | undefined, partySize: number): number {
  const base = content.characters.find(hero => hero.id === heroId)!;
  const definition = equippedHero(base, progress, content);
  const stats = body ? bodyCombatStats(definition, body) : definition.stats;
  const equipment = definition.anatomy?.equipment ?? [];
  const active = equipment.filter(item => !body || equipmentCondition(item, body).active);
  const weapons = active.filter(item => item.weapon?.damage && item.weapon.kind !== 'shield');
  const sets = activeEquipmentSetBonuses(definition, body);
  let power = stats.power, accuracy = stats.accuracy ?? 0, crit = stats.crit;
  let defense = (stats.evasion + (stats.resilience ?? 0)) * 1.25;
  for (const set of sets) for (const bonus of set.bonuses) for (const modifier of [bonus.modifiers, bonus.aura?.modifiers] as Array<Modifiers | undefined>) {
    power += modifier?.powerBonus ?? 0; accuracy += modifier?.accuracyBonus ?? 0; crit += modifier?.critBonus ?? 0;
    defense += (modifier?.evasionBonus ?? 0) + (modifier?.resilienceBonus ?? 0) + (modifier?.armorBonus ?? 0) * 4
      + diceMean(modifier?.vampirismDice) * 2 + diceMean(modifier?.partyGuardDice) * partySize * 2
      + diceMean(modifier?.healingShareDice) * partySize;
    power += diceMean(modifier?.damageBonusDice) + (modifier?.repeatAttack ? power * .12 : 0);
  }
  const hp = BODY_PARTS.reduce((sum, part) => {
    if (body?.[part].lost) return sum;
    const max = (definition.anatomy?.base[part] ?? 0) + equipment.reduce((value, item) => value + (item.resources[part] ?? 0), 0);
    const armor = body ? bodyPartArmor(definition, body, part) : equipment.reduce((value, item) => value + (item.bodyParts.includes(part) ? item.armor : 0), 0);
    return sum + (max * .15 + armor * 2.5) * (part === 'head' || part === 'torso' ? 1.5 : 1);
  }, 0);
  const skills = progress.skills.reduce((sum, id) => {
    const skill = content.skills.find(skill => skill.id === id);
    return sum + (skill ? campaignSkillValue(skill, content, power, partySize) * 1.5 : 0);
  }, 0);
  // Match weaponPowerFor: each hand receives its own weapon bonus, not its partner's bonus too.
  const attackDamage = weapons.length ? weapons.reduce((sum, weapon) => {
    const otherPower = weapons.reduce((total, other) => total + (other === weapon ? 0 : other.bonuses?.power ?? 0), 0);
    return sum + Math.max(0, power - otherPower) * (definition.basicAttack.factor ?? 1) + diceMean(weapon.weapon?.damage);
  }, 0) : equipment.some(item => item.weapon) ? 0 : power * (definition.basicAttack.factor ?? 1) + diceMean(definition.basicAttack.dice);
  return hp + defense + attackDamage * (1 + Math.min(18, accuracy) / 30 + Math.min(18, crit) / 35)
    + (stats.initiative ?? 0) * .35 + (stats.agility ?? 0) * .5 + (stats.luck ?? 0) * .3 + skills;
}

export interface CampaignGearChanges { collected: number; equipped: number; learned: number }

/** Collect first, then equip only a strictly improving valid loadout; displaced items stay destroyed. */
export function optimizeCampaignInventory(state: CoopState, content: GameContent, equip: boolean): { state: CoopState; changes: CampaignGearChanges } {
  const changes: CampaignGearChanges = { collected: 0, equipped: 0, learned: 0 };
  const partySize = state.actors.filter(actor => !actor.body || isBodyAlive(actor.body)).length;
  for (const actorId of state.characterIds) {
    const actor = state.actors.find(actor => actor.id === actorId)!;
    if (actor.body && !isBodyAlive(actor.body) || getCoopBattle(state, actorId)) continue;
    for (const reward of [...(state.progression?.heroes[actorId].rewards ?? [])]) {
      state = changeLoadout(state, actorId, { type: 'collect-reward', rewardId: reward.id }, content);
      changes.collected++;
    }
    if (!equip) continue;
    for (let iteration = 0; iteration < 30; iteration++) {
      const progress = state.progression!.heroes[actorId], body = state.actors.find(actor => actor.id === actorId)?.body;
      const current = campaignGearScore(actorId, progress, content, body, partySize);
      let best: { id: string; target: InventoryTarget; score: number; skill: boolean } | undefined;
      for (const reward of progress.inventory ?? []) {
        const item = reward.kind === 'equipment' ? content.equipmentCatalog?.items[reward.definitionId] : undefined;
        const targets: InventoryTarget[] = reward.kind === 'skill' ? progress.skills.includes(reward.definitionId) ? [] : ['skill0', 'skill1']
          : equipmentSlots.filter(target => item && target !== 'skill0' && target !== 'skill1' && equipmentItemFitsSlot(item, target));
        for (const target of targets) {
          let candidate: HeroProgress;
          try { candidate = previewInventoryEquip(progress, reward.id, target, content, body); } catch { continue; }
          const score = campaignGearScore(actorId, candidate, content, body, partySize);
          if (score > current + .01 && (!best || score > best.score + .01)) best = { id: reward.id, target, score, skill: reward.kind === 'skill' };
        }
      }
      if (!best) break;
      state = changeLoadout(state, actorId, { type: 'equip-inventory', inventoryId: best.id, slot: best.target }, content);
      if (best.skill) changes.learned++; else changes.equipped++;
    }
  }
  return { state, changes };
}
