import type Phaser from 'phaser';
import type { RoamingGroup, RoamingMob, WorldChunk } from '@shards/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoamingViews } from '../apps/client/src/world/roaming-views';
import { tileCenter } from '../apps/client/src/world/projection';

const actors = vi.hoisted(() => ({ createActorView: vi.fn(), updateActorView: vi.fn(), animateActor: vi.fn() }));
vi.mock('../apps/client/src/world/actors', () => actors);

class Container {
  visible = true;
  children: Label[] = [];
  constructor(public x: number, public y: number, public depth = y + 0.01) {}
  add(label: Label) { label.parent = this; this.children.push(label); return this; }
  setVisible(value: boolean) { this.visible = value; return this; }
  destroy() {}
}

class Label {
  visible = true;
  parent?: Container;
  color = '';
  constructor(public x: number, public y: number, public text: string) {}
  setOrigin() { return this; }
  setVisible(value: boolean) { this.visible = value; return this; }
  setText(value: string) { this.text = value; return this; }
  setColor(value: string) { this.color = value; return this; }
  getBounds() { return { x: this.parent!.x + this.x - 10, y: this.parent!.y + this.y - 10, width: 20, height: 10 }; }
}

function marker() {
  const graphic: Record<string, unknown> = {};
  for (const method of ['setVisible', 'clear', 'lineStyle', 'strokeEllipse', 'fillStyle', 'fillEllipse', 'fillTriangle', 'fillPoints', 'beginPath', 'moveTo', 'lineTo', 'strokePath']) {
    graphic[method] = vi.fn(() => graphic);
  }
  return graphic;
}

const image = new Uint8ClampedArray(32 * 32 * 4);
image[(16 * 32 + 16) * 4 + 3] = 255;
image[(24 * 32 + 16) * 4 + 3] = 255;
const frame = { name: 'idle', cutX: 0, cutY: 0, cutWidth: 32, cutHeight: 32,
  source: { image: { getContext: () => ({ getImageData: () => ({ data: image }) }) } } };
const chunk: WorldChunk = { id: 'test', size: 35, season: 'spring', spawn: { x: 10, y: 10 }, exits: [], pois: [],
  structures: [], tiles: Array.from({ length: 35 ** 2 }, () => ({ terrain: 'grass', walkable: true, movementCost: 1 })) };
const mob = (id: string, x: number): RoamingMob => ({ id, definitionId: 'scout', position: { x, y: 10 }, path: [] });
const group: RoamingGroup = { id: 'pack', category: 'normal', chases: false, members: [mob('a', 10), mob('b', 11)],
  home: { x: 10, y: 10 }, mode: 'patrol', targetActorId: null, decision: 0, pauseMs: 0 };
const hero = tileCenter({ x: 10, y: 11 });
const viewport = { x: 0, y: 0, width: 1000, height: 1000 };

function fixture() {
  const labels: Label[] = [];
  const scene = { add: { text: (x: number, y: number, value: string) => {
    const label = new Label(x, y, value); labels.push(label); return label;
  } }, textures: { getPixelAlpha: (x: number, y: number) => image[(y * 32 + x) * 4 + 3] } } as unknown as Phaser.Scene;
  const renderer = createRoamingViews(scene);
  renderer.sync([group], chunk, true);
  renderer.update(0, false, false, [hero]);
  return { renderer, labels };
}

beforeEach(() => {
  vi.clearAllMocks();
  actors.createActorView.mockImplementation((_scene, member: RoamingMob, appearance: { scale: number }) => {
    const feet = tileCenter(member.position);
    const container = new Container(feet.x, feet.y);
    const scale = appearance.scale;
    const sprite = { x: 0, y: 0, width: 32, height: 32, displayOriginX: 16, displayOriginY: 28,
      displayWidth: 32 * scale, scaleX: scale, scaleY: scale, visible: true, flipX: false, flipY: false,
      frame, texture: { key: 'units' },
      getBounds: () => ({ x: feet.x - 16 * scale, y: feet.y - 28 * scale, width: 32 * scale, height: 32 * scale }),
      getWorldTransformMatrix: () => ({
        transformPoint: (x: number, y: number, output = { x: 0, y: 0 }) => {
          output.x = feet.x + x * scale; output.y = feet.y + y * scale; return output;
        },
      }) };
    return { container, sprite, marker: marker(), motion: { position: feet }, facing: 'south' };
  });
});

