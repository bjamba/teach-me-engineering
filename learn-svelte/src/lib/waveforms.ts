/**
 * Per-module waveform signatures.
 *
 * Each module gets a unique drum-hit-style SVG path that conveys the module's
 * personality: M1 is a kick (foundation), M2 is a tap pattern, M3 is a clean
 * sine (the metronome's tick), M4 is a chord shape (multiple peaks), etc.
 * Same viewBox (24×12) for every signature.
 */

export type Waveform = {
  paths: string[];
  strokeWidth?: number;
};

export const VIEWBOX = '0 0 24 12';

export const waveforms: Record<string, Waveform> = {
  // M01 — Hello, Svelte. Kick: attack + decay envelope.
  '01-hello-svelte': {
    paths: ['M 0 6 L 3 6 L 4 1 L 5 11 L 6 3 L 7 9 L 8 5 L 9 7 L 10 6 L 24 6']
  },

  // M02 — Tap Tempo Detective. Discrete vertical taps at irregular intervals.
  '02-tap-tempo-detective': {
    paths: [
      'M 0 11 L 24 11',
      'M 2 11 L 2 3', 'M 6 11 L 6 4', 'M 9 11 L 9 5',
      'M 13 11 L 13 3', 'M 16 11 L 16 5', 'M 20 11 L 20 4', 'M 23 11 L 23 5'
    ],
    strokeWidth: 1.4
  },

  // M03 — Metronome Studio. Steady, even sine — the metronome's regular tick.
  '03-metronome-studio': {
    paths: ['M 0 6 Q 1.5 1 3 6 T 6 6 T 9 6 T 12 6 T 15 6 T 18 6 T 21 6 T 24 6']
  },

  // M04 — Chord Player. Stacked notes — three peaks at different heights.
  '04-chord-player': {
    paths: [
      'M 0 8 L 24 8',
      'M 4 8 L 4 5', 'M 4 5 L 8 5', 'M 8 5 L 8 8',
      'M 10 8 L 10 3', 'M 10 3 L 14 3', 'M 14 3 L 14 8',
      'M 16 8 L 16 6', 'M 16 6 L 20 6', 'M 20 6 L 20 8'
    ],
    strokeWidth: 1.3
  },

  // M05 — Practice Journal. Routes/branches: lines that cross.
  '05-practice-journal': {
    paths: [
      'M 0 3 L 24 3',
      'M 0 6 L 10 6 L 13 9 L 24 9',
      'M 0 9 L 10 9 L 13 6 L 24 6'
    ],
    strokeWidth: 1.2
  },

  // M06 — Capstone Foundations. Step pattern — vertical bars at varying heights.
  '06-capstone-foundations': {
    paths: [
      'M 0 11 L 24 11',
      'M 1 11 L 1 6', 'M 4 11 L 4 4', 'M 7 11 L 7 7',
      'M 10 11 L 10 3', 'M 13 11 L 13 5', 'M 16 11 L 16 7',
      'M 19 11 L 19 4', 'M 22 11 L 22 6'
    ],
    strokeWidth: 1.4
  },

  // M07 — Capstone Polish. Filter sweep — modulated amplitude wave.
  '07-capstone-polish': {
    paths: ['M 0 6 L 2 5 L 4 7 L 6 3 L 8 9 L 10 1 L 12 11 L 14 1 L 16 11 L 18 3 L 20 9 L 22 5 L 24 7']
  },

  // M08 — Ship & Synthesis. Final crash — big transient, decays to a single line.
  '08-ship-and-synthesis': {
    paths: ['M 0 6 L 1 1 L 2 11 L 3 1 L 4 11 L 5 2 L 6 10 L 7 3 L 8 9 L 9 4 L 10 8 L 11 5 L 12 7 L 13 5 L 14 6 L 24 6']
  }
};

export function getWaveform(slug: string): Waveform | null {
  return waveforms[slug] ?? null;
}

export function approxLength(wf: Waveform): number {
  let total = 0;
  for (const p of wf.paths) {
    const tokens = p.match(/[ML]\s*-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?/g) ?? [];
    let lastX = 0, lastY = 0, hasLast = false;
    for (const tok of tokens) {
      const m = tok.match(/[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
      if (!m) continue;
      const nx = parseFloat(m[1]), ny = parseFloat(m[2]);
      if (hasLast && tok[0] === 'L') {
        const dx = nx - lastX;
        const dy = ny - lastY;
        total += Math.sqrt(dx * dx + dy * dy);
      }
      lastX = nx;
      lastY = ny;
      hasLast = true;
    }
  }
  return total;
}
