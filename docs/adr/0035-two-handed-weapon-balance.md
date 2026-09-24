# 0035 — Two-handed basic attacks

## Reason

Two one-handed weapons already perform two independent strikes. Both strikes receive innate Power, equipment/set Power and applicable bonus damage. Increasing only the damage die of a two-handed weapon cannot keep up as these shared bonuses grow.

## Rule

An offensive two-handed weapon makes one basic strike with its existing native weapon dice. The contribution from scaled Power and flat damage bonuses is doubled. Each source of bonus damage dice is rolled twice, consuming the corresponding dice from the attacker's deterministic stream. A critical hit doubles the resulting total before defense as usual.

The strike still has one hit check, one critical check and one defense resolution. On-hit effects, life drain and critical-triggered auras occur once. Two one-handed weapons retain their two strikes and their separate chances to apply those effects. Two-handed weapons therefore favor concentrated damage against protection, while two weapons favor effects applied on individual hits.

This applies to all offensive two-handed kinds, including bows and staves, and to basic attacks repeated by passives. Skills retain their own authored scaling. Both arms must remain usable, and a two-handed item still counts as one distinct set piece.

`weaponAttackBonusMultiplier` in shared weapon rules is consumed by combat, equipment scoring, simulation action estimates and item presentation. Catalogue identities, rarity upgrades, saved item stats and snapshot fields are unchanged.

## Arithmetic reference

These are expected raw totals for successful noncritical basic attacks, not simulation results. The example uses 10 shared Power, a scaling factor of 1, no buffs, no armor, and catalogue weapons with the minimum variation bonus. The pair uses the generic one-handed damage ladder (not the smaller dagger ladder).

| Rarity | Two one-handed strikes | Two-handed before | Two-handed after |
| --- | ---: | ---: | ---: |
| Common | 35 | 22.5 | 39.5 |
| Rare | 41 | 26 | 45 |
| Epic | 47 | 30 | 51 |
| Legendary | 54 | 33.5 | 56.5 |

The modest raw-damage advantage compensates for fewer on-hit/critical effects and one fewer distinct set item. Actual outcomes still depend on defenses, hit chance, equipment and skills; these totals do not establish campaign win rates.
