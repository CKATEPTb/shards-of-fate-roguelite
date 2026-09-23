# ADR 0011 — Skeletal poses baked into pixel hero frames

Status: implemented at the user's request, 2026-09-23.

## Direction and shared surfaces

All nine heroes use a dark fantasy palette and adult body proportions. Their
source frame is 64 × 64 pixels with a foot baseline at y = 56. Enemies retain
their 32 × 32 frames and y = 28 baseline. `unitFrameMetrics(enemy)` supplies
these dimensions and the display scale: 0.5 for heroes and 1 for enemies. The
higher source resolution adds detail without changing world tile size or UI
layout.

The revised silhouettes emphasize solid, connected forms: broader shoulders and
hips, filled tapered limbs, substantial boots and layered collars. Light and
shadow occupy contiguous color planes rather than thin stripes along bones.
The head remains readable against the collar; armor, fabric and skin retain
distinct values. The user-supplied pixel archer reference guides this treatment
while each hero starts with a coherent equipment set and dark fantasy palette. Relaxed hands
sit closer to the body, and heavy heroes use a shorter walking stride.

`unitFramePixels` is the common source for exploration, combat, portraits and
the campfire picker. Hero equipment is resolved from the actual unit definition
before rendering, so an empty starting equipment slot does not acquire a
decorative item merely because the class has a matching sprite.

The picker bakes four idle frames into a single SVG image and moves between
them with its existing CSS animation. Atlas dimensions come from frame metrics.
Portraits use the same south-facing idle pose. Hero pixels retain their scaled
eight-pixel vertical offset, while the view box starts at y = -8 and includes
the full 64-pixel source height so antlers and headgear stay visible. Enemies
keep their previous framing, and the surrounding HUD layout stays fixed.
Optional `body` and `equipment` props let a portrait show current injuries and
appearance.

## Pose and equipment

Hero poses are calculated from a body skeleton with articulated limbs. Clothing
and carried items attach to the corresponding body and hand sockets; their
positions follow the pose rather than remaining fixed on the source image.
Idle, walking, attacking, casting, dodging, weapon block, shield block, hit and
death clips are rasterized into pixel frames. Right-hand attack (`attack`),
left-hand attack (`attackLeft`) and cast have nine frames each;
the three defensive motions have seven. `UnitPose.progress` normalizes a clip
to 0–1, and authored key poses are interpolated before final pixel rounding.
Weapon tracks use eased preparation, contact/release and recovery beats, so
adding in-between frames does not change which hand owns an item or detach a
supporting hand. The running scene plays those cached frames; it does not
rebuild a skeleton or generate pixels for every display frame.

Paired offensive weapons attack in sequence: the right-hand weapon completes its
strike, then the left-hand weapon completes its own. Each clip moves only its
active weapon; the other weapon follows a light guard pose. Combat events carry
both anatomical `attackHand` and equipment `attackSlot`. Playback selects
`attackLeft` for `leftHand` and `attack` for `rightHand`, including a two-handed
weapon equipped in either slot. Shields do not produce offensive clips; a
two-handed weapon produces one strike from its equipped slot. The
preview composes the two clips instead of baking a duplicate combined clip into
every unit atlas.

`EQUIPMENT_ITEMS` is an independent catalog of 62 named items: 45 armor pieces
across nine sets and 17 weapons and shields. `EQUIPMENT_SETS` groups matching
armor by item ID, while `STARTER_ANATOMY` assembles each hero's initial equipment
from those ordinary catalog entries. Item identity (`id`), appearance family
(`appearanceId`) and weapon type (`weapon.kind`) are separate. For example,
`steel-sword` is a named sword with the `iron-vanguard` appearance family;
`forged-steel-dagger` is a named dagger with the `night-stalker` appearance.
Neither item belongs to a character class.

`HeroVisualLoadout` is a cosmetic slot map using the same catalog item IDs.
Supported drawn slots are head, chest, gloves, pants, boots, `rightHand` and
`leftHand`. Both hand slots accept the same weapons and shields. A two-handed
item occupies its selected slot and reserves the opposite hand, which must
already be free; equipping it never silently removes an item from that hand.
`equipItem` derives an equipped item's anatomical requirements from its selected
slot, and `canEquipInSlot` checks hand occupancy. An explicit `null`
removes a visual item; an omitted override falls back to that unit's actual
starting equipment. Amulet and ring slots are represented in the map but have
no registered visual items yet.

