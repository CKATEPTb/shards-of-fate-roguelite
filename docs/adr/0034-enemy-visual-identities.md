# 0034 — Enemy silhouettes and boss scale

## Decision

Enemy art resolves the definition ID before its legacy sprite alias. The 500 act-one definitions receive deterministic visual profiles from their family, role slot, tier and individual catalogue index. Twenty-two anatomical forms cover armed raiders, armored guardians, undead, vegetation, aquatic creatures, vermin and beasts. The 50 seasonal bosses have an explicit mapping to fourteen boss forms, with identity-specific details. A boss formerly using the `boar` sprite alias now draws its authored titan or behemoth form.

Profiles live in the client art layer. They do not consume dice, alter encounter pools, change combat rules or add snapshot/network fields. Old IDs and their gameplay content remain valid. Custom definitions without a known profile retain a supported legacy sprite fallback.

Enemy frames use 64 × 64 pixels with ground contact at y=56 and a base display scale of 0.5. Boss profiles request a larger world size. Battle formations reserve space for the larger body, and the same placements drive Phaser rendering and DOM targeting. Shadows, ground markers, sockets and portraits follow the new frame geometry. Texture atlases are still built on demand and released through the existing bounded lifetime manager; the whole catalogue is never pre-rendered into gameplay textures.

## Presentation

Different silhouettes and materials carry the visual variety: body proportions, anatomy, equipment, armor plates, teeth, branches, shells, seasonal growth and ornaments. Color changes complement these details. Bosses have broad bodies, large limbs or wings and individual crowns, ribs, horns or other identity motifs. Their rendering is separate from ordinary creature drawings.

`artifacts/enemy-art-preview.html` shows the actual frame generator, including a hero alongside each selected creature for scale comparison. It offers season and name filters, the complete mob/boss catalogue, four facings and animation selection. Its small paginated gallery renders only the current page; its frame cache is bounded. Previewing never changes a saved expedition.
