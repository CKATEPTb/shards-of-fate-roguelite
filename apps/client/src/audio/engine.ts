import { createMusicTrack } from './music';
import { playSynthEffect } from './effects';
import { getAudioSettings, subscribeAudioSettings } from './settings';
import type { AudioVoice, MusicScene, MusicTrack, SoundCue, SoundOptions } from './types';

interface PlayingTrack { track: MusicTrack; gain: GainNode; timer?: ReturnType<typeof setTimeout> }
interface PlayingEffect { voice: AudioVoice; gain: GainNode; pan?: StereoPannerNode; timer: ReturnType<typeof setTimeout> }
let context: AudioContext | undefined;
let master: GainNode | undefined;
let music: GainNode | undefined;
let effects: GainNode | undefined;
let limiter: DynamicsCompressorNode | undefined;
let desired: MusicScene = { kind: 'menu' };
let fallback: MusicScene = desired;
let currentTrack: PlayingTrack | undefined;
let currentKey = '';
let clients = 0;
let unlisten: (() => void) | undefined;
const fading = new Set<PlayingTrack>();
const voices = new Set<PlayingEffect>();
const lastCue = new Map<SoundCue, number>();
const limits: Partial<Record<SoundCue, number>> = { ui: 65, select: 75, step: 230, dice: 140, hit: 100,
  heal: 160, aura: 240, coin: 180, campfire: 5000, turn: 300, bossArrival: 2000 };
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;

function ramp(node: GainNode, value: number, duration = .08) {
  if (!context) return;
  node.gain.cancelScheduledValues(context.currentTime);
  node.gain.setTargetAtTime(value, context.currentTime, duration);
}

function disposeTrack(playing: PlayingTrack) {
  if (playing.timer) clearTimeout(playing.timer);
  playing.track.dispose();
  playing.gain.disconnect();
  fading.delete(playing);
}

function stopMusic() {
  if (currentTrack) disposeTrack(currentTrack);
  currentTrack = undefined;
  currentKey = '';
  for (const playing of [...fading]) disposeTrack(playing);
}

function stopVoice(playing: PlayingEffect) {
  clearTimeout(playing.timer);
  playing.voice.stop();
  playing.gain.disconnect();
  playing.pan?.disconnect();
  voices.delete(playing);
}

function stopEffects() {
  for (const playing of [...voices]) stopVoice(playing);
  lastCue.clear();
}

function syncMusic() {
  const settings = getAudioSettings();
  if (!context || !music || context.state !== 'running' || document.hidden || !clients
    || settings.muted || settings.masterVolume === 0 || settings.musicVolume === 0) return;
  const key = JSON.stringify([desired.kind, desired.season, desired.threat, !!desired.underground]);
  if (currentTrack && currentKey === key) return;
  // Only one outgoing phrase survives a rapid transition between screens/chunks.
  for (const playing of [...fading]) disposeTrack(playing);
  if (currentTrack) {
    const outgoing = currentTrack;
    fading.add(outgoing);
    ramp(outgoing.gain, 0, .42);
    outgoing.timer = setTimeout(() => disposeTrack(outgoing), 2200);
    currentTrack = undefined;
  }
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(music);
  currentTrack = { gain, track: createMusicTrack(context, gain, desired) };
  currentKey = key;
  ramp(gain, 1, .48);
}

function applySettings() {
  if (!context || !master || !music || !effects) return;
  const settings = getAudioSettings();
  ramp(master, settings.muted ? 0 : settings.masterVolume);
  ramp(music, settings.musicVolume);
  ramp(effects, settings.effectsVolume);
  if (settings.muted || settings.masterVolume === 0) { stopMusic(); stopEffects(); }
  else {
    if (settings.musicVolume === 0) stopMusic();
    else syncMusic();
    if (settings.effectsVolume === 0) stopEffects();
  }
}

