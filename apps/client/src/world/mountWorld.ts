import Phaser from 'phaser';
import type { GridPoint } from '@shards/shared';
import { WorldScene } from './WorldScene';
import type { WorldFrame } from './projection';

/** Deferred boot owns a private surface, so StrictMode cannot leave two canvases. */
export function mountWorld(
  host: HTMLElement,
  onMove: (point: GridPoint) => void,
  onReady: (scene: WorldScene) => void,
  onProjection: (view: WorldFrame) => void,
  onInspectMob: (groupId: string | null) => void = () => {},
) {
  const surface = document.createElement('div');
  surface.className = 'world-surface';
  let game: Phaser.Game | undefined;
  let disposed = false;
  const boot = window.setTimeout(() => {
    if (disposed) return;
    host.append(surface);
    const scene = new WorldScene(onMove, onProjection, onInspectMob);
    game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: surface,
      width: host.clientWidth || 800,
      height: host.clientHeight || 600,
      backgroundColor: '#1c2c24',
      pixelArt: true,
      antialias: false,
      scene,
      banner: false,
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
      fps: { target: 60, limit: 60 },
      render: { roundPixels: false },
      audio: { noAudio: true },
      input: { mouse: { preventDefaultWheel: true }, touch: { capture: true } },
    });
    onReady(scene);
  }, 0);
  return () => {
    disposed = true;
    window.clearTimeout(boot);
    surface.remove();
    game?.destroy(true);
    // destroy() is deferred until a frame, including when an overlay parked it.
    if (game?.isRunning && !game.loop.running) game.loop.wake();
  };
}
