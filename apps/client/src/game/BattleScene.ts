import Phaser from "phaser";
import type { CombatEvent, CombatState, Combatant, GameContent } from "@shards/shared";
import { baseSkillId, BODY_PARTS } from "@shards/shared";
import { bodyCombatHealth, isBodyAlive } from "@shards/game-core";
import { findDefinition, gameContent } from "../catalog";
import { createUnitSprite, getUnitSocket, setUnitAnimation, setUnitScale, unitBlockMotion, unitCastingHand, updateUnitDefinition, type UnitFacing } from "./unitAnimation";
import { UnitEffects } from "./unitEffects";
import { SkillProjectiles } from './skillProjectiles';
import { DicePresentation } from './dicePresentation';
import { battleProjectileKind, projectileTargets } from './battleProjectiles';
import { battleMotion } from "./battleMotion";
import { drawLandscape, type BattleLandscape } from "./landscape";
import type { BattleEnvironment } from './battleEnvironment';
import { battleRosterLayout, battleUnitGeometry, readBattleInsets, type BattlePlacement, type BattleStage } from "./battleLayout";
import { applyPresentedEvent, battleBeats, type BattleBeat } from './battlePlayback';
import { UNIT_MOTIONS, type UnitMotion } from '../art/unitPose';
import { isInitiativeRoll, type InitiativePresentation } from './initiativePresentation';
import { equipmentAurasFor } from './equipmentAuras';
import { playBattleAction, playBattleDice, playBattleImpact } from '../audio/battleAudio';

interface PresentationBatch { state: CombatState; beats: BattleBeat[]; index: number }

type UnitView = {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  effects: UnitEffects;
  bar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  marker: Phaser.GameObjects.Graphics;
  shadow: Phaser.GameObjects.Ellipse;
  contact: Phaser.GameObjects.Ellipse;
  x: number;
  y: number;
  scale: number;
  footprint: number;
  growth: number;
  targetGrowth: number;
  facing: UnitFacing;
  dead: boolean;
  tintTimer?: Phaser.Time.TimerEvent;
};
export class BattleScene extends Phaser.Scene {
  private content: GameContent = gameContent;
  private combat?: CombatState;
  private views = new Map<string, UnitView>();
  private signature = "";
  private queuedRoster = '';
  private presentedInitiative: Record<string, number> = {};
  private presentedTurnOrder: string[] = [];
  private presentedTurnIndex = 0;
  private presentedRound = 0;
  private presentedTurn = 0;
  private initiativeSeries = false;
  private initiativeBaseOrder: string[] = [];
  private initiativeTies = new Map<string, number[]>();
  private initiativeClock?: InitiativePresentation;
  private initiativeFrame = -1;
  private onInitiative?: (presentation: InitiativePresentation | undefined) => void;
  private lastSequence = -1;
  private selected = "";
  private reduced = false;
  private ready = false;
  private landscape?: BattleLandscape;
  private environment?: BattleEnvironment;
  private environmentKey = '';
  private landscapeSeed = '';
  private landscapeSize = '';
  private stageInsets: Pick<BattleStage, 'insetTop' | 'insetBottom'> = {};
  private projectiles?: SkillProjectiles;
  private feedback = new Set<Phaser.GameObjects.Text>();
  private dice?: DicePresentation;
  private presented = new Map<string, Combatant>();
  private batches: PresentationBatch[] = [];
  private playing = false;
  private speed = 1;
  private onPresented?: (state: CombatState) => void;

  constructor() {
    super("battle");
  }

