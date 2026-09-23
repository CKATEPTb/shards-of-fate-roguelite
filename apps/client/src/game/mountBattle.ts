import Phaser from "phaser";
import { BattleScene } from "./BattleScene";

/** Own exactly one renderer surface, including when React repeats an effect. */
export function mountBattle(
  host: HTMLElement,
  onReady: (scene: BattleScene) => void,
) {
  const surface = document.createElement("div");
  surface.className = "battle-surface";
  let game: Phaser.Game | undefined;
  let disposed = false;

  // Phaser boots asynchronously and destroy() waits for a game frame. Deferring
  // construction lets React StrictMode cancel its discarded effect before boot.
  const boot = window.setTimeout(() => {
    if (disposed) return;
    host.append(surface);
    const scene = new BattleScene();
    game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: surface,
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      backgroundColor: "#172821",
      pixelArt: true,
      antialias: false,
      scene,
      banner: false,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: Math.max(1, host.clientWidth),
        height: Math.max(1, host.clientHeight),
      },
      fps: { target: 30, limit: 30 },
      render: { roundPixels: true },
      audio: { noAudio: true },
    });
    onReady(scene);
  }, 0);

  return () => {
    disposed = true;
    window.clearTimeout(boot);
    // A late Phaser boot can only append to this detached instance's surface.
    // The replacement instance never shares a canvas parent with it.
    surface.remove();
    game?.destroy(true);
  };
}
