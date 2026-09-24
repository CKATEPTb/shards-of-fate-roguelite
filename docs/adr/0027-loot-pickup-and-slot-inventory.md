# 0027 — Loot pickup and inventory by equipment slot

## Decision

Loot is collected separately from equipping it. The reward dialog lists pending finds; one click moves a find to the hero's persistent inventory. Pickup does not alter attributes or equipment. There is no standalone inventory window or bag button.

The character sheet is the equipment entry point. Clicking an equipment slot opens its current item and inventory candidates for that slot. The first click on a candidate displays its description, the current item, and attribute/armor/durability differences. Clicking the same candidate again equips it immediately. Switching candidates or slots never equips anything. The two learned ability slots use the same interaction.

Displaced equipment and learned abilities return to the same hero's hidden inventory. This supersedes the previous destruction rule. Equipping a two-handed weapon returns both displaced hand items; replacing a two-handed weapon returns it once and frees the other hand. Each displaced ring is returned separately, even when both slots contain the same item definition. Other inventory entries remain available. Lost limbs and duplicate equipped skills follow core validation.

Closing the loot dialog with uncollected finds asks for confirmation before discarding only those pending rewards. Collected inventory is unaffected. Empty loot closes directly. Coins remain an automatic reward and a noninteractive HUD counter; only pending loot exposes an opening button.

## State and synchronization

`HeroProgress.inventory` stores collected and returned finds using the existing reward record shape. Old saves normalize a missing inventory to an empty array. `collect-reward` and `equip-inventory` commands run through the existing local/host/predicted command path and compact loadout events. Protocol version 14 prevents clients with the previous destruction behavior from deriving a different inventory from the same command. No new command fields or item definitions enter the wire payload.

Returned finds preserve their catalogue rarity, use `loadout:<previous slot>` as their source and have no new luck rolls. Their short deterministic IDs include the hero's ID and skip every active reward/inventory ID and every consumed ID recorded in the run. Swaps by another hero therefore do not alter the local prediction's returned IDs. Repeated swapping never reuses a consumed command ID; equal item definitions in separate slots remain separate instances. Pickup/equip replay cannot duplicate them. The legacy direct-equip, direct-learn and reward-confirmation paths apply the same return rule. Closing pending loot never discards returned inventory entries.

`previewInventoryEquip` shares validation between presentation and committed execution. Changing gear preserves current limb-health ratios and lost parts; collecting loot and equipping abilities do not rescale health.

## Balance impact

Keeping displaced items and learned skills increases future equipment choices and changes campaign balance. Existing simulation reports remain historical results for their recorded rules; this change has not been recalibrated by those reports.

## Presentation

The character sheet has a viewport-sized overview: equipment icons, body condition, nonzero attributes and all five ability slots. The abilities remain in a fixed bottom row. Tapping an equipment or ability slot replaces the overview with its inspector in the same window; Back or Escape restores the overview. No page scrolling is needed to reach abilities. Long item descriptions may scroll inside their own reading area, while the item carousel, attribute changes and abilities remain visible.

The inspector shows the equipped item first, followed by a horizontal, rarity-framed strip of compatible inventory entries. Bag entries are sorted legendary → epic → rare → common, then newest arrival first within each rarity. The saved inventory remains in chronological arrival order; presentation sorts a copy, so ordering survives reloads without wall-clock timestamps. Returned equipment counts as a new arrival in the bag. Selecting a candidate keeps current and proposed item descriptions visible together, with attribute, armor and maximum limb-durability changes above them. Repeated selection equips it; the displaced item then appears in the same strip as an inventory entry. Empty equipment cells are dimmed. Body details and effect explanations open in the same contextual reading area.

Set synergies are shown only inside descriptions of items from that set. Their 2/4/6 thresholds distinguish active, inactive, gained and lost bonuses; icons and names identify other equipped contributing pieces. Duplicates and inactive equipment follow the same counting rules as combat. There is no separate set-bonus list in the overview.

`artifacts/reward-fitting-preview.html` demonstrates pickup, persistence and slot-based equipment using production co-op commands in an isolated, unsaved workshop.