  create() {
    this.stageInsets = readBattleInsets(this.game.canvas.parentElement);
    this.rebuildLandscape();
    this.projectiles = new SkillProjectiles(this);
    this.dice = new DicePresentation(this, actorId => {
      const view = this.views.get(actorId);
      const unit = this.presented.get(actorId);
      return view && unit ? { x: view.x, y: Math.max(18, view.y - 30 * view.scale * view.growth), name: unit.name, team: unit.team } : undefined;
    });
    this.ready = true;
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeStage, this);
    this.time.timeScale = this.speed;
    this.tweens.timeScale = this.speed;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ready = false;
      this.clearFeedback();
      this.views.forEach(view => view.effects.destroy());
      this.views.clear();
      this.feedback.clear();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeStage, this);
      this.landscape?.destroy();
      this.projectiles?.destroy();
      this.dice?.destroy();
    });
    if (this.combat) this.renderCombat(this.combat, true);
  }

  update(_time: number, delta: number) {
    this.landscape?.update(Math.min(delta, 150), this.reduced);
    const elapsed = Math.min(delta, 100) * this.speed;
    this.views.forEach((view, id) => {
      if (Math.abs(view.growth - view.targetGrowth) > 0.001) {
        view.growth = this.reduced ? view.targetGrowth : view.growth + (view.targetGrowth - view.growth) * (1 - Math.exp(-elapsed / 160));
        setUnitScale(view.sprite, view.scale * view.growth);
        view.shadow.setScale(view.growth * view.footprint, view.footprint);
        view.contact.setScale(view.growth * view.footprint, view.footprint);
        const unit = this.presented.get(id);
        if (unit) this.drawMarker(view, unit);
      }
      view.effects.update(elapsed, this.reduced);
    });
    this.projectiles?.update(delta * this.speed, this.reduced);
    // Dice phases share the action clock, including slow frames. Decorative
    // effects may clamp delta; a result must settle before its scheduled hit.
    this.dice?.update(delta * this.speed, this.reduced);
    if (this.initiativeClock && !this.initiativeClock.finished) {
      this.initiativeClock.elapsed = Math.min(this.initiativeClock.duration, this.initiativeClock.elapsed + Math.max(0, delta) * this.speed);
      const frame = Math.floor(this.initiativeClock.elapsed / 40);
      if (frame !== this.initiativeFrame) {
        this.initiativeFrame = frame;
        this.onInitiative?.({ ...this.initiativeClock });
      }
    }
  }

  showEnvironment(environment?: BattleEnvironment): void {
    const key = environment ? JSON.stringify([environment.seed, environment.chunk.id, environment.chunk.season,
      environment.chunk.layer, environment.litCampfireIds, environment.focus]) : '';
    this.environment = environment;
    if (key === this.environmentKey) return;
    this.environmentKey = key;
    if (this.ready) this.rebuildLandscape();
  }

  showContent(content: GameContent): void {
    if (this.content === content) return;
    this.content = content;
    if (this.ready) this.renderUnits();
  }

  private stage(): BattleStage { return { width: this.scale.width, height: this.scale.height, ...this.stageInsets }; }

  private facing(team: Combatant['team']): UnitFacing {
    const { width, height } = this.stage();
    return width < 640 && height > width * 0.8 ? team === 'heroes' ? 'north' : 'south'
      : team === 'heroes' ? 'east' : 'west';
  }

  private rebuildLandscape(): void {
    this.landscape?.destroy();
    this.landscapeSeed = this.combat?.seed ?? 'battle';
    this.landscapeSize = `${this.scale.width}:${this.scale.height}`;
    this.landscape = drawLandscape(this, this.environment, this.landscapeSeed);
  }

  /** Resize the existing presentation. No snapshots, dice timers or action beats are discarded. */
  private resizeStage(): void {
    this.stageInsets = readBattleInsets(this.game.canvas.parentElement);
    if (!this.ready) return;
    if (this.landscapeSize !== `${this.scale.width}:${this.scale.height}`) this.rebuildLandscape();
    for (const team of ['heroes', 'enemies'] as const) {
      const units = [...this.presented.values()].filter(unit => unit.team === team && this.views.has(unit.id));
      const placements = battleRosterLayout(units, this.stage(), this.content);
      units.forEach((unit, index) => {
        const view = this.views.get(unit.id)!;
        const previous = { x: view.x, y: view.y };
        this.placeView(view, unit, placements[index]);
        this.feedback.forEach(item => {
          if (item.getData('targetId') === unit.id) item.setPosition(item.x + view.x - previous.x, item.y + view.y - previous.y);
        });
      });
    }
    this.renderUnits();
    this.dice?.resize();
  }

  private placeView(view: UnitView, unit: Combatant, placement: BattlePlacement): void {
    view.x = placement.x;
    view.y = placement.y;
    view.scale = placement.scale;
    const geometry = battleUnitGeometry(placement, unit.team === 'enemies');
    view.footprint = geometry.footprint;
    view.bar.setScale(geometry.barScale);
    view.container.setPosition(placement.x, placement.y).setDepth(placement.y);
    setUnitScale(view.sprite, placement.scale * view.growth);
    view.label.setFontSize(placement.fontSize).setY(geometry.labelY);
    let name = unit.name;
    view.label.setText(name);
    while (view.label.width > placement.labelWidth && name.length > 1) {
      name = name.slice(0, -1);
      view.label.setText(`${name}…`);
    }
    const facing = this.facing(unit.team);
    if (view.facing !== facing) {
      const motionName = String(view.sprite.frame.name).split(':')[1] as UnitMotion;
      const motion = UNIT_MOTIONS.includes(motionName) ? motionName : view.dead ? 'death' : 'idle';
      const progress = view.sprite.anims.getProgress();
      const playing = view.sprite.anims.isPlaying;
      this.tweens.killTweensOf(view.sprite);
      view.sprite.setPosition(0, 0);
      view.facing = facing;
      setUnitAnimation(view.sprite, motion, facing, this.reduced || view.dead, true);
      if (!this.reduced && !view.dead) {
        view.sprite.anims.setProgress(progress);
        if (!playing) view.sprite.anims.pause();
      }
    }
  }

  showCombat(state: CombatState, selected: string, reduced: boolean, speed = 1, onPresented?: (state: CombatState) => void,
    onInitiative?: (presentation: InitiativePresentation | undefined) => void) {
    const reductionChanged = this.reduced !== reduced;
    const previous = this.combat;
    this.reduced = reduced;
    this.selected = selected;
    this.speed = Number.isFinite(speed) ? Math.max(0.1, speed) : 1;
    this.onPresented = onPresented;
    this.onInitiative = onInitiative;
    if (reductionChanged && this.ready) {
      // Changing accessibility settings must not discard the pending second hand.
      this.views.forEach((view) => setUnitAnimation(view.sprite, view.dead ? 'death' : 'idle', view.facing, reduced || view.dead, true));
    }
    this.combat = state;
    if (this.ready) {
      if (!this.environment && this.landscapeSeed !== state.seed) this.rebuildLandscape();
      this.time.timeScale = this.speed;
      this.tweens.timeScale = this.speed;
      this.views.forEach(view => { view.sprite.anims.timeScale = this.speed; });
      const correction = previous && state.nextSequence === this.lastSequence
        && previous.units.map(unit => unit.id).join('|') === state.units.map(unit => unit.id).join('|')
        && previous !== state && JSON.stringify(previous.units) !== JSON.stringify(state.units);
      this.renderCombat(state, Boolean(correction));
    }
  }

  private renderCombat(state: CombatState, initial = false) {
    const signature = JSON.stringify([state.seed, state.encounterId]);
    const roster = state.units.map(unit => unit.id).join('|');
    const reset =
      initial ||
      signature !== this.signature ||
      state.nextSequence < this.lastSequence;
    const firstPresentation = this.signature !== signature || this.views.size === 0;
    if (reset) {
      this.clearFeedback();
      this.views.forEach((view) => { view.effects.destroy(); view.container.destroy(); });
      this.views.clear();
      const counts = { heroes: 0, enemies: 0 };
      const placements = {
        heroes: battleRosterLayout(state.units.filter(unit => unit.team === 'heroes'), this.stage(), this.content),
        enemies: battleRosterLayout(state.units.filter(unit => unit.team === 'enemies'), this.stage(), this.content),
      };
      for (const unit of state.units) {
        const i = counts[unit.team]++;
        this.views.set(unit.id, this.createUnit(unit, placements[unit.team][i]));
      }
      this.signature = signature;
      this.queuedRoster = roster;
      this.presentedInitiative = { ...state.initiative };
      this.presentedTurnOrder = [...state.turnOrder];
      this.presentedTurnIndex = state.turnIndex;
      this.presentedRound = state.round;
      this.presentedTurn = state.turn;
      this.presented = new Map(state.units.map(unit => [unit.id, structuredClone(unit)]));
      this.lastSequence = state.nextSequence;
      const opening = firstPresentation && state.turn <= 1 && state.events[0]?.type === 'COMBAT_STARTED' && state.events[0]?.sequence === 1;
      if (opening) {
        this.presentedInitiative = {};
        this.presentedTurnOrder = [];
        this.presentedTurnIndex = 0;
        this.presentedRound = 0;
        this.presentedTurn = 0;
        // A network opening may arrive before Phaser boots. Recover its visual
        // starting health, then show every initiative die and the first action.
        for (const event of [...state.events].reverse()) {
          const unit = this.presented.get(event.targetId ?? event.actorId ?? '');
          if (!unit) continue;
          const amount = Math.max(0, event.amount ?? 0);
          if (event.type === 'DAMAGE') {
            if (unit.body && event.bodyPart) {
              const part = unit.body[event.bodyPart];
              part.current = Math.min(part.max, part.current + amount);
              if (part.current > -Math.ceil(part.max / 2)) part.lost = false;
              unit.hp = bodyCombatHealth(unit.body);
            } else unit.hp = Math.min(unit.stats.maxHp, unit.hp + amount);
          } else if (event.type === 'HEALED' && !unit.body) unit.hp = Math.max(0, unit.hp - amount);
          else if (event.type === 'TURN_STARTED') unit.turnsTaken = Math.max(0, unit.turnsTaken - 1);
        }
        for (const unit of this.presented.values()) {
          unit.statuses = [];
          unit.shield = 0;
          unit.shieldLayers = [];
          unit.escaped = false;
        }
        this.renderUnits();
        this.onPresented?.({ ...state, status: 'ready', pendingActorId: undefined, initiative: {}, turnOrder: [], round: 0, turn: 0,
          units: [...this.presented.values()].map(unit => structuredClone(unit)), events: [], nextSequence: 1 });
        this.batches.push({ state, beats: battleBeats(state.events), index: 0 });
        this.playNextBeat();
        return;
      }
      this.renderUnits();
      this.onPresented?.(state);
      return;
    }
    const fresh = state.events.filter(event => event.sequence >= this.lastSequence);
    if (state.nextSequence > this.lastSequence) {
      if (!fresh.length || fresh[0].sequence !== this.lastSequence) {
        // A snapshot without its preceding log cannot be replayed faithfully.
        this.renderCombat(state, true);
        return;
      }
      this.lastSequence = state.nextSequence;
      this.queuedRoster = roster;
      this.batches.push({ state, beats: battleBeats(fresh), index: 0 });
      if (!this.playing) this.playNextBeat();
    } else if (roster !== this.queuedRoster) {
      this.queuedRoster = roster;
      // A reinforcement without a new event joins at the next visual boundary.
      this.batches.push({ state, beats: [], index: 0 });
      if (!this.playing) this.playNextBeat();
    }
    this.renderUnits();
  }

  private syncRoster(state: CombatState) {
    for (const team of ['heroes', 'enemies'] as const) {
      const units = state.units.filter(unit => unit.team === team);
      const placements = battleRosterLayout(units, this.stage(), this.content);
      units.forEach((unit, index) => {
        const placement = placements[index];
        const view = this.views.get(unit.id);
        if (!view) {
          this.views.set(unit.id, this.createUnit(unit, placement));
          this.presented.set(unit.id, structuredClone(unit));
          return;
        }
        this.placeView(view, unit, placement);
      });
    }
    for (const [id, view] of this.views) if (!state.units.some(unit => unit.id === id)) {
      view.effects.destroy();
      view.container.destroy();
      this.views.delete(id);
      this.presented.delete(id);
    }
  }

  private renderUnits() {
    for (const unit of this.presented.values()) {
      const view = this.views.get(unit.id);
      if (!view) continue;
      updateUnitDefinition(view.sprite, findDefinition(unit.definitionId, this.content), unit.body);
      const alive = unit.body ? isBodyAlive(unit.body) : unit.hp > 0;
      const auraIds = new Set(unit.statuses.map(status => status.id));
      view.targetGrowth = alive && auraIds.has('taunted') ? 1.32 : 1;
      if (this.reduced) view.growth = view.targetGrowth;
      // Feet remain anchored and the UI stays at its own scale while the body grows.
      setUnitScale(view.sprite, view.scale * view.growth);
      view.shadow.setScale(view.growth * view.footprint, view.footprint);
      view.contact.setScale(view.growth * view.footprint, view.footprint);
      view.container.setVisible(!unit.escaped);
      if (view.dead && alive) {
        view.dead = false;
        setUnitAnimation(view.sprite, 'idle', view.facing, this.reduced, true);
      }
      if (!alive && !view.dead) {
        view.dead = true;
        this.playMotion(view, 'death');
      }
      const statusCounts = new Map<string, number>();
      for (const status of unit.statuses) statusCounts.set(status.id, (statusCounts.get(status.id) ?? 0) + (status.stacks ?? 1));
      const auras = [...statusCounts].flatMap(([id, stacks]) => {
        const visual = this.content.statuses.find(status => status.id === id)?.visual;
        return visual ? [{ id, stacks, visual }] : [];
      });
      auras.push(...equipmentAurasFor(unit, findDefinition(unit.definitionId, this.content)).map(({ id, aura }) => ({ id, stacks: 1, visual: aura.visual })));
      view.effects.setState({ dead: !alive, shield: unit.shield > 0, auras,
        burning: auraIds.has('burning'), burningStacks: unit.statuses.filter(status => status.id === 'burning').reduce((sum, status) => sum + (status.stacks ?? 1), 0),
        poisoned: auraIds.has('poisoned'), taunted: auraIds.has('taunted'), bastion: auraIds.has('bastion'),
        regrowth: auraIds.has('regrowth'), bloodlust: auraIds.has('bloodlust'), inspired: auraIds.has('inspired'),
        rapidFire: auraIds.has('rapid_fire'), sureStrike: auraIds.has('sure_strike'),
        fortified: auraIds.has('fortified'), battleFervor: auraIds.has('battle_fervor'),
        boneShield: unit.shield > 0 && Boolean(unit.shieldLayers?.some(layer => layer.capacity > 0
          && this.presented.get(layer.sourceId)?.definitionId === 'necromancer')) }, this.reduced);
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
      this.drawMarker(view, unit);
    }
  }

  private drawMarker(view: UnitView, unit: Combatant): void {
    view.marker.clear();
    if (this.selected === unit.id || this.selected === unit.definitionId || this.presentedTurnOrder[this.presentedTurnIndex] === unit.id) {
      view.marker.lineStyle(1.5, 0xdaca91, 0.75).strokeEllipse(0, 0, 74 * view.growth * view.footprint, 22 * view.footprint);
      const top = -(unit.team === 'enemies' ? 29 : 26) * view.scale * view.growth;
      view.marker.fillStyle(0xe0d09c).fillTriangle(-4, top - 6, 4, top - 6, 0, top);
    }
  }

  private createUnit(unit: Combatant, placement: BattlePlacement): UnitView {
    const { x, y, scale, labelWidth, fontSize } = placement;
    const { footprint, barScale, labelY } = battleUnitGeometry(placement, unit.team === 'enemies');
    const definition = findDefinition(unit.definitionId, this.content);
    const shadow = this.add.ellipse(0, 0, 47, 12, 0x08160e, 0.4);
    const contact = this.add.ellipse(0, 0, 29, 5, 0x07140d, 0.55);
    const marker = this.add.graphics();
    const facing = this.facing(unit.team);
    const dead = unit.body ? !isBodyAlive(unit.body) : unit.hp <= 0;
    const sprite = setUnitScale(createUnitSprite(this, definition, unit.team === 'enemies', 0, 0, unit.body), scale);
    setUnitAnimation(sprite, dead ? 'death' : 'idle', facing, this.reduced || dead);
    sprite.anims.timeScale = this.speed;
    const effects = new UnitEffects(this, sprite);
    const bar = this.add.graphics().setScale(barScale);
    const label = this.add
      .text(0, labelY, unit.name, {
        fontFamily: "Arial, sans-serif",
        fontSize: `${fontSize}px`,
        color: "#d4d8bb",
        stroke: "#17271d",
        strokeThickness: 2,
        backgroundColor: 'rgba(10, 20, 15, 0.72)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);
    let name = unit.name;
    while (label.width > labelWidth && name.length > 1) {
      name = name.slice(0, -1);
      label.setText(`${name}…`);
    }
    const container = this.add
      .container(x, y, [shadow, contact, marker, effects.rear, sprite, effects.front, bar, label])
      .setDepth(y);
    return { container, sprite, effects, bar, marker, shadow, contact, label, x, y, scale, footprint, growth: 1, targetGrowth: 1, facing, dead };
  }

  private playNextBeat() {
    while (this.batches.length) {
      const batch = this.batches[0];
      if (batch.index === 0) {
        this.syncRoster(batch.state);
        if (batch.beats.length) this.publishPresentation(batch.state, batch.beats[0].events[0].sequence - 1);
      }
      const beat = batch.beats[batch.index++];
      if (!beat) {
        this.presented = new Map(batch.state.units.map(unit => [unit.id, structuredClone(unit)]));
        this.presentedInitiative = { ...batch.state.initiative };
        this.presentedTurnOrder = [...batch.state.turnOrder];
        this.presentedTurnIndex = batch.state.turnIndex;
        this.presentedRound = batch.state.round;
        this.presentedTurn = batch.state.turn;
        this.renderUnits();
        this.batches.shift();
        this.onPresented?.(batch.state);
        continue;
      }
      this.playing = true;
      const initiative = beat.dice?.filter(isInitiativeRoll) ?? [];
      if (initiative.length) this.beginInitiative(initiative, beat);
      if (beat.dice?.length) {
        this.animateDiceGroup(beat.dice);
        playBattleDice(beat.dice, initiative.length ? 0 : this.soundPan(beat.dice[0].actorId));
      }
      const performAction = () => {
        if (!this.ready || !beat.action) return;
        const actor = beat.action.actorId ? this.presented.get(beat.action.actorId) : undefined;
        const view = actor ? this.views.get(actor.id) : undefined;
        if (actor && view && !view.dead) {
          playBattleAction(actor, beat.action, this.content, this.soundPan(actor.id));
          const motion = battleMotion(actor, [beat.action]);
          if (motion) this.playMotion(view, motion);
          if (motion === 'cast') {
            const color = Number.parseInt(findDefinition(actor.definitionId, this.content).color.replace('#', ''), 16);
            view.effects.trigger('cast', Number.isFinite(color) ? color : undefined);
          }
          if (beat.action.skillId) view.effects.triggerSkill(beat.action.skillId);
          this.fireSpell(actor, view, beat);
        }
      };
      if (beat.actionDelay > 0) this.time.delayedCall(beat.actionDelay, performAction);
      else performAction();
      const impact = () => {
        if (!this.ready) return;
        for (const event of beat.events) {
          applyPresentedEvent(this.presented, event);
          this.presentTurnEvent(event);
        }
        if (initiative.length && this.initiativeClock) {
          this.initiativeClock = { ...this.initiativeClock, elapsed: Math.max(beat.impact, this.initiativeClock.elapsed), finished: true };
          this.onInitiative?.({ ...this.initiativeClock });
        }
        this.renderUnits();
        this.animateImpact(beat.events);
        playBattleImpact(beat.events, { content: this.content, units: this.presented, outcome: batch.state.status,
          panForUnit: id => this.soundPan(id) });
        this.publishPresentation(batch.state, beat.events[beat.events.length - 1].sequence);
      };
      if (beat.impact > 0) this.time.delayedCall(beat.impact, impact);
      else impact();
      if (beat.duration > 0) {
        this.time.delayedCall(beat.duration, () => {
          if (initiative.length) {
            const next = batch.beats[batch.index];
            if (!next?.dice?.some(isInitiativeRoll)) {
              this.finishInitiative();
              this.publishPresentation(batch.state, beat.events[beat.events.length - 1].sequence);
            }
          }
          this.playNextBeat();
        });
        return;
      }
    }
    this.playing = false;
  }

  private soundPan(id: string | undefined): number {
    const view = id ? this.views.get(id) : undefined;
    return view ? Math.max(-.7, Math.min(.7, (view.x / Math.max(1, this.scale.width) * 2 - 1) * .7)) : 0;
  }

  private beginInitiative(events: CombatEvent[], beat: BattleBeat): void {
    if (!this.initiativeSeries) {
      this.initiativeSeries = true;
      this.initiativeBaseOrder = [...new Set([...this.presentedTurnOrder, ...this.presented.keys()])];
      this.initiativeTies.clear();
    }
    this.initiativeClock = { key: events[0].sequence, events, elapsed: 0, duration: beat.impact,
      finished: false, tie: events[0].rollReason === 'initiativeTie' };
    this.initiativeFrame = -1;
    this.onInitiative?.({ ...this.initiativeClock });
  }

  /** Only event prefixes advance visual turn metadata; snapshots can be several turns ahead. */
  private presentTurnEvent(event: CombatEvent): void {
    this.presentedRound = event.round;
    this.presentedTurn = event.turn;
    if (isInitiativeRoll(event) && event.actorId) {
      const value = event.amount ?? (event.rolls ?? []).reduce((sum, die) => sum + die, 0) + (event.modifier ?? 0);
      if (event.rollReason === 'initiative') this.presentedInitiative[event.actorId] = value;
      else this.initiativeTies.set(event.actorId, [...(this.initiativeTies.get(event.actorId) ?? []), value]);
    } else if (event.type === 'ROUND_STARTED') {
      this.presentedTurnOrder = this.presentedTurnOrder.filter(id => {
        const unit = this.presented.get(id);
        return unit && !unit.escaped && (unit.body ? isBodyAlive(unit.body) : unit.hp > 0);
      });
      this.presentedTurnIndex = 0;
    } else if (event.type === 'TURN_STARTED') {
      const index = this.presentedTurnOrder.indexOf(event.actorId ?? '');
      if (index >= 0) this.presentedTurnIndex = index;
    } else if (event.type === 'TURN_ENDED') {
      const index = this.presentedTurnOrder.indexOf(event.actorId ?? '');
      if (index >= 0) this.presentedTurnIndex = index + 1;
    }
  }

  private finishInitiative(): void {
    // Lexicographic tie histories preserve independent subgroups and every reroll
    // depth, even when one network snapshot contains several completed rounds.
    this.presentedTurnOrder = this.initiativeBaseOrder.filter(id => {
      const unit = this.presented.get(id);
      return unit && !unit.escaped && (unit.body ? isBodyAlive(unit.body) : unit.hp > 0)
        && this.presentedInitiative[id] !== undefined;
    }).sort((a, b) => {
      const total = this.presentedInitiative[b] - this.presentedInitiative[a];
      if (total) return total;
      const left = this.initiativeTies.get(a) ?? [], right = this.initiativeTies.get(b) ?? [];
      for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] !== right[i]) return right[i] - left[i];
      return this.initiativeBaseOrder.indexOf(a) - this.initiativeBaseOrder.indexOf(b);
    });
    this.presentedTurnIndex = 0;
    this.initiativeSeries = false;
    this.initiativeClock = undefined;
    this.onInitiative?.(undefined);
  }

  private fireSpell(actor: Combatant, view: UnitView, beat: BattleBeat): void {
    if (!beat.action || this.reduced) return;
    const kind = battleProjectileKind(actor, beat.action, this.content);
    if (!kind) return;
    const hand = getUnitSocket(view.sprite, beat.action.attackSlot ?? unitCastingHand(view.sprite))
      ?? getUnitSocket(view.sprite, 'chest');
    if (!hand) return;
    for (const targetId of projectileTargets(actor.id, beat.events)) {
      if (targetId === actor.id) continue;
      const target = this.views.get(targetId);
      if (!target) continue;
      const chest = getUnitSocket(target.sprite, 'chest');
      if (!chest) continue;
      const missed = beat.events.some(event => event.type === 'MISS' && event.targetId === targetId);
      this.projectiles?.fire({ x: view.x + hand.x, y: view.y + hand.y },
        { x: target.x + chest.x + (missed ? 25 : 0), y: target.y + chest.y - (missed ? 17 : 0) },
        Math.max(80, beat.impact - beat.actionDelay), kind);
    }
  }

  private publishPresentation(state: CombatState, through: number) {
    // Keep the final sequence pending until all visual beats have finished.
    const events = state.events.filter(event => event.sequence <= through);
    this.onPresented?.({ ...state, status: 'running', pendingActorId: undefined,
      initiative: { ...this.presentedInitiative }, turnOrder: [...this.presentedTurnOrder], turnIndex: this.presentedTurnIndex,
      round: this.presentedRound, turn: this.presentedTurn,
      units: [...this.presented.values()].map(unit => structuredClone(unit)),
      events, nextSequence: Math.min(through + 1, state.nextSequence - 1) });
  }

  private animateDiceGroup(events: readonly CombatEvent[]): void {
    this.dice?.show(events.filter(event => !isInitiativeRoll(event)), this.reduced);
  }
  private playMotion(view: UnitView, motion: UnitMotion) {
    this.tweens.killTweensOf(view.sprite);
    view.sprite.setPosition(0, 0).clearTint();
    view.tintTimer?.remove();
    setUnitAnimation(view.sprite, motion, view.facing, this.reduced, true);
    view.sprite.anims.timeScale = this.speed;
    if (this.reduced || motion === 'death') return;
    if (motion === 'attack' || motion === 'attackLeft') {
      const shift = view.facing === 'north' || view.facing === 'south'
        ? { y: view.facing === 'north' ? -12 : 12 } : { x: view.facing === 'west' ? -12 : 12 };
      this.tweens.add({ targets: view.sprite, ...shift,
        delay: 180, duration: 150, yoyo: true, ease: 'Sine.InOut' });
    } else if (motion === 'hit') {
      view.sprite.setTint(0xffceb1);
      view.tintTimer = this.time.delayedCall(130, () => view.sprite.clearTint());
    }
  }

  private animateImpact(events: readonly CombatEvent[]) {
    for (const unit of this.presented.values()) {
      const view = this.views.get(unit.id);
      if (!view || view.dead) continue;
      if (events.some(event => event.targetId === unit.id && event.type === 'HEALED' && (event.amount ?? 0) > 0)) view.effects.trigger('heal');
      if (events.some(event => event.targetId === unit.id && event.type === 'SHIELD_CREATED')) view.effects.trigger('shield');
      if (events.some(event => event.targetId === unit.id && event.type === 'DAMAGE' && event.skillId && baseSkillId(event.skillId) === 'mage_ignite')) view.effects.trigger('fire');
      const damaged = events.some(event => event.type === 'DAMAGE' && event.targetId === unit.id && (event.amount ?? 0) > 0);
      const blocked = events.some(event => event.type === 'BLOCKED' && event.targetId === unit.id);
      // Location misses do not mean evasion; only accuracy misses animate dodge.
      const evaded = events.some(event => event.type === 'MISS' && event.targetId === unit.id
        && (event.bodyPart !== undefined || !unit.body));
      if (blocked) view.effects.trigger('block');
      if (damaged || blocked || evaded) this.playMotion(view, damaged ? 'hit' : blocked ? unitBlockMotion(view.sprite) : 'dodge');
    }
    events
      .filter((event) =>
        ["DAMAGE", "HEALED", "MISS", "SHIELD_CREATED", "BLOCKED"].includes(event.type),
      )
      .slice(0, 8)
      .forEach((event, index) => {
        if (!event.targetId) return;
        const view = this.views.get(event.targetId);
        if (!view) return;
        const heal = event.type === "HEALED",
          shield = event.type === "SHIELD_CREATED";
        const value =
          event.type === 'BLOCKED' ? 'Блок'
            : event.type === "MISS"
            ? "Мимо"
            : `${heal || shield ? "+" : "−"}${event.amount ?? 0}`;
        const text = this.add
          .text(
            view.x + (index % 2) * 24 - 12,
            view.y - 29 * view.scale * view.growth - index * 8,
            value,
            {
              fontFamily: "Georgia, serif",
              fontSize: "22px",
              color: event.type === 'BLOCKED' ? '#e5d4a7' : heal ? "#c7dc9a" : shield ? "#a7d9dc" : "#f0bf9a",
              stroke: "#13271c",
              strokeThickness: 4,
            },
          )
          .setOrigin(0.5)
          .setDepth(1100);
        text.setData('targetId', event.targetId);
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
    this.batches = [];
    this.playing = false;
    this.initiativeClock = undefined;
    this.initiativeSeries = false;
    this.initiativeTies.clear();
    this.onInitiative?.(undefined);
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.feedback.forEach((text) => text.destroy());
    this.feedback.clear();
    this.dice?.clear();
    this.projectiles?.clear();
    this.views.forEach((view) => {
      view.sprite.setPosition(0, 0).clearTint();
      view.tintTimer = undefined;
      view.effects.clear();
    });
  }
}
