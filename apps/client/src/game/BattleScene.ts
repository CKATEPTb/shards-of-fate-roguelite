import Phaser from "phaser";
import type { CombatState, Combatant } from "@shards/shared";
import { BODY_PARTS } from "@shards/shared";
import { isBodyAlive } from "@shards/game-core";
import { findDefinition } from "../catalog";
import { createUnitSprite, setUnitAnimation, updateUnitBody, type UnitFacing } from "./unitAnimation";
import { battleMotion } from "./battleMotion";
import { BATTLE_CAMPFIRE, drawLandscape } from "./landscape";
import { createCampfires } from "../world/campfires";
import { battleLayout, type BattlePlacement } from "./battleLayout";

type UnitView = {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  bar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  marker: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  scale: number;
  facing: UnitFacing;
  dead: boolean;
  tintTimer?: Phaser.Time.TimerEvent;
};
export class BattleScene extends Phaser.Scene {
  private combat?: CombatState;
  private views = new Map<string, UnitView>();
  private signature = "";
  private lastSequence = -1;
  private selected = "";
  private reduced = false;
  private ready = false;
  private motes?: Phaser.GameObjects.Graphics;
  private campfires?: ReturnType<typeof createCampfires>;
  private feedback = new Set<Phaser.GameObjects.Text>();

  constructor() {
    super("battle");
  }

