// Track definitions. Each track is a Tone.js synth tuned to sound like its
// drum role, plus a trigger function that knows the right note/duration/
// velocity to fire it.
//
// The trigger accepts a `time` argument so we can schedule it sample-accurately
// from inside a Tone.Sequence callback — see engine.svelte.ts.

import * as Tone from 'tone';

// `any` here because Tone.js's `Instrument` type isn't part of its public
// export surface; the four synth classes we use (MembraneSynth, NoiseSynth,
// MetalSynth) don't share a useful common interface for triggerAttackRelease
// (NoiseSynth's signature omits the note arg), so we cast at the call site.
export type TrackInstrument = any;

export type TrackDef = {
  id: string;
  name: string;
  color: string;
  buildSynth: () => TrackInstrument;
  trigger: (synth: TrackInstrument, time: number) => void;
};

export const TRACKS: TrackDef[] = [
  {
    id: 'kick',
    name: 'KICK',
    color: '#ff3e00',
    buildSynth: () =>
      new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
      }),
    // MembraneSynth: triggerAttackRelease(note, duration, time, velocity)
    trigger: (s, time) => (s as any).triggerAttackRelease('C2', '8n', time)
  },
  {
    id: 'snare',
    name: 'SNARE',
    color: '#e5468b',
    buildSynth: () =>
      new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0 }
      }),
    // NoiseSynth: triggerAttackRelease(duration, time, velocity) — no note arg!
    trigger: (s, time) => (s as any).triggerAttackRelease('16n', time, 0.6)
  },
  {
    id: 'hat',
    name: 'HAT',
    color: '#2dbfb8',
    buildSynth: () =>
      new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5
      }),
    trigger: (s, time) => (s as any).triggerAttackRelease('C6', '32n', time, 0.18)
  },
  {
    id: 'perc',
    name: 'PERC',
    color: '#9b6cff',
    buildSynth: () =>
      new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.12, release: 0.01 },
        harmonicity: 8,
        modulationIndex: 16,
        resonance: 8000,
        octaves: 0.5
      }),
    trigger: (s, time) => (s as any).triggerAttackRelease('C5', '16n', time, 0.25)
  }
];
