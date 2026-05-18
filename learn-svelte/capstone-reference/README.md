# Svelte DAW — capstone reference

The reference implementation of the capstone project from modules **M6
(Capstone Foundations)** and **M7 (Capstone Polish)** of the Make / Svelte
curriculum. A 4-track step sequencer with effects, mixer, FFT visualizer,
pattern sharing, and recording.

This is what your project should look and behave like when you've finished
M7. Compare your own code against this one — but resist the urge to copy it
verbatim. The learning is in writing it yourself.

## What's in it

- 4 drum tracks (kick, snare, hat, perc) — Tone.js synths, not samples.
- 4×16 step grid with click-to-toggle, per-track color, downbeat indicators.
- Sample-accurate Tone.Sequence playback with a visible playhead.
- Transport bar: PLAY/STOP, BPM slider, REC, current-step readout.
- Effect chain: lowpass filter, feedback delay, reverb — `rampTo`'d so
  dragging knobs doesn't click.
- Per-channel mixer: gain, pan, mute, solo (with proper solo logic).
- Live FFT visualizer below the grid, 60fps canvas.
- Pattern persistence: auto-save the current pattern to `localStorage` +
  named saved slots.
- Pattern sharing via URL (`/share/<base64url>/`).
- Recording: MediaRecorder taps the master gain, blobs stored in
  IndexedDB, downloadable as `.webm`.
- An `/embed` route exposing just the sequencer + transport + FFT for
  embedding elsewhere.

## Run it locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5181`). Click PLAY.
You should hear the default pattern; the playhead lights up cells as it sweeps.

If the first click doesn't produce sound, that's the browser's
gesture-required behavior — the Web Audio context only starts in response
to a user interaction. Click again.

## Project layout

```
src/
├── app.html, app.css           — design tokens
├── lib/
│   ├── audio/
│   │   ├── tracks.ts           — synth definitions per track
│   │   ├── engine.svelte.ts    — singleton AudioEngine (state + plumbing)
│   │   ├── encoding.ts         — base64url encode/decode for sharing
│   │   └── idb.ts              — IndexedDB wrapper for recording blobs
│   └── components/
│       ├── Sequencer.svelte
│       ├── TransportBar.svelte
│       ├── EffectPanels.svelte
│       ├── Mixer.svelte
│       ├── FftVisualizer.svelte
│       ├── SavedPatterns.svelte
│       └── Recordings.svelte
└── routes/
    ├── +layout.svelte / +layout.ts   — global CSS, ssr=false
    ├── +page.svelte                  — main DAW UI
    ├── share/[encoded]/              — load a pattern from a shared URL
    └── embed/                        — sequencer-only embed mode
```

## Audio routing

```
synth[id] → gain[id] → pan[id] ─┐
                                ├─→ filter → delay → reverb → master → destination
synth[id] → gain[id] → pan[id] ─┘                                  └─→ analyser   (passive)
                                                                   └─→ mediaDest  (when recording)
```

Per-track gain + pan first, then the global effects bus, then the master.
The analyser and recording destination are passive side-chains off the master.

## Deploy to GitHub Pages

This project uses `@sveltejs/adapter-static` with `fallback: 'index.html'`
so the share/embed routes work as SPA navigations on a static host.

1. Push to GitHub.
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. (Optional) If you're publishing under a project URL like
   `https://<user>.github.io/<repo>/`, set a repository variable named
   `BASE_PATH` to `/<repo>` (e.g. `/svelte-daw`). For a domain-root
   deploy (user/organization Pages) leave it unset.
4. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds
   and publishes.

The build step copies `index.html` to `404.html` so GitHub Pages serves
the SPA shell on deep links.

## Notes on a few non-obvious bits

- **Reactivity discipline.** Every `$effect` reads its reactive dependencies
  into local `const`s before any conditional. If you put the read inside an
  `if (isReady)` short-circuit, the effect's dependency tracker may miss
  the value on the first run and never re-fire when it changes.

- **Singleton-scope effects.** The audio engine is a module-level instance,
  not a component, so its effects live inside `$effect.root(...)` — without
  that wrapper, `$effect` errors with "outside component context."

- **MediaStreamAudioDestinationNode.** Web Audio's recording destination
  only exists on the raw `AudioContext`, not on Tone's wrapper. We reach
  through `(Tone.getContext() as any).rawContext as AudioContext` to get it.

- **Solo logic.** Each channel's gain effect reads its own `gain`, its own
  `muted`, AND iterates every channel's `solo` so the tracker subscribes
  to all of them. Flipping `kick.solo` re-runs the gain effects for every
  channel — exactly what we want.

- **Vertical faders.** Browsers disagree about whether the right incantation
  is `appearance: slider-vertical`, `writing-mode: vertical-lr`, or both.
  We set both to cover Chrome/Safari/Firefox.

## Out of scope (by design)

- No tests. The lessons walk through manual testing in the dev server.
- No light theme — studio aesthetic only.
- No pre-bundled sample recording or starter blob — you make your own
  recording on first run.
- No mobile-optimized UI — works on desktop; the grid is usable on phones
  but the mixer fader strip will scroll horizontally.

## License

MIT, matching the curriculum.
