# Deterministic combat core

The public entry point is `src/index.ts`. Content is injected; this package imports only shared contracts. It has no UI, network, wall-clock or global random dependencies.

```ts
const ready = createCombat({ seed: 'spring-42', characterIds: ['guardian', 'priest', 'mage'], encounterId: 'mossy_path' }, gameContent);
const afterOneTurn = stepCombat(ready, gameContent);
const finished = runCombat(afterOneTurn, gameContent);
const restored = deserializeSnapshot(serializeSnapshot(afterOneTurn), gameContent);
```

## Transition rules

- `createCombat` validates selection and creates `ready` state. Party scaling changes enemy maximum HP and power; heroes keep their authored stats.
- The first `stepCombat` starts combat and resolves one entire living actor turn. Every round rerolls initiative as a visible `d20 + initiative`, descending, with ascending actor ID for ties. Dead actors are skipped. Terminal input is returned as an unchanged copy.
- Each actor turn decreases that actor's skill and passive cooldowns, dispatches turn-start effects and periodic statuses, chooses a skill or basic attack, processes end-turn periodic statuses and effects, then expires statuses. Terminal outcome is determined after the complete turn, allowing simultaneous elimination from periodic damage to produce a draw.
- Skills choose descending priority, then ascending skill ID. `allyWounded` and `selfWounded` use the configured HP ratio threshold. A cooldown of 3 used on owner turn 1 becomes available on owner turn 4.
- Default single-enemy targeting prefers greatest maximum HP. Taunt overrides single-enemy targeting and prefers greatest **current** HP. Equal candidates use ascending actor ID. Low-health selection compares current / maximum HP. Area attacks ignore taunt.
- An action batch locks targets per selector. If damage kills the selected enemy, a following burn/poison action skips that corpse; it does not jump to a fresh enemy. An explicit different selector has its own selection.

## Rolls and action primitives

All combat randomness consumes only the `COMBAT` stream and emits `DICE_ROLLED`. `WORLD`, `LOOT`, `ENCOUNTER` and `EVENT` have independent persisted xorshift32 states/counters, initialized from the seed and stream name. Extra draws in one stream cannot advance another. A public RNG or dice operation returns a new RNG value, never mutating its argument.

Dice accept `d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `NdX` and signed integer modifiers, including uppercase notation and whitespace around modifiers. Inputs are bounded at 1000 dice, a modifier magnitude of 1,000,000 and 64 expression characters. `rollD20` additionally supports advantage/disadvantage with two draws and retained individual rolls.

Attacks roll a visible d20. A roll at or below `max(1, floor(evasion × 20))` misses. Natural 20 always crits; other critical results satisfy `roll > 20 − floor(crit × 20)`. Thus crit 0.10 crits on 19–20, and fractional chance stats are quantized into d20 bands. There is no hidden percentage roll. Periodic and passive damage automatically lands and cannot crit.

Actions share one pipeline for damage, healing, shielding and statuses:

1. Base amount is `floor((dice + selected stat × factor) × remainingDuration)`; the duration multiplier applies only when explicitly authored.
2. Damage applies source damage multipliers, critical multiplier, `100 / (100 + armor × armorFactor)`, then flat/party reduction. Positive damage has a minimum of 1. Party reductions sum from living allies, exclude the aura owner's own received damage, and use the data-defined reduction cap.
3. Shields absorb damage first. `DAMAGE.amount` is actual HP loss; absorbed damage is stated in the log. Healing cannot revive, and `HEALED` fires only for actual HP restored. Excess healing is a separate `OVERHEALED` event.
4. Statuses have one instance per definition/target. Reapplication never shortens duration. An equal or longer application refreshes duration and source. Duration counts the bearer's subsequent complete turns; a status applied during the current turn is not decremented at that turn's end. Periodic damage uses the original applier's current stats and the status's remaining duration, even if the applier has died.

Guardian party reduction, Priest's `HEALED → eventTarget` buff, Mage's crit-triggered burn and enemy effects all use these same primitives. No character IDs are hardcoded in mechanics.

## Effects and safeguards

Effects run synchronously in descending priority, then effect ID and owner ID. Conditions use the event's source and target. An internal cooldown is set **before** child events dispatch. Trigger depth and events per step are bounded by content values; a breach raises `CombatLimitError` while leaving the caller's state untouched. `maxRounds` resolves a stalemate as a draw. The full-run API adds an independent step bound and uses the exact same transition as the one-turn API.

`COMBAT_ENDED` can have child effect events after its marker. The outcome is recomputed after those effects, so a final sacrifice that kills the surviving side resolves as a draw. Snapshots preserve these children and forbid subsequent action/turn lifecycle events.

Every public combat transition clones its input. Internal mutation occurs only within that private clone. `runCombat` clones once and avoids copying the growing event log on every turn.

## Snapshots and compatibility

Snapshots contain schema version, deterministic content checksum, complete roster/stats, initiative cursor, statuses, cooldowns, all RNG streams and event sequence. Restore validates structure, finite/ranged values, all references, exact roster and authored stats, event order, turn counts, survivors and terminal status. Unknown fields, incompatible content and unsupported schema versions are rejected. Saved content includes a checksum of the entire authored data, so content edits intentionally invalidate old saves rather than silently diverging on replay.

`hashState` sorts object keys before calculating its deterministic checksum. Checksums detect accidental divergence; they are not a cryptographic proof of authenticity or anti-cheat protection. Incompatible future mechanics require a schema version bump or an explicit migration. Content must first pass the repository content validator; snapshot validation does not substitute for validating new authored content.

## Verification

The core tests cover immutable replay, independent streams and a fixed PRNG vector; dice grammar/advantage; cooldowns; periodic duration; shared shields/heals/auras; taunt tie rules; multi-action target locking; recursion/event/round guards; strict corrupted-snapshot rejection; changed-content rejection; and identical continuation after restore. Repository integration tests exercise the actual character/enemy content across every party composition and encounter.
