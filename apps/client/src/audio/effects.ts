import type { AudioVoice, SoundCue, SoundOptions } from './types';

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

/** A local noise texture never touches the game's random streams. */
function noiseBuffer(context: AudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(context);
  if (buffer) return buffer;
  buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 0x51f15e;
  for (let i = 0; i < samples.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    samples[i] = (seed >>> 0) / 0x80000000 - 1;
  }
  noiseBuffers.set(context, buffer);
  return buffer;
}

/** Brief acoustic gestures: no speech, samples, persistent oscillators, or game state. */
export function playSynthEffect(context: AudioContext, output: AudioNode, cue: SoundCue, options: SoundOptions = {}): AudioVoice {
  const now = context.currentTime;
  const bus = context.createGain();
  const intensity = Number.isFinite(options.intensity) ? Math.max(0, Math.min(1.6, options.intensity!)) : 1;
  bus.gain.value = Math.sqrt(intensity) * .72;
  bus.connect(output);
  const nodes: AudioNode[] = [bus];
  const sources = new Set<AudioScheduledSourceNode>();
  let duration = 0, stopped = false;

  const disconnect = () => {
    for (const node of nodes) node.disconnect();
  };
  const sourceLife = (source: AudioScheduledSourceNode, delay: number, length: number) => {
    sources.add(source);
    nodes.push(source);
    duration = Math.max(duration, delay + length + .015);
    source.onended = () => {
      sources.delete(source);
      source.disconnect();
      if (!sources.size) disconnect();
    };
    source.start(now + delay);
    source.stop(now + delay + length + .01);
  };
  const envelope = (delay: number, length: number, gain: number, attack = .006) => {
    const node = context.createGain();
    nodes.push(node);
    const start = now + delay;
    node.gain.setValueAtTime(.0001, start);
    node.gain.exponentialRampToValueAtTime(Math.max(.0001, gain), start + Math.min(attack, length / 3));
    node.gain.exponentialRampToValueAtTime(.0001, start + length);
    node.connect(bus);
    return node;
  };
  const tone = (frequency: number, end: number, length: number, gain = .12, shape: OscillatorType = 'sine', delay = 0) => {
    const oscillator = context.createOscillator();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, now + delay);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + delay + length);
    oscillator.connect(envelope(delay, length, gain));
    sourceLife(oscillator, delay, length);
  };
  const noise = (frequency: number, end: number, length: number, gain = .12, delay = 0, type: BiquadFilterType = 'bandpass', attack = .006) => {
    const source = context.createBufferSource(), filter = context.createBiquadFilter();
    source.buffer = noiseBuffer(context);
    source.loop = true;
    filter.type = type;
    filter.Q.value = .7;
    filter.frequency.setValueAtTime(frequency, now + delay);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, end), now + delay + length);
    nodes.push(filter);
    source.connect(filter).connect(envelope(delay, length, gain, attack));
    sourceLife(source, delay, length);
  };
  const chime = (notes: readonly number[], spacing = .075, gain = .09, length = .3) => {
    notes.forEach((frequency, index) => tone(frequency, frequency * .998, length, gain, 'sine', index * spacing));
  };

  switch (cue) {
    case 'ui': tone(520, 410, .055, .065); break;
    case 'select': chime([392, 588], .04, .07, .14); break;
    case 'cancel': tone(310, 210, .13, .07, 'triangle'); break;
    case 'equip':
      noise(1700, 800, .09, .1); chime([620, 910], .018, .075, .19); break;
    case 'loot': chime([392, 494, 659], .08, .11, .4); break;
    case 'coin': chime([1318, 1760], .035, .065, .2); break;
    case 'step':
      noise(430, 160, .095, .11, 0, 'lowpass'); tone(88, 52, .075, .08); break;
    case 'chest':
      noise(310, 760, .25, .17, 0, 'lowpass'); tone(96, 67, .24, .12, 'triangle');
      chime([620, 830], .06, .075, .25); break;
    case 'well':
      tone(340, 680, .22, .11); tone(510, 310, .29, .075, 'sine', .13);
      noise(1700, 600, .35, .05); break;
    case 'portal':
      noise(220, 1900, .7, .13, 0, 'bandpass', .15);
      tone(130, 520, .7, .085, 'triangle'); tone(196, 785, .6, .055, 'sine', .1); break;
    case 'stairs':
      noise(500, 180, .13, .12, 0, 'lowpass'); noise(420, 140, .15, .1, .16, 'lowpass'); break;
    case 'campfire':
      noise(450, 180, .55, .09, 0, 'lowpass');
      [0, .13, .31].forEach((delay, index) => noise(2000 + index * 370, 1000, .05, .065, delay)); break;
    case 'bossArrival':
      tone(110, 55, 1.1, .16, 'triangle'); tone(164, 82, .9, .075, 'sine', .07);
      noise(380, 80, .85, .13, 0, 'lowpass', .06); break;
    case 'dice':
      [0, .045, .105, .18].forEach((delay, index) => {
        noise(1600 - index * 190, 600, .045, .095, delay);
        tone(710 - index * 95, 240, .038, .04, 'triangle', delay);
      }); break;
    case 'turn': chime([330, 440], .04, .045, .16); break;
    case 'sword':
      noise(850, 3400, .23, .17, 0, 'bandpass', .045); tone(690, 380, .14, .055, 'triangle', .07); break;
    case 'dagger':
      noise(1900, 4200, .13, .12, 0, 'bandpass', .025); tone(930, 590, .085, .045, 'triangle'); break;
    case 'heavy':
      noise(400, 110, .31, .2, 0, 'lowpass', .028); tone(140, 48, .28, .19, 'triangle'); break;
    case 'bow':
      tone(360, 110, .14, .14, 'triangle'); noise(2400, 750, .2, .11, .035); break;
    case 'staff':
      tone(145, 89, .19, .11, 'triangle'); chime([392, 587], .055, .055, .26); break;
    case 'magic':
      tone(220, 620, .31, .08, 'triangle'); tone(330, 925, .27, .05, 'sine', .03);
      noise(1200, 2500, .3, .04); break;
    case 'fire':
      noise(1600, 140, .42, .26, 0, 'lowpass', .025); tone(105, 40, .3, .09, 'triangle'); break;
    case 'frost':
      chime([1174, 1760, 2348], .04, .055, .34); noise(5000, 2100, .24, .065, 0, 'highpass'); break;
    case 'lightning':
      noise(4200, 700, .16, .24); tone(180, 48, .13, .085, 'sawtooth');
      noise(2600, 1200, .075, .1, .11); break;
    case 'nature':
      noise(800, 2200, .4, .085, 0, 'bandpass', .065);
      tone(392, 522, .28, .065); tone(587, 660, .2, .045, 'sine', .1); break;
    case 'holy': chime([523, 784, 1046], .045, .075, .47); break;
    case 'shadow':
      noise(1200, 130, .48, .16, 0, 'bandpass', .085); tone(130, 65, .43, .105, 'triangle'); break;
    case 'blood':
      tone(190, 62, .19, .15); noise(850, 260, .22, .16, .025, 'lowpass'); break;
    case 'arcane':
      tone(294, 588, .31, .085, 'triangle'); tone(440, 880, .36, .07);
      tone(622, 932, .28, .04, 'sine', .04); break;
    case 'heal': chime([440, 554, 740], .065, .075, .42); break;
    case 'shield':
      chime([330, 496, 990], .025, .07, .35); noise(1800, 520, .25, .055); break;
    case 'aura':
      tone(220, 277, .45, .045); tone(330, 415, .38, .035, 'sine', .04);
      noise(2100, 950, .35, .035, 0, 'bandpass', .09); break;
    case 'hit':
      noise(650, 150, .14, .23, 0, 'lowpass'); tone(130, 48, .13, .15); break;
    case 'critical':
      noise(1500, 150, .24, .24, 0, 'lowpass'); tone(170, 42, .23, .18, 'triangle');
      tone(880, 350, .17, .065, 'triangle'); break;
    case 'block':
      chime([710, 1103], .012, .075, .2); noise(2300, 600, .085, .12); break;
    case 'dodge': noise(800, 3200, .21, .085, 0, 'bandpass', .03); break;
    case 'death':
      noise(420, 90, .55, .16, 0, 'lowpass'); tone(146, 42, .58, .135, 'triangle'); break;
    case 'victory':
      chime([294, 370, 440, 587], .13, .12, .64); tone(147, 147, .8, .05, 'triangle'); break;
    case 'defeat':
      chime([294, 247, 196, 147], .16, .09, .62); tone(73, 55, .9, .07, 'triangle'); break;
    case 'flee':
      noise(1300, 200, .37, .1); tone(440, 220, .28, .07, 'triangle'); break;
    default: {
      const exhaustive: never = cue;
      void exhaustive;
    }
  }
  if (!sources.size) disconnect();
  return {
    duration,
    stop() {
      if (stopped) return;
      stopped = true;
      for (const source of sources) {
        source.onended = null;
        try { source.stop(); } catch { /* A source may have ended between frames. */ }
      }
      sources.clear();
      disconnect();
    },
  };
}