`heroWeapons.ts` defines thirteen visual weapon families through `HERO_WEAPONS`.
Each family supplies a readable type name, required hand count and default
appearance. Catalog entries add the item's own name and appearance family.
For example, `pilgrim-staff` (Посох тихого света) uses the two-handed staff
family; `ember-wand` (Жезл тлеющей искры) uses the one-handed wand family.
Every family has at least one named item in the catalog.

Weapon families are shared with game data through `WeaponKind`. Starting
equipment can carry `weapon: { kind, hands, damage }` metadata; `damage` is an
optional dice expression and shields have no offensive damage roll. Game-core
uses that metadata for real per-slot basic attacks, with a separate weapon
damage roll and damage resolution for each strike. The visual catalog supplies
appearance and pose tracks. Cosmetic overrides and the preview do not equip
gameplay items, consume dice or alter inventory and saved runs.

## Weapon contacts and rendering order

| Family | Hands | Contact and action |
| --- | --- | --- |
| Bow (`bow`) | 2 | Equipped hand holds the bow; the opposite hand draws and releases the string. |
| Staff (`staff`) | 2 | Equipped hand holds the shaft; the opposite hand supports it eight source pixels above the grip. |
| Dagger (`dagger`) | 1 | Compact preparation followed by a forward thrust. |
| Sword (`sword`) | 1 | Raised preparation and a sweeping cut. |
| Greatsword (`greatsword`) | 2 | Separated grips on one hilt and a heavier cutting arc. |
| Mace (`mace`) | 1 | Lift and downward strike with the weapon head. |
| Great mace (`greatmace`) | 2 | A second lower grip supports the heavy strike. |
| Hammer (`hammer`) | 1 | High preparation and a head-led downward strike. |
| Great hammer (`greathammer`) | 2 | Both hands follow one shaft through the heavy strike. |
| Shield (`shield`) | 1 | Either hand raises the shield in front of the body for a block. |
| Sickle (`sickle`) | 1 | Curved cutting motion with a hooked follow-through. |
| Scythe (`scythe`) | 2 | Long shaft with separated grips and a broad sweeping cut. |
| Wand (`wand`) | 1 | Raised casting pose followed by pointing the wand outward. |

Each held weapon exposes its own `HeroWeaponPose` as `rightHandWeapon` or
`leftHandWeapon` on the rig. Two-handed weapons use one shared transform
for the prop and both contacts. The equipped slot determines which anatomical
hand holds a bow and which draws its string toward the face. The starting
archer holds the bow in the left hand, but the same item can be equipped in
the right hand. A staff's opposite hand follows local `(0, -8)` on the shaft.
Greatswords, great maces and great hammers place the supporting hand at local
`(0, 6)` below the holding grip; a scythe uses `(0, 8)`. `widthScale` and
`lengthScale` project the weapon's local x and y axes before rotation. The same
transform drives painted geometry, contact targets and frame containment, so
foreshortening never leaves a supporting hand at an unprojected position.
The scythe's front/rear hook projection reflects both local blade geometry and
its angular sweep. Reflecting only its geometry reverses the broad inner
cutting edge relative to motion and makes the spine lead. The shared transform
also drives both shaft contacts throughout this reflected sweep.
Weapon families have separate ready stances. In profile, short blades and
wands point forward from a bent elbow, swords use a diagonal guard, and long
two-handed weapons tilt forward with both contacts still on the shaft. Paired
weapons stagger their wrists in height and reach. Front-facing one-handed
weapons incline inward over the chest from their anatomical hand; the same
positive authored angle is mirrored for the left hand. Short weapons retain
foreshortening toward the viewer. Sword and sickle grips move inward as well,
so the forearm, fist and handle agree instead of only rotating the artwork.
Ready offsets ease out during the windup and back in during recovery. Daggers,
swords, sickles and wands have front-facing action angles that return to the
same inward guard without an extra wrist revolution. The sword also authors
its wrist travel; the sickle reaches, then draws inward and down through a
positive cutting sweep. Its straight handle crosses the palm, while its bright
cutting edge follows the concave hook and its convex spine stays muted. A block
eases into its existing absolute guard, including an inactive paired weapon's
light guard. Side/rear projections and the scythe reflection remain separate.
North-facing one-handed grips move inward and forward behind the back. Daggers,
sickles and wands also shorten along their local length in this rear projection.
The prop origin is the holding hand; the bow nock is the drawing hand's position.
Those targets drive the two-bone arm IK, so the joints, weapon and bow string
agree throughout the draw, release and recovery. The prop is drawn once from
its shared transform; it is not duplicated for each hand. A missing arm makes
a two-handed weapon unavailable; missing anatomy is never drawn to satisfy a
contact. Crawling disables the two-handed grip and bow release. A one-handed
weapon remains assigned to its equipped arm, and losing that arm never moves
the weapon automatically into the other hand. For paired offensive weapons,
losing the right arm leaves only the left-hand weapon and its strike.

