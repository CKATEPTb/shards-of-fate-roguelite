# Seasonal NPC services

## World and interaction

Current generation places one merchant, one blacksmith and one scribe in each season: twelve service sites. Private seed streams select distinct seasonal nodes outside the starting node and seasonal altars. A service house is appended after ordinary structures, retaining their IDs and basement ordinals. NPC houses have no chest or basement.

Each NPC has a role-specific sign, props and a permanent animated torch. Torch light shines through trees and does not consume the campfire clock. Ordinary houses still hide their contents. Clicking a service building or NPC uses the existing pathfinder/arrival flow; walking past never opens a window. Guests wait for confirmed arrival.

Service dialogs close on movement, combat, death, changing chunk or connection loss. Transactions require the actor's actual stopped position at that NPC. The world keeps running during services. Structure versions 1/2 retain legacy generation. This extends the current version 3 recipe; together with the preceding ring-layout change, a new expedition is the intended way to use the new map.

## Merchant and prices

Each merchant has twelve fixed offers: one complete catalogue set and two base learnable skills at each rarity. Seed/POI hashing over catalogue IDs does not consume hero dice. Everyone sees the same stock, but each hero purchases each offer once independently. Stock never refreshes.

Purchases enter the hidden bag, without equipping. Sets include their original hands and jewellery. `HeroProgress.npcPurchases` records personal offer IDs and prevents repeated payment or duplication. Purchased definitions also leave the hero's reward pool.

| Rarity | Complete set | Skill | Equipment upgrade to this tier | Ability upgrade to this tier |
| --- | ---: | ---: | ---: | ---: |
| Common | 180 | 40 | — | — |
| Rare | 500 | 120 | 80 | 120 |
| Epic | 1200 | 320 | 220 | 320 |
| Legendary | 3000 | 800 | 600 | 800 |

Shared `npc.ts` tables supply UI and transaction prices. These are initial prices; earlier campaign balance reports predate these services.

## Blacksmith

Only equipped gear upgrades, one tier per purchase, to legendary. Names, visuals, mechanics and set identity remain. The window shows current and proposed attributes, protection, durability and weapon dice before payment.

Variants resolve from `upgrade:<rarity>:<base-id>` without changing base loot entries. Each tier above the original adds +7 torso / +3 other protected-part durability, +1 to existing positive attributes (+2 Power on weapons), +1 protection on armour / +3 on shields, and +2 sides to each weapon damage die. Penalties remain. Jewelry does not acquire limb armour. Calculating from the base avoids accumulated rounding.

Upgrading preserves wound fractions and lost limbs. Later swaps return the variant to the bag. Two rarities of the same base piece count as one distinct piece for set bonuses.

## Scribe

All five slots participate: class, character active, character passive and two equipped learned abilities. Native abilities start common. Empty extra slots and legendary abilities cannot upgrade. `HeroLoadout.nativeSkillRarities` stores native ranks; learned slots store variant IDs. Combat loadouts and the content cache include native ranks.

Active variants preserve targeting and hit count. Result dice gain two sides per tier; finite beneficial durations gain one turn per tier. Self-damage costs and harmful effects on friendly targets do not increase. Accuracy/critical d20 checks never change with rarity. Bastion uses duration 1/2/3/4 and cooldown 3/4/5/6, preserving two unprotected turns. Durationless Scattered Tinder uses cooldown 4/3/2/1.

Passive training strengthens its mechanic: guardian/paladin d4→d6→d8→d10, vampire d6→d8→d10→d12, rogue Evasion +5/+6/+7/+8, priest blessing duration 2/3/4/5, mage burning stacks 1/2/3/4. Druid, necromancer and ranger checks: common d4≥4, rare d20≥14, epic d20≥12, legendary d20≥10. Temporary ranger buffs cannot lower the trained passive's probability.

Variants tagged `UPGRADED` remain resolvable in combat/saves but do not inflate base loot, shop or knowledge catalogues. Native variants also carry `NATIVE`. Base identities drive icons, animation aliases and duplicate-slot checks. Descriptions derive from transformed actions.

## Synchronization and persistence

Protocol 20 adds `npc-buy`, `npc-upgrade-equipment`, `npc-upgrade-skill` and compact `npc-service` events. Upgrade requests include the expected ID and, for abilities, rarity. Stale clicks cannot buy another tier accidentally. All references/funds are validated before mutation. No per-purchase snapshot is sent. Client and relay must both use protocol 20.

Saves contain IDs, native ranks, purchases and coins. Older progress without ranks/purchases defaults to common native abilities and unpurchased stock. Content-hash migration compares the exact original catalogue after removing appended variants; original content mismatches still fail.

## Workshop

`artifacts/npc-services-preview.html` mounts the production dialogs and world renderer. It provides 10,000 temporary coins, all three NPC roles, hero/season selection, and the real character inventory for equipping purchases. Transactions use `commandCoop` at each generated NPC's actual approach point. The isolated workshop neither writes a save nor opens a network session.
