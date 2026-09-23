# 0027 — Loot pickup and inventory by equipment slot

## Decision

Loot is collected separately from equipping it. The reward dialog lists pending finds; one click moves a find to the hero's persistent inventory. Pickup does not alter attributes or equipment. There is no standalone inventory window or bag button.

The character sheet is the equipment entry point. Clicking an equipment slot opens its current item and inventory candidates for that slot. The first click on a candidate displays its description, the current item, and attribute/armor/durability differences. Clicking the same candidate again equips it immediately. Switching candidates or slots never equips anything. The two learned ability slots use the same interaction.

The previously agreed destruction rule still applies: displaced equipment or abilities are removed. Other inventory entries remain available. A two-handed weapon is one item occupying both hands, and replacing it with a one-handed item frees its other hand. Rings can be equipped independently in either ring slot. Lost limbs and duplicate equipped skills follow core validation.

Closing the loot dialog with uncollected finds asks for confirmation before discarding only those pending rewards. Collected inventory is unaffected. Empty loot closes directly. Coins remain an automatic reward and a noninteractive HUD counter; only pending loot exposes an opening button.

## State and synchronization

`HeroProgress.inventory` stores collected reward records with their stable IDs. Old saves normalize a missing inventory to an empty array. `collect-reward` and `equip-inventory` commands run through the existing local/host/predicted command path and compact loadout events. Protocol version 12 distinguishes clients with the new commands. Replayed pickup/equip actions cannot duplicate a collected item. No item definitions enter the wire payload.

`previewInventoryEquip` shares validation between presentation and committed execution. Changing gear preserves current limb-health ratios and lost parts; collecting loot and equipping abilities do not rescale health.

## Presentation

The loot grid and character slots allocate separate icon and text columns, retain readable text sizes, wrap names, and use rarity frames. The slot inspector remains within the character sheet on narrow screens. `artifacts/reward-fitting-preview.html` now demonstrates pickup, persistence and slot-based equipment using production co-op commands in an isolated, unsaved workshop.
