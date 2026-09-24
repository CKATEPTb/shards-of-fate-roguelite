# 0033 — Automatic equipment selection

## Behaviour

The fullscreen inventory offers **Автоматически заменять экипировку**. It is a
personal, saved `HeroProgress.autoEquipment` preference, defaulting to false for
new and older saves. Enabling it immediately evaluates worn equipment and the
hero's collected bag. It evaluates again when loot is collected, merchant stock
is bought, or worn equipment is upgraded. Pending rewards remain uncollected
until the player takes them. The feature works with the inventory closed.

Skills are never chosen, replaced or consumed automatically. Their existing
mechanics are read when valuing equipment auras: shield preservation has value
only when the hero can create shields, for example. Manually equipping a piece
of gear turns the preference off; manually selecting a skill leaves it unchanged.
The preference can be enabled again to reconsider the complete bag.

## Scoring

The scoring policy is an explicit utility heuristic, not a promise of maximum
win probability against every opponent. Rarity alone does not decide a swap.
The policy values the complete outfit, attached body parts, weapon dice and
active, distinct 2/4/6 set thresholds. Weak intermediate pieces can be included
when their completed synergy improves the whole outfit.

Base attribute point weights:

| Attribute | Weight |
| --- | ---: |
| Luck | 20 → 0.4, smoothly reduced with overall equipment quality |
| Power | 5 |
| Evasion | 4 |
| Accuracy | 3 |
| Critical hit | 2.8 |
| Resilience | 2.6 |
| Initiative | 1.5 |
| Agility / escape | 0.15 |

`quality` is the average attainable rarity over ten equipment slots: common is
0, rare 1/3, epic 2/3 and legendary 1. Worn items and bag contents both count;
one ring cannot fill two slots, while a two-handed weapon fills both hand slots.
Anatomical compatibility is respected. The frozen coefficient for a search is
`0.4 + 19.6 × (1 − quality)²`. This gives approximately 20 / 9.11 / 2.58 / 0.4
points per Luck for uniformly common / rare / epic / legendary equipment.
Keeping displaced items in the bag preserves the policy context, preventing
automatic swaps from changing their own Luck priority and oscillating.

Luck above 19 has no additional loot-roll value. Other combat ratings have
diminishing weights beyond useful d20 ranges; excess evasion can still counter
enemy accuracy. Durability and the expected result of per-part armor dice add
defensive value, with extra weight on vital parts. Weapon value includes both
hands' separate hits, each weapon's own Power contribution, accuracy and crits.

Set auras use deterministic dice expectations, never future seeded rolls:
extra damage dice, repeat attacks, party protection, life drain, shared healing,
shield preservation and periodic-healing preservation all contribute. The
same special-rule override order as combat is respected, including the trained
Ranger exception; independent extra damage dice add together. No aura bonus is
awarded merely for reaching six pieces: its actual rules determine its value.
Rarity is only a tiny final tie-breaker once utility is practically equal.

## Search and performance

The search pools worn and bag instances, retaining real inventory identities.
It combines strong individual candidates with independently constructed set
bundles. Bundles can cross temporary attribute losses and be packed around one
another, so 6-piece sets and mixed 2/4/6 arrangements compete as complete outfits.
Hands and rings remain interchangeable where anatomy allows; one real instance
cannot be used twice, and rarity variants of one base item count as one set part.

Candidate beams and a 10,000 complete-outfit evaluation limit bound the search.
Preprocessing is linear in owned item definitions and does not enumerate the
whole catalogue. This is a bounded search rather than exhaustive enumeration;
it may miss the global maximum in exceptionally large inventories. Equal or
lower scores retain the current outfit. Search happens at explicit inventory
events, never on a render frame or world tick, and consumes no game dice.

## Atomic state and multiplayer

The compact `set-auto-equipment` intent carries only a boolean. Host, guest
prediction and event replay derive the same outfit locally from the shared
content and owned items; no candidate lists or additional per-piece commands
are transmitted. Protocol version **22** requires matching client and relay.

Selection references either a real bag instance ID or an existing worn slot
and expected item ID. All selections are validated together, then the final
outfit is committed once. Displaced worn gear returns to the bag; untouched bag
entries retain their order and identity. Consumed IDs are merged into replay
history. Limb health ratios are converted directly to the final maxima once,
avoiding cumulative rounding through intermediate outfits; lost parts stay lost.
Unchanged outfits retain the existing array and body state.

Enabling or changing equipment is unavailable during a battle or after death,
following existing command guards. The setting survives checkpoints and room
reconnection with the rest of the hero's progression.

## Validation scope

The implementation was source-reviewed and compiled with `npm run build`.
No simulations, gameplay tests, or win-rate recalibration were requested for
this change. Existing balance reports describe their earlier equipment policy.
