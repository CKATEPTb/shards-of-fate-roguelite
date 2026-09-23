export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  muted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = Object.freeze({
  masterVolume: .8,
  musicVolume: .35,
  effectsVolume: .65,
  muted: false,
});

const storageKey = 'shards.audio-settings.v1';
const listeners = new Set<() => void>();
let current: Readonly<AudioSettings> | undefined;
let storageWriteFailed = false;

function volume(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function normalize(value: unknown, fallback: Readonly<AudioSettings>): Readonly<AudioSettings> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.freeze({
    masterVolume: volume(source.masterVolume, fallback.masterVolume),
    musicVolume: volume(source.musicVolume, fallback.musicVolume),
    effectsVolume: volume(source.effectsVolume, fallback.effectsVolume),
    muted: typeof source.muted === 'boolean' ? source.muted : fallback.muted,
  });
}

function parseStoredSettings(value: string | null): Readonly<AudioSettings> {
  try { return normalize(value ? JSON.parse(value) : null, DEFAULT_AUDIO_SETTINGS); }
  catch { return DEFAULT_AUDIO_SETTINGS; }
}

function readStorage(): Readonly<AudioSettings> | null {
  if (typeof window === 'undefined') return null;
  try { return parseStoredSettings(window.localStorage.getItem(storageKey)); }
  catch { return null; }
}

/** React and the audio engine share one stable snapshot until a setting changes. */
export function getAudioSettings(): Readonly<AudioSettings> {
  return current ??= readStorage() ?? DEFAULT_AUDIO_SETTINGS;
}

function publish(next: Readonly<AudioSettings>) {
  const previous = getAudioSettings();
  if (previous.masterVolume === next.masterVolume && previous.musicVolume === next.musicVolume
    && previous.effectsVolume === next.effectsVolume && previous.muted === next.muted) return;
  current = next;
  for (const listener of [...listeners]) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key !== storageKey && event.key !== null) return;
  try { if (event.storageArea !== window.localStorage) return; }
  catch { return; }
  storageWriteFailed = false;
  publish(parseStoredSettings(event.newValue));
}

export function subscribeAudioSettings(listener: () => void): () => void {
  const wasEmpty = listeners.size === 0;
  listeners.add(listener);
  if (wasEmpty && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
    const stored = storageWriteFailed ? null : readStorage();
    if (stored) publish(stored);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

export function updateAudioSettings(partial: Partial<AudioSettings>): void {
  const next = normalize(partial, getAudioSettings());
  // Storage may be disabled or full; live controls still work for this session.
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, JSON.stringify(next));
    storageWriteFailed = false;
  } catch { storageWriteFailed = true; }
  publish(next);
}
