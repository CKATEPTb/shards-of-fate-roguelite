import Phaser from 'phaser';
import { gameContent } from '../catalog';
import { createUnitSprite, setUnitAnimation, setUnitScale, type UnitFacing, type UnitMotion } from './unitAnimation';
import { UnitEffects, type UnitEffectState } from './unitEffects';

const select = (id: string) => document.getElementById(id) as HTMLSelectElement;
const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const text = (id: string, value: string) => { const element = document.getElementById(id); if (element) element.textContent = value; };
type AuraKey = Exclude<keyof UnitEffectState, 'dead' | 'burningStacks' | 'auras'>;
const choices: [AuraKey, string, string, string][] = [
  ['boneShield', 'Костяной щит', 'necromancer_ward', 'Кости вращаются в полупрозрачном песчаном вихре: часть проходит за спиной, часть — перед героем.'],
  ['taunted', 'Провокация', 'tank_taunt', 'Тело плавно увеличивается и остаётся большим всё время действия провокации. Ступни сохраняют опору.'],
  ['bastion', 'Бастион', 'guardian_bastion', 'Золотистые защитные пластины образуют вокруг героя вращающуюся преграду.'],
  ['inspired', 'Благословение', 'priest_prayer', 'Мягкий жёлтый свет, тонкие восходящие лучи и редкие искры вокруг благословлённого союзника.'],
  ['regrowth', 'Живая роща', 'druid_regrowth', 'Вьющиеся побеги и листья поднимаются вокруг тела по зелёной спирали.'],
  ['bloodlust', 'Жажда крови', 'vampire_bloodlust', 'Алые нити и пульсирующее багровое свечение сопровождают усиленные атаки.'],
  ['rapidFire', 'Шквал стрел', 'ranger_volley', 'Светлые перья кружатся в быстрых потоках воздуха вокруг следопыта.'],
  ['sureStrike', 'Верный удар', 'rogue_precision', 'Серебристые лезвия и холодные вспышки отмечают готовность к критическому попаданию.'],
  ['burning', 'Горение', 'mage_ignite', 'Чем больше стаков, тем больше языков пламени и тлеющих искр вокруг цели.'],
  ['poisoned', 'Яд', 'healer_mend', 'Приглушённый зелёный туман и поднимающиеся пузырьки обозначают отравление.'],
  ['fortified', 'Укрепление', 'guardian_bastion', 'Холодные стальные знаки защиты окружают укреплённое тело.'],
  ['battleFervor', 'Боевой пыл', 'damage_burst', 'Медно-золотистая спираль подчёркивает готовность к следующей атаке.'],
];

class AuraPreview extends Phaser.Scene {
  private sprite?: Phaser.GameObjects.Sprite;
  private effects?: UnitEffects;
  private group?: Phaser.GameObjects.Container;
  private shadow?: Phaser.GameObjects.Ellipse;
  private growth = 1;
  private timer = 0;
  private paused = false;

  constructor() { super('aura-preview'); }

  create(): void {
    const floor = this.add.graphics();
    floor.lineStyle(1, 0x546149, 0.15);
    for (let row = 0; row < 7; row++) floor.lineBetween(170 - row * 18, 345 + row * 15, 550 + row * 18, 345 + row * 15);
    for (let col = -4; col <= 4; col++) floor.lineBetween(360 + col * 40, 340, 360 + col * 65, 446);
    this.rebuild();
    select('hero').onchange = () => this.rebuild();
    for (const id of ['facing', 'motion', 'reduced']) input(id).onchange = () => this.pose(true);
    input('stacks').oninput = () => { text('stackValue', input('stacks').value); this.applyState(); };
    document.getElementById('pause')!.onclick = () => {
      this.paused = !this.paused;
      text('pause', this.paused ? '▶ Продолжить' : 'Ⅱ Пауза');
      document.getElementById('pause')!.setAttribute('aria-pressed', String(this.paused));
      if (this.paused) this.sprite?.anims.pause(); else this.sprite?.anims.resume();
    };
    document.getElementById('cast')!.onclick = () => {
      if (!this.sprite || !this.effects) return;
      this.paused = false;
      text('pause', 'Ⅱ Пауза');
      setUnitAnimation(this.sprite, 'cast', select('facing').value as UnitFacing, input('reduced').checked, true);
      const choice = choices.find(([key]) => input(`aura-${key}`).checked);
      this.effects.triggerSkill(choice?.[2] ?? 'healer_mend');
      this.timer = 0;
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.effects?.destroy());
  }

  update(_time: number, delta: number): void {
    if (!this.sprite || this.paused) return;
    const elapsed = Math.min(delta, 100), reduced = input('reduced').checked;
    const target = input('aura-taunted').checked ? 1.32 : 1;
    this.growth = reduced ? target : this.growth + (target - this.growth) * (1 - Math.exp(-elapsed / 160));
    setUnitScale(this.sprite, 7.5 * this.growth);
    this.shadow?.setScale(this.growth, 1);
    this.effects?.update(elapsed, reduced);
    this.timer += elapsed;
    if (this.timer >= 1400) { this.timer = 0; this.pose(false); }
  }

  applyState(): void {
    const state: UnitEffectState = { shield: input('aura-boneShield').checked, burning: false, poisoned: false, dead: false };
    for (const [key] of choices) state[key] = input(`aura-${key}`).checked;
    state.burningStacks = Number(input('stacks').value);
    this.effects?.setState(state, input('reduced').checked);
    document.getElementById('stackRow')!.hidden = !state.burning;
    text('auraDescription', choices.filter(([key]) => state[key]).map(choice => choice[3]).join(' ') || 'Выберите ауру, чтобы рассмотреть её на персонаже.');
  }

  private rebuild(): void {
    this.effects?.destroy();
    this.group?.destroy(true);
    const hero = gameContent.characters.find(candidate => candidate.id === select('hero').value) ?? gameContent.characters[0];
    this.sprite = setUnitScale(createUnitSprite(this, hero), 7.5 * this.growth);
    this.effects = new UnitEffects(this, this.sprite);
    this.shadow = this.add.ellipse(0, 0, 157, 27, 0x050d0a, 0.55);
    this.group = this.add.container(360, 376, [this.shadow, this.effects.rear, this.sprite, this.effects.front]);
    text('heroName', hero.name); text('heroTitle', hero.title);
    this.pose(true); this.applyState();
  }

  private pose(restart: boolean): void {
    if (!this.sprite) return;
    const motion = select('motion').value as UnitMotion;
    setUnitAnimation(this.sprite, motion, select('facing').value as UnitFacing, input('reduced').checked,
      restart || !['idle', 'walk'].includes(motion));
    if (this.paused) this.sprite.anims.pause();
    this.applyState();
  }
}

for (const hero of gameContent.characters) select('hero').add(new Option(hero.name, hero.id));
select('hero').value = 'necromancer';
input('reduced').checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
const scene = new AuraPreview();
for (const [key, name] of choices) {
  const label = document.createElement('label'); label.className = 'aura';
  const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = `aura-${key}`;
  checkbox.checked = key === 'boneShield'; checkbox.onchange = () => scene.applyState();
  label.append(checkbox, document.createTextNode(name)); document.getElementById('auras')!.append(label);
}
new Phaser.Game({ type: Phaser.AUTO, parent: 'auraStage', width: 720, height: 480, transparent: true,
  pixelArt: true, antialias: false, roundPixels: true, scene: [scene], audio: { noAudio: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, banner: false });
