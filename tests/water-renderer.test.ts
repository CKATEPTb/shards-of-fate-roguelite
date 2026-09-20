import type Phaser from 'phaser';
import type { WorldChunk } from '@shards/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWater } from '../apps/client/src/world/water';
import { waterGeometry } from '../apps/client/src/world/water-geometry';

const chunk: WorldChunk = { id: 'water-cleanup', size: 5, season: 'spring', spawn: { x: 0, y: 0 }, exits: [], pois: [], structures: [],
  tiles: Array.from({ length: 25 }, (_, index) => ({ terrain: index === 6 || index === 7 ? 'water' : 'path',
    walkable: index !== 6 && index !== 7, movementCost: 1 })) };

function context() {
  const state = { fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(),
    globalCompositeOperation: 'source-over', drawImage: vi.fn(), clipped: false };
  state.drawImage.mockImplementation(() => { state.clipped = state.globalCompositeOperation === 'destination-in'; });
  return state;
}

afterEach(() => vi.unstubAllGlobals());

describe('cached water animation', () => {
  it('clips compact cached frames to the shoreline, culls and disposes every owned texture', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context() }) });
    const contexts: ReturnType<typeof context>[] = [];
    const textureKeys: string[] = [];
    const image = { setOrigin: vi.fn(), setDepth: vi.fn(), setVisible: vi.fn(), setTexture: vi.fn(), destroy: vi.fn() };
    image.setOrigin.mockReturnValue(image); image.setDepth.mockReturnValue(image);
    const remove = vi.fn();
    const scene = { textures: {
      createCanvas: (key: string, width: number, height: number) => {
        textureKeys.push(key);
        expect(width * height).toBeLessThan(chunk.size ** 2 * 32 ** 2);
        const canvas = context(); contexts.push(canvas);
        return { getContext: () => canvas, refresh: vi.fn() };
      }, remove,
    }, add: { image: () => image } } as unknown as Phaser.Scene;
    expect(waterGeometry(chunk).patches).toHaveLength(1);
    const water = createWater(scene, chunk);
    expect(textureKeys).toHaveLength(8);
    expect(contexts.every(canvas => canvas.clipped && canvas.drawImage.mock.calls.length === 1)).toBe(true);
    water.update(190, false);
    expect(image.setTexture).toHaveBeenLastCalledWith(textureKeys[1]);
    water.update(190, true);
    expect(image.setTexture).toHaveBeenCalledTimes(1);
    water.update(190, false, { x: 1000, y: 1000, width: 10, height: 10 });
    expect(image.setVisible).toHaveBeenLastCalledWith(false);
    expect(image.setTexture).toHaveBeenCalledTimes(1);
    water.destroy(); water.destroy();
    expect(image.destroy).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls.map(([key]) => key)).toEqual(textureKeys);
    water.update(1000, false);
    expect(image.setTexture).toHaveBeenCalledTimes(1);
  });
});
