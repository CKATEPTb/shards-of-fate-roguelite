import type { MusicScene, MusicTrack } from './types';

type Note = number | null;
type Instrument = 'pad' | 'pluck' | 'flute' | 'bass' | 'bell';
interface Score {
  tempo: number;
  tonic: number;
  scale: readonly number[];
  chords: readonly number[];
  phrases: readonly (readonly Note[])[];
  plucks: readonly number[];
  warmth: number;
  space: number;
  motion: number;
  volume: number;
  ending?: boolean;
}
interface Voice {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  ended: number;
  closed: boolean;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const REST = null;

/** Original eight-note phrases are scale degrees, with space left for their echoes. */
function scoreFor(scene: MusicScene): Score {
  const seasons: Record<string, Score> = {
    spring: { tempo: 73, tonic: 50, scale: MAJOR, chords: [0, 3, 5, 4, 0, 3, 4, 0],
      phrases: [[2, REST, 4, 5, 4, REST, 1, REST], [0, REST, 2, REST, 4, 2, 1, REST], [4, 5, 7, REST, 5, REST, 4, REST], [2, REST, 1, REST, 0, REST, REST, REST]],
      plucks: [2, 6, 10, 14], warmth: 2800, space: .2, motion: 0, volume: .8 },
    summer: { tempo: 80, tonic: 43, scale: MAJOR, chords: [0, 3, 0, 4, 5, 3, 4, 0],
      phrases: [[4, REST, 2, 4, 5, REST, 4, REST], [2, REST, 0, REST, 1, 2, REST, REST], [4, 6, 7, REST, 6, 4, REST, REST], [2, REST, 1, 2, 0, REST, REST, REST]],
      plucks: [0, 3, 6, 10, 14], warmth: 2400, space: .17, motion: 0, volume: .86 },
    autumn: { tempo: 63, tonic: 45, scale: MINOR, chords: [0, 5, 2, 6, 3, 0, 6, 0],
      phrases: [[4, REST, 2, REST, 1, 0, REST, REST], [2, REST, 4, REST, 3, REST, 2, REST], [5, REST, 4, 2, 1, REST, REST, REST], [2, REST, 1, REST, 0, REST, REST, REST]],
      plucks: [2, 8, 12], warmth: 1900, space: .25, motion: 0, volume: .8 },
    winter: { tempo: 55, tonic: 50, scale: MINOR, chords: [0, 5, 2, 6, 0, 3, 5, 0],
      phrases: [[7, REST, REST, 4, REST, REST, 2, REST], [4, REST, REST, REST, 5, REST, 4, REST], [7, REST, 6, REST, 4, REST, REST, REST], [2, REST, REST, 1, 0, REST, REST, REST]],
      plucks: [2, 10], warmth: 3200, space: .32, motion: 0, volume: .7 },
  };
  if (scene.kind === 'exploration') {
    const season = seasons[scene.season ?? 'spring'] ?? seasons.spring;
    return scene.underground ? { ...season, tempo: season.tempo * .88, warmth: 1250, space: .3, volume: .65 } : season;
  }
  if (scene.kind === 'battle' || scene.kind === 'boss') {
    const motion = scene.kind === 'boss' ? 3 : (scene.threat ?? 0) + 1;
    return { tempo: scene.kind === 'boss' ? 112 : 80 + motion * 10, tonic: scene.kind === 'boss' ? 38 : 45 + (motion === 2 ? 2 : 0),
      scale: MINOR, chords: scene.kind === 'boss' ? [0, 0, 5, 6, 3, 5, 6, 0] : [0, 5, 3, 6, 0, 2, 6, 0],
      phrases: scene.kind === 'boss'
        ? [[7, REST, REST, 9, 11, REST, 9, REST], [7, REST, 6, REST, 4, REST, REST, REST], [9, REST, 11, REST, 12, REST, 11, REST], [9, REST, 7, REST, 6, 4, REST, REST]]
        : [[4, REST, REST, 2, 4, REST, 5, REST], [4, REST, 2, REST, 1, REST, REST, REST], [5, REST, 7, REST, 6, REST, 4, REST], [2, REST, 1, REST, 0, REST, REST, REST]],
      plucks: motion === 1 ? [0, 6, 8, 14] : [0, 2, 6, 8, 10, 14], warmth: scene.kind === 'boss' ? 2300 : 2000,
      space: .16, motion, volume: scene.kind === 'boss' ? .95 : .83 };
  }
  if (scene.kind === 'victory' || scene.kind === 'defeat') {
    const victory = scene.kind === 'victory';
    return { tempo: victory ? 76 : 55, tonic: victory ? 48 : 45, scale: victory ? MAJOR : MINOR,
      chords: victory ? [3, 4, 0, 0] : [0, 5, 3, 0],
      phrases: victory ? [[0, REST, 2, REST, 4, REST, 7, REST], [6, REST, 4, REST, 2, REST, REST, REST], [7, REST, REST, REST, 4, REST, REST, REST], [0, REST, REST, REST, REST, REST, REST, REST]]
        : [[4, REST, REST, REST, 2, REST, REST, REST], [3, REST, REST, REST, 1, REST, REST, REST], [2, REST, REST, REST, 1, REST, REST, REST], [0, REST, REST, REST, REST, REST, REST, REST]],
      plucks: victory ? [0, 4, 10] : [], warmth: victory ? 2600 : 1300, space: .28, motion: 0, volume: .74, ending: true };
  }
  const camp = scene.kind === 'camp';
  return { tempo: camp ? 60 : 66, tonic: 48, scale: camp ? MAJOR : DORIAN, chords: camp ? [0, 5, 3, 4, 0, 3, 4, 0] : [0, 3, 2, 6, 0, 5, 3, 0],
    phrases: camp ? [[2, REST, 4, REST, 2, 1, REST, REST], [0, REST, REST, 2, 4, REST, REST, REST], [5, REST, 4, REST, 2, REST, REST, REST], [1, REST, 2, REST, 0, REST, REST, REST]]
      : [[0, REST, 2, REST, 4, 5, REST, REST], [4, REST, 2, REST, 1, REST, REST, REST], [2, REST, 4, REST, 6, 5, REST, REST], [4, REST, 2, REST, 0, REST, REST, REST]],
    plucks: camp ? [2, 10, 14] : [2, 6, 10, 14], warmth: camp ? 1700 : 2200, space: camp ? .19 : .28, motion: 0, volume: .76 };
}

function localRandom(seedText: string): () => number {
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index++) seed = Math.imul(seed ^ seedText.charCodeAt(index), 16777619);
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

/** Self-contained acoustic-style voices; the owning engine controls volume and crossfades. */
export function createMusicTrack(context: AudioContext, output: AudioNode, scene: MusicScene): MusicTrack {
  const score = scoreFor(scene);
  const random = localRandom(`${scene.kind}:${scene.season ?? ''}:${scene.threat ?? 0}:${!!scene.underground}`);
  const voices = new Set<Voice>();
  const graph: AudioNode[] = [];
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const bus = context.createGain();
  const soften = context.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 5600;
  soften.Q.value = .3;
  const master = context.createGain();
  master.gain.value = .72 * score.volume;
  bus.connect(soften);
  soften.connect(master);
  master.connect(output);
  graph.push(bus, soften, master);

  // Two quiet, damped echoes provide width without a convolution buffer or a hard beat.
  for (const [seconds, pan] of [[.29, -.65], [.43, .65]]) {
    const delay = context.createDelay(1);
    delay.delayTime.value = seconds;
    const damping = context.createBiquadFilter();
    damping.type = 'lowpass';
    damping.frequency.value = score.warmth * .68;
    damping.Q.value = .25;
    const feedback = context.createGain();
    feedback.gain.value = .24;
    const wet = context.createGain();
    wet.gain.value = score.space;
    const position = context.createStereoPanner();
    position.pan.value = pan;
    soften.connect(delay);
    delay.connect(damping);
    damping.connect(feedback);
    feedback.connect(delay);
    damping.connect(wet);
    wet.connect(position);
    position.connect(master);
    graph.push(delay, damping, feedback, wet, position);
  }

  const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = noise.getChannelData(0);
  let smoothNoise = 0;
  for (let index = 0; index < samples.length; index++) {
    smoothNoise = (smoothNoise + .12 * (random() * 2 - 1)) / 1.12;
    samples[index] = smoothNoise * 2.6;
  }

  const releaseVoice = (voice: Voice) => {
    if (voice.closed) return;
    voice.closed = true;
    for (const source of voice.sources) source.onended = null;
    for (const node of voice.nodes) node.disconnect();
    voices.delete(voice);
  };
  const registerVoice = (sources: AudioScheduledSourceNode[], nodes: AudioNode[], at: number, end: number, offset = 0) => {
    const voice: Voice = { sources, nodes: [...sources, ...nodes], ended: 0, closed: false };
    voices.add(voice);
    for (const source of sources) {
      source.onended = () => {
        source.disconnect();
        voice.ended++;
        if (voice.ended === sources.length) releaseVoice(voice);
      };
      if (source instanceof AudioBufferSourceNode) source.start(at, offset);
      else source.start(at);
      source.stop(end);
    }
  };
  const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
  const degree = (index: number) => score.scale[(index % 7 + 7) % 7] + Math.floor(index / 7) * 12;

  const tone = (midi: number, at: number, duration: number, instrument: Instrument, velocity = 1, pan = 0) => {
    if (disposed || voices.size >= 64) return;
    const pad = instrument === 'pad', pluck = instrument === 'pluck', bass = instrument === 'bass', bell = instrument === 'bell';
    const attack = pad ? .55 : pluck ? .009 : bass ? .025 : bell ? .012 : .07;
    const tail = pad ? .9 : pluck ? .16 : bass ? .2 : bell ? .85 : .3;
    const peak = (pad ? .024 : pluck ? .036 : bass ? .065 : bell ? .034 : .046) * velocity;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), at + attack);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, peak * (pluck || bell ? .12 : .75)), at + Math.max(attack + .01, duration));
    envelope.gain.exponentialRampToValueAtTime(.0001, at + Math.max(attack + .02, duration) + tail);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = .45;
    filter.frequency.setValueAtTime(bass ? 500 : pluck ? score.warmth * 1.4 : score.warmth, at);
    if (pluck) filter.frequency.exponentialRampToValueAtTime(550, at + duration);
    const position = context.createStereoPanner();
    position.pan.value = pan;
    filter.connect(envelope);
    envelope.connect(position);
    position.connect(bus);
    const fundamental = context.createOscillator();
    fundamental.type = pluck || bass ? 'triangle' : 'sine';
    fundamental.frequency.value = frequency(midi);
    fundamental.detune.value = (random() - .5) * (pad ? 6 : 2);
    fundamental.connect(filter);
    const sources: AudioScheduledSourceNode[] = [fundamental];
    const nodes: AudioNode[] = [envelope, filter, position];
    if (!bass) {
      const overtone = context.createOscillator();
      const blend = context.createGain();
      overtone.type = pad ? 'triangle' : 'sine';
      overtone.frequency.value = frequency(midi) * (pad ? 1.002 : bell ? 2.003 : 2);
      blend.gain.value = pad ? scene.kind === 'exploration' && scene.season === 'summer' ? .32 : .2 : pluck ? .1 : bell ? .18 : .12;
      overtone.connect(blend);
      blend.connect(filter);
      sources.push(overtone);
      nodes.push(blend);
    }
    if (bell) {
      const glint = context.createOscillator();
      const blend = context.createGain();
      glint.type = 'sine';
      glint.frequency.value = frequency(midi) * 4.006;
      blend.gain.setValueAtTime(.045, at);
      blend.gain.exponentialRampToValueAtTime(.001, at + Math.max(.1, duration * .5));
      glint.connect(blend);
      blend.connect(filter);
      sources.push(glint);
      nodes.push(blend);
    }
    if (instrument === 'flute' && duration > .2) {
      const vibrato = new Float32Array(32);
      for (let index = 0; index < vibrato.length; index++) vibrato[index] = Math.sin(index / 31 * duration * Math.PI * 9) * 5 * Math.min(1, index / 8);
      fundamental.detune.setValueCurveAtTime(vibrato, at, duration);
    }
    registerVoice(sources, nodes, at, at + Math.max(attack + .02, duration) + tail + .025);
  };

  const percussion = (at: number, kind: 'drum' | 'tom' | 'brush', velocity: number) => {
    if (disposed || voices.size >= 64) return;
    const brush = kind === 'brush';
    const duration = brush ? .15 : kind === 'tom' ? .34 : .3;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime((brush ? .02 : .06) * velocity, at + .008);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    const position = context.createStereoPanner();
    position.pan.value = brush ? .32 : kind === 'tom' ? -.2 : 0;
    envelope.connect(position);
    position.connect(bus);
    if (brush) {
      const source = context.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2300;
      filter.Q.value = .45;
      source.connect(filter);
      filter.connect(envelope);
      registerVoice([source], [filter, envelope, position], at, at + duration + .015, random() * .7);
    } else {
      const source = context.createOscillator();
      source.type = 'sine';
      source.frequency.setValueAtTime(kind === 'tom' ? 155 : 105, at);
      source.frequency.exponentialRampToValueAtTime(kind === 'tom' ? 87 : 49, at + duration * .7);
      source.connect(envelope);
      registerVoice([source], [envelope, position], at, at + duration + .015);
    }
  };

  const beat = 60 / score.tempo;
  const stepDuration = beat / 4;
  let stepIndex = 0;
  let nextAt = context.currentTime + .045;
  const compose = (index: number, at: number) => {
    const step = index % 16;
    const bar = Math.floor(index / 16);
    const chord = score.chords[bar % score.chords.length];
    const phrase = score.phrases[bar % score.phrases.length];
    const passage = Math.floor(bar / score.chords.length);
    const softPhrase = !score.motion && bar % 4 === 1;
    const finale = score.ending && bar === score.chords.length - 1;
    if (step === 0) {
      const intervals = [0, 2, 4, 8];
      intervals.forEach((interval, voice) => {
        let note = score.tonic + degree(chord + interval);
        while (note > score.tonic + 17) note -= 12;
        tone(note, at + voice * .018, beat * (finale ? 5 : 3.8), 'pad', score.motion ? 1.05 : .85, (voice - 1.5) * .24);
      });
      tone(score.tonic + degree(chord) - 12, at, beat * (score.motion ? .8 : 2.6), 'bass', score.motion ? .9 : .62);
    }
    if (score.motion && step !== 0 && step % (score.motion > 1 ? 4 : 8) === 0) {
      const fifth = step === 12 || step === 8 && bar % 2 === 1;
      tone(score.tonic + degree(chord + (fifth ? 4 : 0)) - 12, at, beat * .65, 'bass', .65);
    }
    if (!finale && score.plucks.includes(step)) {
      const arpeggio = [0, 4, 2, 4, 8, 4, 2, 4];
      const arpeggioIndex = (score.plucks.indexOf(step) + bar + passage) % arpeggio.length;
      const note = score.tonic + 12 + degree(chord + arpeggio[arpeggioIndex]);
      const late = (random() - .5) * .012 + (step % 2 ? .015 : 0);
      tone(note, at + Math.max(0, late), beat * .7, 'pluck', (softPhrase ? .42 : .6) * (.92 + random() * .12), Math.sin(bar + step * .7) * .45);
    }
    if (step % 2 === 0) {
      const melodyIndex = step / 2;
      const note = phrase[melodyIndex];
      if (note !== null && note !== undefined && (!softPhrase || melodyIndex === 0 || melodyIndex === 4)) {
        const nextNote = phrase.slice(melodyIndex + 1).findIndex(value => value !== null);
        const heldSteps = nextNote < 0 ? 8 - melodyIndex : nextNote + 1;
        const length = Math.min(score.motion ? beat * 1.35 : beat * 1.8, heldSteps * beat * .46);
        const variation = !score.ending && passage % 3 === 2 && melodyIndex === 6 ? 2 : 0;
        const crystal = scene.kind === 'exploration' && scene.season === 'winter' && !scene.underground;
        tone(score.tonic + 12 + degree(note + variation), at + .025, finale ? beat * 3 : length, crystal ? 'bell' : 'flute', softPhrase ? .62 : .84, -.12);
      }
    }
    if (scene.kind === 'exploration' && !scene.underground) {
      if (scene.season === 'spring' && bar % 8 === 5 && step === 15) {
        tone(score.tonic + 24 + degree(2), at, .11, 'flute', .23, .42);
        tone(score.tonic + 24 + degree(4), at + .12, .15, 'flute', .18, .48);
      }
      if (scene.season === 'autumn' && bar % 4 === 2 && step === 12) {
        tone(score.tonic + degree(chord + 4), at + .015, beat * .6, 'pluck', .48, -.38);
      }
    }
    if (score.motion) {
      if (step === 0 || step === 8) percussion(at, 'drum', step === 0 ? .85 : .62);
      if (step === 6 || step === 14 || score.motion > 1 && step === 10) percussion(at + .012, 'brush', step === 14 ? .65 : .4);
      if (score.motion > 1 && step === 12) percussion(at + .008, 'tom', .45);
      if (score.motion === 3 && bar % 4 === 3 && (step === 13 || step === 15)) percussion(at, 'tom', step === 15 ? .52 : .33);
    } else if (scene.kind === 'exploration' && scene.season === 'summer' && !scene.underground && step === 10 && bar % 2 === 0) {
      percussion(at, 'brush', .22);
    }
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    for (const voice of [...voices]) {
      for (const source of voice.sources) {
        source.onended = null;
        try { source.stop(context.currentTime); } catch { /* A naturally ended source is already silent. */ }
      }
      releaseVoice(voice);
    }
    for (const node of graph) node.disconnect();
    graph.length = 0;
  };
  const schedule = () => {
    if (disposed) return;
    if (context.state === 'closed') { dispose(); return; }
    const now = context.currentTime;
    // A throttled tab skips old beats instead of releasing a burst of overdue notes.
    if (nextAt < now - .08) {
      const missed = Math.ceil((now + .035 - nextAt) / stepDuration);
      stepIndex += missed;
      nextAt += missed * stepDuration;
    }
    while (nextAt < now + .15) {
      if (score.ending && stepIndex >= score.chords.length * 16) {
        if (timer !== undefined) clearInterval(timer);
        timer = undefined;
        return;
      }
      compose(stepIndex++, nextAt);
      nextAt += stepDuration;
    }
  };
  timer = setInterval(schedule, 100);
  schedule();
  return { dispose };
}