describe('world attached enemy percentages', () => {
  it('gives every pack member the same caption without inspection at its own foot depth', () => {
    const { renderer, labels } = fixture();
    renderer.updateVisibility({ heroes: [hero], viewport, pointVisibility: () => 1 }, false, [], { pack: 73 });
    const frames = JSON.parse(renderer.frames());
    expect(frames).toHaveLength(2);
    expect(frames.every((entry: { labelVisible: boolean; labelText: string; labelDepth: number; depth: number }) =>
      entry.labelVisible && entry.labelText === '73%' && entry.labelDepth === entry.depth)).toBe(true);
    for (const label of labels) expect(label.parent?.children).toContain(label);
    expect(labels[0].parent).not.toBe(labels[1].parent);
  });

  it('never relocates an offscreen body caption to the viewport edge', () => {
    const { renderer } = fixture();
    renderer.updateVisibility({ heroes: [hero], viewport, pointVisibility: () => 1 }, false, [], {});
    const before = JSON.parse(renderer.frames());
    expect(before[0].labelText).toBe('…');
    const captionOnlyViewport = { x: before[0].labelX - 12, y: before[0].labelY - 12, width: 24, height: 14 };
    renderer.updateVisibility({ heroes: [hero], viewport: captionOnlyViewport, pointVisibility: () => 1 }, false, [], { pack: 100 });
    const after = JSON.parse(renderer.frames());
    expect(after[0]).toMatchObject({ labelX: before[0].labelX, labelY: before[0].labelY, bodyVisible: false, labelVisible: false });
    expect(renderer.isGroupVisible('pack')).toBe(false);
  });

  it('shares scenery visibility with captions, selection marks and inspection', () => {
    const { renderer } = fixture();
    const feet = tileCenter(group.members[0].position);
    const body = { x: feet.x + 0.5 * 1.65, y: feet.y - 11.5 * 1.65 };
    renderer.updateVisibility({ heroes: [hero], viewport, pointVisibility: () => 0 }, false, ['pack'], { pack: 0 });
    expect(JSON.parse(renderer.frames()).every((entry: { labelVisible: boolean }) => !entry.labelVisible)).toBe(true);
    expect(renderer.inspect(body)).toBeUndefined();
    expect(actors.createActorView.mock.results[0].value.marker.setVisible).toHaveBeenLastCalledWith(false);
    renderer.updateVisibility({ heroes: [hero], viewport, pointVisibility: point => point.y < feet.y - 10 ? 1 : 0 }, false, ['pack'], { pack: 0 });
    expect(renderer.inspect(body)).toEqual({ groupId: 'pack', mobId: 'a' });
    expect(JSON.parse(renderer.frames())[0]).toMatchObject({ labelVisible: true, labelText: '0%' });
    expect(actors.createActorView.mock.results[0].value.marker.setVisible).toHaveBeenLastCalledWith(true);
  });

  it('hides distant information and restores it when any second hero comes close', () => {
    const { renderer } = fixture();
    const feet = tileCenter(group.members[0].position);
    const body = { x: feet.x + 0.5 * 1.65, y: feet.y - 11.5 * 1.65 };
    const check = (heroes: { x: number; y: number }[], visible: boolean) => {
      renderer.updateVisibility({ heroes, viewport, pointVisibility: () => 1 }, false, ['pack'], { pack: 73 });
      expect(JSON.parse(renderer.frames())[0]).toMatchObject({ bodyVisible: visible, labelVisible: visible });
      expect(actors.createActorView.mock.results[0].value.marker.setVisible).toHaveBeenLastCalledWith(visible);
      expect(renderer.inspect(body)).toEqual(visible ? { groupId: 'pack', mobId: 'a' } : undefined);
    };
    const distantHero = { x: feet.x + 2000, y: feet.y };
    check([hero], true);
    check([distantHero], false);
    check([distantHero, hero], true);
  });
});