function ensureContext(): AudioContext | undefined {
  if (context) return context;
  const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return undefined;
  try {
    context = new AudioContextClass({ latencyHint: 'interactive' });
    master = context.createGain();
    music = context.createGain();
    effects = context.createGain();
    limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 12;
    limiter.ratio.value = 5;
    limiter.attack.value = .005;
    limiter.release.value = .2;
    music.connect(master);
    effects.connect(master);
    master.connect(limiter);
    limiter.connect(context.destination);
    context.onstatechange = () => {
      if (context?.state === 'running') syncMusic();
      else { stopMusic(); stopEffects(); }
    };
    const settings = getAudioSettings();
    master.gain.value = settings.muted ? 0 : settings.masterVolume;
    music.gain.value = settings.musicVolume;
    effects.gain.value = settings.effectsVolume;
    return context;
  } catch { context = undefined; return undefined; }
}

function unlock() {
  if (document.hidden || !clients) return;
  const active = ensureContext();
  if (!active) return;
  if (active.state !== 'running') void active.resume().then(syncMusic).catch(() => { /* Retry on the next user gesture. */ });
  else syncMusic();
}

function visibilityChanged() {
  if (document.hidden) {
    stopMusic(); stopEffects();
    if (context?.state === 'running') void context.suspend().catch(() => {});
  } else if (context) unlock();
}

function interfaceClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>('button, [role="button"]') : null;
  if (!target || target.matches(':disabled, [aria-disabled="true"]') || target.closest('[data-sound="off"]')) return;
  playSound('ui', { volume: .4 });
}

/** One shared context for React and Phaser. No sound events enter saves, RNG streams or network messages. */
export function initAudio(): () => void {
  clients++;
  if (clients === 1) {
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('pointerup', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('click', interfaceClick, true);
    document.addEventListener('visibilitychange', visibilityChanged);
    unlisten = subscribeAudioSettings(applySettings);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--clients > 0) return;
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('pointerup', unlock, true);
    document.removeEventListener('keydown', unlock, true);
    document.removeEventListener('click', interfaceClick, true);
    document.removeEventListener('visibilitychange', visibilityChanged);
    unlisten?.(); unlisten = undefined;
    stopMusic(); stopEffects();
    const old = context;
    if (old) { old.onstatechange = null; void old.close().catch(() => {}); }
    master?.disconnect(); music?.disconnect(); effects?.disconnect(); limiter?.disconnect();
    context = undefined; master = undefined; music = undefined; effects = undefined; limiter = undefined;
  };
}

export function setMenuAudioScene(scene: MusicScene) { fallback = scene; setAudioScene(scene); }
export function restoreMenuAudioScene() { setAudioScene(fallback); }
export function setAudioScene(scene: MusicScene) { desired = scene; syncMusic(); }

/** Silent while locked/hidden: stale impacts are never queued for the next interaction. */
export function playSound(cue: SoundCue, options: SoundOptions = {}) {
  const settings = getAudioSettings();
  if (!clients || !context || !effects || context.state !== 'running' || document.hidden
    || settings.muted || settings.masterVolume === 0 || settings.effectsVolume === 0) return;
  const now = context.currentTime * 1000;
  if (now - (lastCue.get(cue) ?? -Infinity) < (limits[cue] ?? 85)) return;
  lastCue.set(cue, now);
  if (voices.size >= 24) stopVoice(voices.values().next().value!);
  const gain = context.createGain();
  gain.gain.value = clamp(options.volume ?? 1);
  const pan = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : undefined;
  if (pan) {
    pan.pan.value = Math.max(-.8, Math.min(.8, Number.isFinite(options.pan) ? options.pan! : 0));
    gain.connect(pan); pan.connect(effects);
  } else gain.connect(effects);
  const voice = playSynthEffect(context, gain, cue, options);
  const playing: PlayingEffect = { voice, gain, pan, timer: setTimeout(() => stopVoice(playing), (voice.duration + .1) * 1000) };
  voices.add(playing);
}