Arms and wrists are drawn separately from fingers. Each prop is drawn once in
its holding arm's pass. In profile, the far arm, its prop and fingers precede
the torso and head; the near arm and its attachment follow them. If the near
hand holds a shared weapon, the far supporting fingers are restored over that
prop only outside the body's silhouette. This keeps the shared contact visible
without drawing the far hand through the torso. In the south view both arm and
prop passes follow the body, with fingers drawn last. In the north view they
precede the cloak, torso and head, which naturally hide forward-pointing blades.
One-handed weapons use the same compositor with separate wrist transforms.
The visible face of a shield covers its gripping fist; rear and far views can
show the hand on its strap. Blades remain beneath their gripping fingers.

Hand attachments are catalog weapons or shields. The previous decorative
symbols, spellbook, talisman, seeds, bone focus and quiver have been removed
from both starting equipment and rendering. There is no fallback belt or chest
stowing for a hand item displaced by a two-handed grip.

## Anatomy and motion

The current `HeroBody` determines which body parts are present. Attachments on
a missing part disappear with that part. Injury bands distinguish healthy,
injured and severely injured legs without generating a new atlas for each HP
value. Leg injuries affect the pose; a hero missing both legs uses a low torso
and reaching arms to crawl. Simulation movement speed and combat rules remain
owned by game-core.

Walking has twelve cyclic frames at a default preview rate of 24 fps, making
one left/right stride last half a second in the standalone clip. Exploration
instead selects a frame from the distance actually travelled by the rendered
actor. `ActorView.walkDistance` accumulates `advanceMotion`'s interpolated path
length, and `setUnitWalkDistance` maps it onto `UNIT_CLIPS.walk.frames` while
pausing Phaser's independent animation clock. A full stride spans 20 logical
pixels times the displayed unit scale: approximately 33 world pixels at the
normal hero scale, or one tile. Larger enemies have proportionally longer
strides. Camera zoom does not affect this relationship.

Terrain speed changes and turns preserve the accumulated phase. A queued path
without actual movement uses idle rather than stepping in place; stopping does
the same. Pausing freezes both movement and its frame. Immediate resynchronizing,
teleporting and death reset the accumulated distance, so restored positions do
not generate phantom steps. Reduced motion uses the static idle pose while
movement continues. This playback changes neither simulation speed nor network
messages.

Left and right refer to anatomical sides, including a west-facing pose. Any
reflection used while drawing must also preserve the ownership of limb sockets
and equipment, so a lost left arm never reappears as a lost right arm when the
hero turns.

| View | Anatomical right shoulder | Anatomical left shoulder | Depth order |
| --- | --- | --- | --- |
| South | Screen-left | Screen-right | Arms and held props in front of the body. |
| North | Screen-right | Screen-left | Arms and held props behind the back. |
| East | Screen-left, near | Screen-right, far | Right arm in front; left arm behind. |
| West | Screen-right, far | Screen-left, near | Left arm in front; right arm behind. |

Profile joints use a canonical east projection: anatomical right has the
negative x offset and left the positive offset. West reflects the completed
pose once. Near/far ownership selects depth and the slight shoulder/hand y
offset, rather than reversing anatomical x offsets before that reflection.
Weapon grip ownership survives the same reflection as its arm.

Side-facing heads use `heroHeadProfile.ts`: the face and its headgear share one
canonical east projection, reflected locally once for west and rotated by the
head bone. The frontal hood rim and helmet overlays never run for a profile.
Hoods have a closed nape and one forward opening; the `night-stalker` hood's
mask and `ivory-pilgrim` side cloth follow that opening. Helmets use a projected
brow and one visible cheek guard, with `dawn-forged` trim at the forward edge.
The `wildwood` antlers overlap in
depth, with the far branch behind the head. Face, hair and beard colors come
from the hero; headgear shape and materials come from the equipped item.
Removing the item exposes the profile hair, and an absent head draws neither.
The profile skull uses a level stepped crown, a distinct nape, a short nose
and a flat chin with a jaw corner above the neck. Hood and helmet crowns
follow this compact volume. Bare front/rear heads keep a centered silhouette;
hair is a solid material mass with small dark strands, without skin-coloured
highlights that would read as exposed scalp. East and west share the same
contour through the single reflection above.
Profile eyes and brows use filled pixel cells on the face's polygon grid.
This keeps the eye inset from the outline in both directions; reflecting an
independently rounded point used to leave the east eye on the dark edge.

