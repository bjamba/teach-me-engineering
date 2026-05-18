/**
 * Site-wide audio cue manager.
 *
 * Why this is opt-in: audio in technical sites is normally annoying. Here it
 * is annoying-by-default unless the learner asks for it. The toggle lives in
 * the title bar; once on, every interaction across the site fires a small,
 * musical cue. The cue palette uses the same Tone.js the capstone uses, so
 * by the time you reach Module 6 you've already heard what you're going to
 * be programming.
 *
 * The cues themselves stay quiet (low gain, short envelope) so you can leave
 * them on while you read without going crazy.
 */

import { browser } from '$app/environment';

const NS = 'svelte_';
const ENABLED_KEY = `${NS}audio_enabled`;

export type Cue =
  | 'click'        // generic UI click — minor
  | 'select'       // selecting / opening — pleasant ping
  | 'hover'        // very subtle, used sparingly
  | 'complete'     // marking a lesson complete — chord
  | 'module_done'  // finishing a module — bigger chord
  | 'pip'          // sandbox compile success — high tick
  | 'thud'         // panel expand / heavy ui — low thud
  | 'sweep';       // theme toggle / page transition — short sweep

class AudioCues {
  enabled = $state(false);
  ready = $state(false);
  loading = $state(false);
  private Tone: any = null;
  private synths: Record<string, any> = {};
  private gain: any = null;
  private bound = false;

  constructor() {
    if (!browser) return;
    const saved = localStorage.getItem(ENABLED_KEY);
    if (saved === 'true') {
      this.enabled = true;
      // Don't auto-load Tone here; AudioContext requires user gesture. We'll
      // lazy-init on first play() call after the first interaction.
    }
  }

  private bindPersistence() {
    if (this.bound || !browser) return;
    this.bound = true;
    $effect.root(() => {
      $effect(() => {
        try {
          localStorage.setItem(ENABLED_KEY, String(this.enabled));
        } catch {
          // ignore storage failures
        }
      });
    });
  }

  /** Build the synth bank. Call only after Tone.start() has succeeded. */
  private buildSynths() {
    if (Object.keys(this.synths).length) return;
    const T = this.Tone;
    this.gain = new T.Gain(0.25).toDestination();

    // Short, percussive square — UI clicks.
    this.synths.click = new T.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.04 },
      volume: -10
    }).connect(this.gain);

    // Soft sine pad — selections.
    this.synths.pad = new T.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.18 },
      volume: -8
    }).connect(this.gain);

    // Polysynth — chords for completes.
    this.synths.poly = new T.PolySynth(T.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.25, sustain: 0.05, release: 0.4 },
      volume: -10
    }).connect(this.gain);

    // Noise burst — thuds.
    this.synths.noise = new T.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.07, sustain: 0 },
      volume: -16
    }).connect(this.gain);

    // High-frequency tick — pips.
    this.synths.tick = new T.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
      volume: -16
    }).connect(this.gain);
  }

  async ensureReady() {
    if (this.ready) return;
    if (!browser || !this.enabled) return;
    if (this.loading) return;
    this.loading = true;
    try {
      if (!this.Tone) {
        const mod: any = await import(
          /* @vite-ignore */ 'https://esm.sh/tone@15.0.4'
        );
        this.Tone = mod;
      }
      await this.Tone.start();
      this.buildSynths();
      this.ready = true;
    } catch {
      // Audio failed to init; stay silent. UI still toggles enabled state.
    } finally {
      this.loading = false;
    }
  }

  async enable() {
    this.bindPersistence();
    this.enabled = true;
    await this.ensureReady();
    // a small confirmation
    this.play('select');
  }

  disable() {
    this.enabled = false;
  }

  async toggle() {
    if (this.enabled) this.disable();
    else await this.enable();
  }

  play(cue: Cue) {
    if (!this.enabled) return;
    // If user opted in but audio hasn't been initialized yet (e.g. they
    // landed with audio_enabled=true persisted), spin up on first call.
    if (!this.ready) {
      void this.ensureReady().then(() => this.play(cue));
      return;
    }
    const s = this.synths;
    try {
      switch (cue) {
        case 'click':  s.click.triggerAttackRelease('A4', '32n'); break;
        case 'select': s.pad.triggerAttackRelease('E5', '16n'); break;
        case 'hover':  s.tick.triggerAttackRelease('B5', '64n', undefined, 0.3); break;
        case 'complete':    s.poly.triggerAttackRelease(['C4', 'E4', 'G4'], '8n'); break;
        case 'module_done': s.poly.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], '4n'); break;
        case 'pip':    s.tick.triggerAttackRelease('C6', '64n', undefined, 0.4); break;
        case 'thud':   s.noise.triggerAttackRelease('16n', undefined, 0.6); break;
        case 'sweep':  s.pad.triggerAttackRelease('A5', '32n', undefined, 0.4); break;
      }
    } catch {
      // synth failed; ignore
    }
  }
}

export const audio = new AudioCues();
