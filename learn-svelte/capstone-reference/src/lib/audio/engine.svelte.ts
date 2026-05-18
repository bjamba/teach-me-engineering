// The singleton audio engine. One instance for the whole app.
//
// Owns:
//   - The Tone.js master output and the per-track synths
//   - Pattern state ($state Record<trackId, number[]>)
//   - Transport state (isPlaying, bpm, currentStep)
//   - Per-channel mixer state (gain, pan, mute, solo)
//   - Global effect chain (filter → delay → reverb)
//   - localStorage auto-save + named saved slots
//   - MediaRecorder for capturing output to WebM blobs (stored in IndexedDB)
//   - A passive FFT analyser tap for the visualizer
//
// Audio routing:
//
//   synth[id] → gain[id] → pan[id] ─┐
//                                   ├→ filter → delay → reverb → master → destination
//   synth[id] → gain[id] → pan[id] ─┘                                  └→ analyser (passive)
//                                                                      └→ mediaDest (when recording)
//
// Reactivity rules-of-thumb used throughout:
//   1. Read $state values into a local `const` BEFORE any conditional, so the
//      effect's dependency tracker always sees the read on every run. If you
//      put the read inside a short-circuiting `if`, the first run may skip it
//      and the effect unsubscribes — later changes won't re-fire.
//   2. Module-singleton effects must live inside $effect.root() because there's
//      no component context.
//   3. Anything touching `window`, `localStorage`, `indexedDB`, or `Tone` at
//      module load time must be guarded with `if (browser)`.

import * as Tone from 'tone';
import { browser } from '$app/environment';
import { TRACKS, type TrackInstrument } from './tracks';
import { idbSave, idbList, idbDelete } from './idb';

export type SavedPattern = {
  id: string;
  name: string;
  pattern: Record<string, number[]>;
  bpm: number;
  savedAt: string;
};

export type Recording = {
  id: string;
  blob: Blob;
  durationSec: number;
  recordedAt: string;
};

type Channel = {
  id: string;
  gain: number; // 0..1
  pan: number; // -1..1
  muted: boolean;
  solo: boolean;
};

const LS_CURRENT = 'daw_current_v1';
const LS_SLOTS = 'daw_slots_v1';

class AudioEngine {
  // ----- reactive state -----

  isReady = $state(false);
  isLoading = $state(false);
  isPlaying = $state(false);
  isRecording = $state(false);
  bpm = $state(120);
  currentStep = $state(-1);
  loadError = $state<string | null>(null);