  create() {
    this.motes = drawLandscape(this);
    this.campfires = createCampfires(this, [BATTLE_CAMPFIRE]);
    this.motes.setVisible(!this.reduced);
    this.ready = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ready = false;
      this.views.clear();
      this.feedback.clear();
      this.campfires?.destroy();
    });
    if (this.combat) this.renderCombat(this.combat, true);
  }

  update(_time: number, delta: number) {
    this.campfires?.update(Math.min(delta, 150), this.reduced);
  }

  showCombat(state: CombatState, selected: string, reduced: boolean) {
    const reductionChanged = this.reduced !== reduced;
    this.reduced = reduced;
    this.selected = selected;
    if (reductionChanged && this.ready) {
      this.clearFeedback();
      this.views.forEach((view) => setUnitAnimation(view.sprite, view.dead ? 'death' : 'idle', view.facing, reduced || view.dead, true));
    }
    if (this.motes) this.motes.setVisible(!reduced);
    this.combat = state;
    if (this.ready) this.renderCombat(state);
  }

  private renderCombat(state: CombatState, initial = false) {
    const signature = JSON.stringify([state.seed, state.encounterId, state.characterIds, state.enemyIds]);
    const reset =
      initial ||
      signature !== this.signature ||
      state.nextSequence < this.lastSequence;
    if (reset || this.views.size !== state.units.length) {
      this.clearFeedback();
      this.views.forEach((view) => view.container.destroy());
      this.views.clear();
      const counts = { heroes: 0, enemies: 0 };
      const totals = {
        heroes: state.units.filter((unit) => unit.team === "heroes").length,
        enemies: state.units.filter((unit) => unit.team === "enemies").length,
      };
      const placements = {
        heroes: battleLayout('heroes', totals.heroes),
        enemies: battleLayout('enemies', totals.enemies),
      };
      for (const unit of state.units) {
        const i = counts[unit.team]++;
        this.views.set(unit.id, this.createUnit(unit, placements[unit.team][i]));
      }
      this.signature = signature;
    }
    for (const unit of state.units) {
      const view = this.views.get(unit.id)!;
      const definition = findDefinition(unit.definitionId);
      updateUnitBody(view.sprite, unit.body);
      const alive = unit.body ? isBodyAlive(unit.body) : unit.hp > 0;
      view.container.setAlpha(alive ? 1 : 0.55);
      view.bar.clear();
      if (unit.team === 'enemies') {
        view.bar.fillStyle(0x0b1914).fillRect(-30, 10, 60, 7);
        view.bar.fillStyle(0xc67a64).fillRect(-29, 11, 58 * Math.max(0, unit.hp / unit.stats.maxHp), 5);
      } else if (unit.body) {
        BODY_PARTS.forEach((part, index) => {
          const health = unit.body![part];
          const ratio = Math.max(0, Math.min(1, health.current / health.max));
          const x = -30 + index * 10;
          view.bar.fillStyle(ratio > 0 ? 0x0b1914 : 0x753d3b).fillRect(x, 10, 9, 7);
          if (ratio > 0) view.bar.fillStyle(ratio < 0.4 ? 0xc67a64 : 0xa6b578).fillRect(x + 1, 11, 7 * ratio, 5);
        });
      }
      if (unit.shield > 0)
        view.bar
          .fillStyle(0x93c5c8)
          .fillRect(
            -29,
            18,
            Math.min(58, (unit.shield / unit.stats.maxHp) * 58),
            2,
          );
      view.marker.clear();
      if (this.selected === unit.id || this.selected === definition.id) {
        view.marker.lineStyle(1.5, 0xdaca91, 0.75).strokeEllipse(0, 0, 74, 22);
        const top = -26 * view.scale;
        view.marker.fillStyle(0xe0d09c).fillTriangle(-4, top - 6, 4, top - 6, 0, top);
      }
    }
    if (!reset) this.animateEvents(state);
    this.lastSequence = state.nextSequence;
  }

  private createUnit(unit: Combatant, placement: BattlePlacement): UnitView {
    const { x, y, scale, labelWidth, fontSize } = placement;
    const definition = findDefinition(unit.definitionId);
    const shadow = this.add.ellipse(0, 0, 47, 12, 0x08160e, 0.4);
    const contact = this.add.ellipse(0, 0, 29, 5, 0x07140d, 0.55);
    const marker = this.add.graphics();
    const facing: UnitFacing = unit.team === 'enemies' ? 'west' : 'east';
    const dead = unit.body ? !isBodyAlive(unit.body) : unit.hp <= 0;
    const sprite = createUnitSprite(this, definition, unit.team === 'enemies', 0, 0, unit.body).setScale(scale);
    setUnitAnimation(sprite, dead ? 'death' : 'idle', facing, this.reduced || dead);
    const bar = this.add.graphics();
    const label = this.add
      .text(0, 28, unit.name, {
        fontFamily: "Georgia, serif",
        fontSize: `${fontSize}px`,
        color: "#d4d8bb",
        stroke: "#17271d",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    let name = unit.name;
    while (label.width > labelWidth && name.length > 1) {
      name = name.slice(0, -1);
      label.setText(`${name}…`);
    }
    const container = this.add
      .container(x, y, [shadow, contact, marker, sprite, bar, label])
      .setDepth(y);
    return { container, sprite, bar, marker, label, x, y, scale, facing, dead };
  }

  private animateEvents(state: CombatState) {
    const fresh = state.events.filter(
      (event) => event.sequence >= this.lastSequence,
    );
    for (const unit of state.units) {
      const view = this.views.get(unit.id);
      if (!view || view.dead) continue;
      const motion = unit.body && !isBodyAlive(unit.body) ? 'death' : battleMotion(unit, fresh);
      if (!motion) continue;
      this.tweens.killTweensOf(view.sprite);
      view.sprite.setX(0).clearTint();
      view.tintTimer?.remove();
      setUnitAnimation(view.sprite, motion, view.facing, this.reduced, true);
      view.dead = motion === 'death';
      if (this.reduced || view.dead) continue;
      if (motion === 'attack') {
        this.tweens.add({ targets: view.sprite, x: view.facing === 'west' ? -12 : 12, duration: 150, yoyo: true, ease: 'Sine.InOut' });
      } else if (motion === 'hit') {
        view.sprite.setTint(0xffceb1);
        view.tintTimer = this.time.delayedCall(130, () => view.sprite.clearTint());
      }
    }
    fresh
      .filter((event) =>
        ["DAMAGE", "HEALED", "MISS", "SHIELD_CREATED"].includes(event.type),
      )
      .slice(-8)
      .forEach((event, index) => {
        if (!event.targetId) return;
        const view = this.views.get(event.targetId);
        if (!view) return;
        const heal = event.type === "HEALED",
          shield = event.type === "SHIELD_CREATED";
        const value =
          event.type === "MISS"
            ? "Мимо"
            : `${heal || shield ? "+" : "−"}${event.amount ?? 0}`;
        const text = this.add
          .text(
            view.x + (index % 2) * 24 - 12,
            view.y - 29 * view.scale - index * 8,
            value,
            {
              fontFamily: "Georgia, serif",
              fontSize: "22px",
              color: heal ? "#c7dc9a" : shield ? "#a7d9dc" : "#f0bf9a",
              stroke: "#13271c",
              strokeThickness: 4,
            },
          )
          .setOrigin(0.5)
          .setDepth(1100);
        this.feedback.add(text);
        const remove = () => {
          this.feedback.delete(text);
          text.destroy();
        };
        if (this.reduced) this.time.delayedCall(350, remove);
        else
          this.tweens.add({
            targets: text,
            y: text.y - 24,
            alpha: 0,
            delay: 240,
            duration: 500,
            onComplete: remove,
          });
      });
  }

  private clearFeedback() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.feedback.forEach((text) => text.destroy());
    this.feedback.clear();
    this.views.forEach((view) => {
      view.sprite.setX(0).clearTint();
      view.tintTimer = undefined;
    });
  }
}
