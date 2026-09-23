# Deterministic manual combat

Content is injected into `src/index.ts`; the core has no UI, network, wall-clock or global random dependencies.

```ts
const ready = createCombat({ seed: 'spring-42', characterIds: ['guardian'], encounterId: 'mossy_path' }, gameContent);
const prepared = stepCombat(ready, gameContent);
// Enemy turns resolve individually. A hero turn waits in pendingActorId.
if (prepared.pendingActorId) {
  const choice = { type: 'attack' as const, actorId: prepared.pendingActorId };
  const target = combatTargets(prepared, gameContent, choice)[0];
  const resolved = submitCombatAction(prepared, gameContent, { ...choice, targetId: target.id });
}
```

## Turns and choices

- Initiative is `1d20 + initiative bonus`, once on joining the encounter. Equal totals trigger new unmodified d20 rolls for that tied subgroup until ordered. No actor ID resolves a tie. Late reinforcements enter at the next round boundary.
- `stepCombat` prepares one living participant's turn, decreases that participant's cooldowns and applies turn-start auras. Heroes then wait indefinitely for an explicit command. Enemies select an action only on their own turn.
- `submitCombatAction` validates the pending actor, learned skill, cooldown and target before cloning or consuming dice. An attack, a skill or a flee attempt consumes exactly one turn. End auras, duration expiry and terminal outcome then resolve. Two equipped one-handed weapons produce two sequential strikes within one Attack action, against the same selected target.
- `combatTargets` is a pure target enumerator shared by UI and validation. Harmful actions select enemies, beneficial actions allies. Self actions target their owner. Area skills accept a team member as an anchor and affect the whole eligible team. Taunt restricts single-enemy targets.
- Player skill selection ignores enemy AI health thresholds and priorities. A skill with cooldown 3 used on owner turn 1 becomes available on owner turn 4.
- A flee attempt rolls `1d20 + agility + aura bonuses - strongest living enemy level` against 15. Failure spends the action. Success releases only that hero. If nobody remains fighting, the battle ends as `escaped`; surviving enemies remain in the world. Adapters retreat the escaping hero to prevent immediate re-entry.
- `COMBAT_RULES` contains initiative frequency and escape threshold/scope. Network peers must use matching rules/content.

## Dice and auras

Every mechanical die emits `DICE_ROLLED` with actor, individual faces, sides, reason, stat modifier and total. Each entity has an independent seeded sequence. `2d4` consumes two indices. Hero counters persist between encounters; generated enemy IDs are stable and their counters begin at zero each new encounter. Presentation never draws from these streams.

Chance effects are explicit `DiceCheck { dice, atLeast }`, for example `1d4 >= 4`. Crit/evasion are integer d20 ratings. Damage, healing, shielding and periodic damage use authored dice; attribute bonuses are included in the visible roll. Armor and difficulty scaling are deterministic adjustments, not random checks.

Aura definitions declare positive/negative polarity and `TURN_STARTED`, `TURN_ENDED`, or passive modifiers. Active instances have their own `instanceId`, source, remaining duration and application turn. Null duration is indefinite. Reapplications stack independently unless the definition explicitly declares refresh semantics. Numeric modifiers add across independent instances. Durations count the bearer's subsequent turns, not rounds or other actors' turns. Already-applied auras retain their source's stats when the source dies or escapes; preservation passives require that source to remain in combat.

## Network, presentation and persistence

Local and network actions use the same pure transition. A compact room event carries the action/target plus entity dice advances. A guest predicts its own action immediately, then reconciles acknowledged events. Waiting for a player's choice emits no repeated combat steps. Host controls only heroes without a connected owner.

The presentation queue shows every die, reveals its face and adds the stat modifier before displaying the effect. Controls stay locked until all events of the previous transition have been presented. The queue and its shared duration calculation do not affect combat results.

Snapshots preserve pending choice, initiative order, wounds, cooldowns, aura instances, entity dice counters and contiguous event history. Content and shape validation reject incompatible or malformed snapshots. A guarded migration from the preceding shipped content retains world progress, injuries and counters while converting the old percentage ratings into the new attributes.

`runCombat` stops at the next hero choice unless a caller explicitly provides a decision policy. The offline balance tool supplies its own policy; it is not available as a game mode, and its outcomes are not shown as victory probabilities in the world.