  pattern = $state<Record<string, number[]>>({
    kick:  [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
    hat:   [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    perc:  [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1]
  });

  // Per-channel mixer state.
  channels = $state<Record<string, Channel>>({
    kick:  { id: 'kick',  gain: 0.9, pan: 0,    muted: false, solo: false },
    snare: { id: 'snare', gain: 0.8, pan: 0.1,  muted: false, solo: false },
    hat:   { id: 'hat',   gain: 0.6, pan: -0.3, muted: false, solo: false },
    perc:  { id: 'perc',  gain: 0.7, pan: 0.4,  muted: false, solo: false }
  });

  // Effects.
  filterFreq = $state(8000);
  delayTime = $state(0.25);
  delayFeedback = $state(0.3);
  reverbWet = $state(0.15);
  masterVolume = $state(0.9);

  savedPatterns = $state<SavedPattern[]>([]);
  recordings = $state<Recording[]>([]);

  // ----- non-reactive audio plumbing -----

  private master: Tone.Gain | null = null;
  private filter: Tone.Filter | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private reverb: Tone.Reverb | null = null;
  private analyser: Tone.Analyser | null = null;

  private synths: Record<string, TrackInstrument> = {};
  private gainNodes: Record<string, Tone.Gain> = {};
  private panNodes: Record<string, Tone.Panner> = {};
  private sequence: Tone.Sequence | null = null;

  private mediaDest: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recordStartTime = 0;

  private effectScopeDispose: (() => void) | null = null;

  constructor() {
    if (!browser) return;

    // Restore last session state (pattern + bpm) before any effects run, so
    // their first read picks up the loaded values rather than the defaults.
    const saved = this.loadCurrent();
    if (saved) {
      this.pattern = saved.pattern;
      this.bpm = saved.bpm;
    }
    this.savedPatterns = this.loadSlots();

    // Module-level singleton: there's no component lifecycle, so we open a
    // long-lived root effect scope. We never call dispose — the engine lives
    // for the lifetime of the page.
    this.effectScopeDispose = $effect.root(() => {
      // ----- BPM sync -----
      $effect(() => {
        const next = this.bpm;
        if (this.isReady) Tone.Transport.bpm.value = next;
      });

      // ----- Auto-save current pattern + BPM to localStorage -----
      $effect(() => {
        // Read both deps unconditionally. The body is then conditional on
        // browser, but the reads already registered with the tracker.
        const p = this.pattern;
        const b = this.bpm;
        try {
          // $state.snapshot turns the live proxy into a plain object before
          // serialization. Without it, JSON.stringify still works but you'd
          // hit issues if you ever did structuredClone.
          const snapshot = {
            pattern: $state.snapshot(p),
            bpm: b
          };
          localStorage.setItem(LS_CURRENT, JSON.stringify(snapshot));
        } catch {
          /* quota exceeded — ignore */
        }
      });

      // ----- Effect parameter sync -----
      // Each effect parameter has its own $effect that rampTo's the new value
      // when the rune changes. The 0.05s ramp prevents zipper noise on drags.
      $effect(() => {
        const f = this.filterFreq;
        this.filter?.frequency.rampTo(f, 0.05);
      });
      $effect(() => {
        const t = this.delayTime;
        this.delay?.delayTime.rampTo(t, 0.05);
      });
      $effect(() => {
        const fb = this.delayFeedback;
        this.delay?.feedback.rampTo(fb, 0.05);
      });
      $effect(() => {
        const w = this.reverbWet;
        // Reverb.wet is a Signal but the type is `unknown` in some Tone
        // versions; cast through any to satisfy the compiler.
        (this.reverb?.wet as any)?.rampTo(w, 0.05);
      });
      $effect(() => {
        const v = this.masterVolume;
        this.master?.gain.rampTo(v, 0.05);
      });

      // ----- Per-channel mixer sync -----
      // One effect per channel concern. The gain effect combines gain + mute
      // + the global "any solo" derived value, so changing solo on one channel
      // re-runs the gain effects for ALL channels (which is what we want).
      for (const t of TRACKS) {
        const id = t.id;

        $effect(() => {
          const ch = this.channels[id];
          const g = ch.gain;
          const m = ch.muted;
          // anySolo derived from all channels — touch each .solo so the
          // tracker subscribes to all of them.
          let anySolo = false;
          for (const c of Object.values(this.channels)) {
            if (c.solo) anySolo = true;
          }
          const audible = !m && (!anySolo || ch.solo);
          this.gainNodes[id]?.gain.rampTo(audible ? g : 0, 0.02);
        });

        $effect(() => {
          const p = this.channels[id].pan;
          this.panNodes[id]?.pan.rampTo(p, 0.02);
        });
      }
    });
  }

  // ----- audio graph setup -----

  async ensureReady() {
    if (this.isReady || this.isLoading) return;
    this.isLoading = true;
    try {
      await Tone.start();

      // Build the graph back-to-front so each upstream node can call
      // `.connect(downstream)` on creation.
      this.master = new Tone.Gain(this.masterVolume).toDestination();

      // Passive FFT tap on the master. Connecting an analyser does not
      // double the audio — it's a side-chain.
      this.analyser = new Tone.Analyser('fft', 64);
      this.master.connect(this.analyser);

      this.reverb = new Tone.Reverb({ decay: 2, wet: this.reverbWet }).connect(this.master);
      this.delay = new Tone.FeedbackDelay(this.delayTime, this.delayFeedback).connect(
        this.reverb
      );
      this.filter = new Tone.Filter(this.filterFreq, 'lowpass').connect(this.delay);

      for (const t of TRACKS) {
        const ch = this.channels[t.id];
        this.gainNodes[t.id] = new Tone.Gain(ch.gain);
        this.panNodes[t.id] = new Tone.Panner(ch.pan);
        // synth → gain → pan → filter (effects bus)
        this.synths[t.id] = t.buildSynth();
        this.synths[t.id].connect(this.gainNodes[t.id]);
        this.gainNodes[t.id].connect(this.panNodes[t.id]);
        this.panNodes[t.id].connect(this.filter);
      }

      Tone.Transport.bpm.value = this.bpm;
      this.isReady = true;
    } catch (err) {
      this.loadError = (err as Error).message;
    } finally {
      this.isLoading = false;
    }
  }

  // ----- transport -----

  async play() {
    if (this.isPlaying) return;
    await this.ensureReady();
    if (!this.isReady) return;

    this.sequence = new Tone.Sequence(
      (time, step) => {
        for (const t of TRACKS) {
          if (this.pattern[t.id][step]) {
            // Mute/solo is handled by the per-channel gain effect ramping
            // the gain node to 0 — we still trigger the synth either way.
            // This keeps the sound graph stable and avoids click artifacts
            // from suddenly skipping triggers.
            t.trigger(this.synths[t.id], time);
          }
        }
        // Visual step update, sample-accurately scheduled.
        Tone.Draw.schedule(() => {
          this.currentStep = step;
        }, time);
      },
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      '16n'
    );
    this.sequence.start(0);
    Tone.Transport.start();
    this.isPlaying = true;
  }

  stop() {
    if (!this.isPlaying) return;
    Tone.Transport.stop();
    Tone.Transport.cancel();
    this.sequence?.dispose();
    this.sequence = null;
    this.isPlaying = false;
    this.currentStep = -1;
  }

  toggleTransport() {
    if (this.isPlaying) this.stop();
    else void this.play();
  }

  // ----- pattern editing -----

  toggleCell(trackId: string, step: number) {
    this.pattern[trackId][step] = this.pattern[trackId][step] ? 0 : 1;
  }

  clearPattern() {
    for (const t of TRACKS) {
      this.pattern[t.id] = new Array(16).fill(0);
    }
  }

  randomizePattern(density = 0.25) {
    for (const t of TRACKS) {
      this.pattern[t.id] = Array.from({ length: 16 }, () => (Math.random() < density ? 1 : 0));
    }
  }

  toggleMute(trackId: string) {
    const ch = this.channels[trackId];
    if (!ch) return;
    ch.muted = !ch.muted;
  }

  toggleSolo(trackId: string) {
    const ch = this.channels[trackId];
    if (!ch) return;
    ch.solo = !ch.solo;
  }

  // ----- saved slots -----

  saveAs(name: string) {
    const entry: SavedPattern = {
      id: crypto.randomUUID(),
      name,
      // structuredClone($state.snapshot(...)) — snapshot strips reactivity,
      // structuredClone deep-copies so future edits don't mutate the saved
      // entry.
      pattern: structuredClone($state.snapshot(this.pattern)) as Record<string, number[]>,
      bpm: this.bpm,
      savedAt: new Date().toISOString()
    };
    this.savedPatterns = [entry, ...this.savedPatterns];
    this.persistSlots();
  }

  loadSlot(id: string) {
    const entry = this.savedPatterns.find((p) => p.id === id);
    if (!entry) return;
    this.pattern = structuredClone(entry.pattern);
    this.bpm = entry.bpm;
  }

  deleteSlot(id: string) {
    this.savedPatterns = this.savedPatterns.filter((p) => p.id !== id);
    this.persistSlots();
  }

  applyPattern(pattern: Record<string, number[]>, bpm: number) {
    this.pattern = structuredClone(pattern);
    this.bpm = bpm;
  }

  private loadCurrent(): { pattern: Record<string, number[]>; bpm: number } | null {
    if (!browser) return null;
    try {
      const raw = localStorage.getItem(LS_CURRENT);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!parsed.pattern || typeof parsed.bpm !== 'number') return null;
      return { pattern: parsed.pattern, bpm: parsed.bpm };
    } catch {
      return null;
    }
  }

  private loadSlots(): SavedPattern[] {
    if (!browser) return [];
    try {
      const raw = localStorage.getItem(LS_SLOTS);
      return raw ? (JSON.parse(raw) as SavedPattern[]) : [];
    } catch {
      return [];
    }
  }

  private persistSlots() {
    if (!browser) return;
    try {
      localStorage.setItem(LS_SLOTS, JSON.stringify(this.savedPatterns));
    } catch {
      /* quota — ignore */
    }
  }

  // ----- recording -----

  async startRecording() {
    if (this.isRecording) return;
    await this.ensureReady();
    if (!this.master) return;

    if (!this.mediaDest) {
      // MediaStreamAudioDestinationNode lives on the RAW Web Audio context,
      // not the Tone wrapper. Reach through `(context as any).rawContext` to
      // get the underlying AudioContext.
      const ctx = (Tone.getContext() as any).rawContext as AudioContext;
      this.mediaDest = ctx.createMediaStreamDestination();
      this.master.connect(this.mediaDest);
    }

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.mediaDest.stream, {
      mimeType: 'audio/webm'
    });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.onstop = () => {
      void this.finalizeRecording();
    };
    this.mediaRecorder.start(100); // gather chunks every 100ms
    this.recordStartTime = Date.now();
    this.isRecording = true;
  }

  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;
    this.mediaRecorder.stop();
    this.isRecording = false;
  }

  toggleRecording() {
    if (this.isRecording) this.stopRecording();
    else void this.startRecording();
  }

  private async finalizeRecording() {
    const blob = new Blob(this.chunks, { type: 'audio/webm' });
    const recording: Recording = {
      id: crypto.randomUUID(),
      blob,
      durationSec: (Date.now() - this.recordStartTime) / 1000,
      recordedAt: new Date().toISOString()
    };
    this.recordings = [recording, ...this.recordings];
    try {
      await idbSave(recording);
    } catch (err) {
      console.warn('Failed to persist recording:', err);
    }
  }

  async loadRecordings() {
    try {
      this.recordings = await idbList();
    } catch (err) {
      console.warn('Failed to load recordings:', err);
    }
  }

  async deleteRecording(id: string) {
    try {
      await idbDelete(id);
    } catch (err) {
      console.warn('Failed to delete recording:', err);
    }
    this.recordings = this.recordings.filter((r) => r.id !== id);
  }

  // ----- accessors -----

  trigger(trackId: string, time?: number) {
    const t = TRACKS.find((x) => x.id === trackId);
    const synth = this.synths[trackId];
    if (!t || !synth) return;
    t.trigger(synth, time ?? Tone.now());
  }

  getFftData(): Float32Array | null {
    return this.analyser ? (this.analyser.getValue() as Float32Array) : null;
  }

  get masterGain() {
    return this.master;
  }
}

export const audio = new AudioEngine();