Both boots share the equipped footwear's material palette for the shaft, toe
and sole, including the same highlight treatment. Near/far depth determines
their drawing order and occlusion; it does not replace leather with a clothing
shadow color or give the pair different materials.

Dodging moves the upper body away from the threat while the arms keep their
weapon contacts. Weapon block brings the weapon across the body; shield block
raises and presents the shield, with the other hand contributing less to that
motion. These are distinct authored poses rather than renamed hit frames.
The combat presentation uses dodge for an explicit accuracy miss. Weapon block
and shield block remain available visual clips until game-core exposes the
corresponding physical defensive outcomes. Magical shield creation is not
treated as a physical shield-block event.

## Cache and lifetime

Animated atlas identity includes the hero art, visible anatomy and resolved
equipment. An unchanged appearance reuses its atlas, and a change preserves the
current animation state while selecting the new variant. Atlas lifetime follows
live sprite usage so obsolete injury/equipment variants can be released.
Atlas revision `v19` includes the twelve-frame cyclic walk, separate anatomical hand strike frames, projected
side-facing headgear, matching material palettes for paired footwear and
family-specific weapon ready stances, the reshaped skull and hair contours,
plus inward frontal grips, the sickle's hooked cut and aligned profile eyes.
It also separates catalog item identity from appearance and supports either
hand as the owner of each one- or two-handed weapon.

The campfire images are generated once for the static roster. Portrait pixel
arrays use a bounded 64-entry LRU cache keyed by sprite, role, visible anatomy
and visual equipment. Ordinary HUD updates therefore reuse the existing art.
Frame generation has no DOM, wall clock or random input, and appearance remains
consistent across the lobby, HUD and game scenes.

## Effects and extension points

`getHeroRig` exposes parent-relative bones and `ground`, `chest`, `head`,
`rightHand` and `leftHand` sockets. Absent body parts have no corresponding socket. Hand rotations
are clockwise radians from upright; weapon family selects its grip, strike,
casting and defensive tracks. `getUnitSocket` converts the current baked frame's
socket into the sprite's parent coordinates and caches the pose between frames.

`updateUnitAppearance(sprite, { body, equipment })` replaces a complete cosmetic
render state. `updateUnitBody` retains existing cosmetic overrides. For example,
`equipment: { head: null, rightHand: 'oath-hammer', leftHand: null }` removes
the headgear, frees the left hand and equips the hammer in the right hand
visually, leaving other slots at their starting defaults.

Combat attaches two reusable effect layers to the existing unit container.
Casting and healing use hand/chest sockets; shields, burning and poison use
body/ground sockets. Effects redraw at most 20 times per second, retain at most
12 transient motes per unit, respect reduced motion, and release their resources
on death or scene teardown. Their local visual clocks do not consume room dice
or produce network events.
Weapon-local magic uses the active prop's pose, so a guarding wand does not
emit the other hand's strike effects.

The development-only artifact `artifacts/hero-rig-preview.html` can be opened
through Vite's workspace file serving. It provides the nine heroes, motion
controls, the named item catalog spanning thirteen weapon families, injury poses and a skeleton overlay
without modifying gameplay state or saves. Four views show the same animation
frame simultaneously; selecting one enlarges it without restarting playback.
Both anatomical hand selectors offer the same items. A two-handed option is
disabled while the opposite hand holds an item; once equipped, it locks that
opposite selector until removed. Armor has five independent selectors and a
set picker, and the reset button restores the selected hero's starter loadout.
Play/pause, playback speed and a frame slider support close inspection. The
slider's maximum and frame count come from `UNIT_CLIPS`. For two equipped and
usable one-handed offensive weapons, the attack control plays an 18-frame
sequence: nine right-hand frames followed by nine left-hand frames. The frame
label identifies the current hand; the slider can inspect either strike.
Changing equipment or injuries recalculates that sequence, including a single
left-hand strike when only that weapon remains usable. The preview starts
paused for reduced-motion users and caches at most 96 rendered frames
for its current appearance, keeping repeated playback inexpensive. On narrow
screens the four views remain a single compact strip beneath the main sprite.
