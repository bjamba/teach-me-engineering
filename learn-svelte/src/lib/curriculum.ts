/**
 * The curriculum spine. Single source of truth for module/lesson titles,
 * order, slugs, colors, and waveform-signature mappings.
 *
 * The curriculum is structured as a build-along: each non-capstone module
 * has the learner build a small music-themed app, with concepts introduced
 * as they're needed. The capstone (M6–M7) is the DAW.
 */

export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export type Lesson = {
  slug: string;
  title: string;
  blurb: string;
  minutes: number;
};

export type Module = {
  slug: string;
  number: number;
  title: string;
  tagline: string;
  /** Module signature color, used as accent across that module's lessons. */
  color: string;
  /** Companion track verb shown in the sidebar. */
  verb: string;
  lessons: Lesson[];
};

export const curriculum: Module[] = [
  {
    slug: '01-hello-svelte',
    number: 1,
    title: 'Hello, Svelte',
    tagline: 'Your first component, your first $state, and a peek at what the compiler did.',
    color: '#ff3e00',
    verb: 'hello',
    lessons: [
      { slug: '01-hello-component', title: 'Your First Component', blurb: 'Set up the project, ship a working hello-world component, run it.', minutes: 20 },
      { slug: '02-state-and-counter', title: '$state and Your First Counter', blurb: 'Add a button, a number, an increment. Your first reactive value.', minutes: 25 },
      { slug: '03-many-counters', title: 'Many Counters and the Compiler’s Trick', blurb: 'Split the counter into a component, render several, look at the compiled JS.', minutes: 30 }
    ]
  },
  {
    slug: '02-tap-tempo-detective',
    number: 2,
    title: 'Tap Tempo Detective',
    tagline: 'Build a tap-tempo BPM detector. Five lessons, one working app, four runes used in anger.',
    color: '#e5468b',
    verb: 'tap',
    lessons: [
      { slug: '01-first-tap', title: 'Capture a Tap', blurb: 'A button that records the time it was pressed. Hello, $state.', minutes: 25 },
      { slug: '02-list-of-taps', title: 'A List of Taps and a Reset', blurb: 'Push to an array, clear the array. Mutating reactive arrays.', minutes: 25 },
      { slug: '03-derive-bpm', title: 'Derive the BPM with $derived', blurb: 'Compute the average interval between taps. Your first $derived.', minutes: 30 },
      { slug: '04-persist', title: 'Persist with $effect', blurb: 'Save the most recent tap session to localStorage. Your first $effect (and when not to use one).', minutes: 30 },
      { slug: '05-guess-mode', title: 'Guess the Tempo Mode', blurb: 'A small game: how close can you tap to a target BPM? Conditionals, classes, polish.', minutes: 35 }
    ]
  },
  {
    slug: '03-metronome-studio',
    number: 3,
    title: 'Metronome Studio',
    tagline: 'Build a metronome with subdivisions, accent patterns, and a click that actually feels good.',
    color: '#4a8fe7',
    verb: 'tick',
    lessons: [
      { slug: '01-first-tick', title: 'A Ticking Sound (Tone.js, hello)', blurb: 'Load Tone.js. Trigger a sample on a fixed interval. The audio thread vs. setInterval.', minutes: 30 },
      { slug: '02-bpm-knob', title: 'BPM Knob and a Visual Click', blurb: 'A slider bound to BPM, a flashing dot synchronized to the click.', minutes: 30 },
      { slug: '03-components', title: 'Splitting into Components and Props', blurb: 'Extract <BpmDial>, <ClickIndicator>, <TransportButton>. Pass props.', minutes: 35 },
      { slug: '04-subdivisions', title: 'Subdivisions and Snippets', blurb: 'Pick quarter / eighth / triplet / sixteenth notes. Snippets to render the subdivision picker.', minutes: 30 },
      { slug: '05-spring-and-style', title: 'Spring Physics and Scoped Styles', blurb: 'A click indicator with spring motion. Scoped CSS, custom properties for theming.', minutes: 35 }
    ]
  },
  {
    slug: '04-chord-player',
    number: 4,
    title: 'Chord Player',
    tagline: 'Build a tool that lets you click-build a chord progression and play it back.',
    color: '#5bc85a',
    verb: 'play',
    lessons: [
      { slug: '01-play-a-chord', title: 'Play One Chord', blurb: 'A polysynth, a button, a triad. Choose root + quality, hear it.', minutes: 30 },
      { slug: '02-progression', title: 'A Progression You Can Edit', blurb: 'A list of chords, click to insert, click to remove. Lists and keying.', minutes: 35 },
      { slug: '03-bindable', title: 'Two-Way Binding with $bindable', blurb: 'A <ChordPicker /> component the parent binds to. Two-way data flow done right.', minutes: 30 },
      { slug: '04-shared-state', title: 'Shared State with .svelte.ts', blurb: 'Move the progression state out of components into a shared module. The Svelte 5 answer to stores.', minutes: 30 },
      { slug: '05-save-and-share', title: 'Save Progressions and Share via URL', blurb: 'localStorage for your own, URL-encoding for sharing. The same pattern the DAW will use.', minutes: 35 }
    ]
  },
  {
    slug: '05-practice-journal',
    number: 5,
    title: 'Practice Journal (SvelteKit)',
    tagline: 'Take what you know about Svelte and put it on a real app framework. Build a tool to track what you practice.',
    color: '#f5b100',
    verb: 'track',
    lessons: [
      { slug: '01-routing', title: 'Routing and Layouts in SvelteKit', blurb: 'Filesystem routing. Migrate one of your earlier apps onto SvelteKit.', minutes: 35 },
      { slug: '02-load', title: 'Load Functions for Songs and Sessions', blurb: 'Where data comes from. +page.ts vs +page.server.ts. The mental model.', minutes: 40 },
      { slug: '03-form-actions', title: 'Logging a Practice Session', blurb: 'Form actions: server-side handling that works without JavaScript, smoother with it.', minutes: 35 },
      { slug: '04-render-modes', title: 'About Page Prerendered, Dashboard SSR', blurb: 'Per-route render mode flags. The most underrated SvelteKit feature.', minutes: 30 },
      { slug: '05-deploy', title: 'Adapter, Action, Pages: Live', blurb: 'Static adapter, GitHub Action, your practice journal deployed to a real URL.', minutes: 30 }
    ]
  },
  {
    slug: '06-capstone-foundations',
    number: 6,
    title: 'Capstone — DAW Foundations',
    tagline: 'Now build the real thing. A 4-track step sequencer with persistence and recording. Five lessons, one substantial project.',
    color: '#ff6b4a',
    verb: 'build',
    lessons: [
      { slug: '01-setup', title: 'Project Setup and the Audio Engine Class', blurb: 'Scaffold a SvelteKit project. Build the singleton audio engine in .svelte.ts.', minutes: 45 },
      { slug: '02-step-grid', title: 'Build the 4×16 Step Grid', blurb: 'Toggle cells, see them light up. Per-track color, per-cell reactivity.', minutes: 50 },
      { slug: '03-sequence', title: 'Tone.Sequence and Sample-Accurate Playback', blurb: 'Wire up the audio thread. Make the playhead actually advance and trigger sounds.', minutes: 60 },
      { slug: '04-patterns', title: 'Save and Share Patterns', blurb: 'localStorage for your own, URL-encoded for sharing. (You’ve done this once already.)', minutes: 45 },
      { slug: '05-recording', title: 'Record Output to a Downloadable File', blurb: 'MediaRecorder taps the master gain. IndexedDB for blobs. A real audio export.', minutes: 60 }
    ]
  },
  {
    slug: '07-capstone-polish',
    number: 7,
    title: 'Capstone — DAW Polish',
    tagline: 'Effects, mixer, FFT visualizer, performance. The DAW from "works" to "feels good."',
    color: '#9b6cff',
    verb: 'polish',
    lessons: [
      { slug: '01-effects', title: 'Filter, Delay, Reverb', blurb: 'A reactive effect chain. Knobs bound to Tone parameters, ramping for smoothness.', minutes: 60 },
      { slug: '02-mixer', title: 'Per-Channel Mixer with Mute and Solo', blurb: 'Where per-cell reactivity actually pays off. 16 reactive cells, no full re-renders.', minutes: 50 },
      { slug: '03-fft', title: 'Live FFT Visualizer Below the Grid', blurb: 'A canvas reading from Tone.Analyser. Animation loops at 60fps without storming the rune system.', minutes: 45 },
      { slug: '04-pulses', title: '60fps Pulses Without Effect Storms', blurb: 'When to use $state for animation, when not to. The rule that prevents reactivity bugs.', minutes: 45 },
      { slug: '05-profile', title: 'Profile and Optimize', blurb: 'DevTools. Svelte inspector. The audio thread vs main thread. Find a real bottleneck and fix it.', minutes: 40 }
    ]
  },
  {
    slug: '08-ship-and-synthesis',
    number: 8,
    title: 'Ship It & Synthesis',
    tagline: 'Deploy the DAW. Make it shareable. Walk away with both the build and the why.',
    color: '#ec4040',
    verb: 'ship',
    lessons: [
      { slug: '01-deploy-daw', title: 'Deploy the DAW', blurb: 'Static adapter, BASE_PATH, GitHub Action. Your DAW goes live in 30 minutes.', minutes: 30 },
      { slug: '02-polish-share', title: 'Polish for Sharing: OG, PWA, Embed', blurb: 'Open Graph for link previews. PWA manifest for install. An embed route for sharing.', minutes: 45 },
      { slug: '03-synthesis', title: 'Why Svelte: A Working Synthesis', blurb: 'A single honest page on Svelte’s strengths and weaknesses, with React/Vue/Solid/Qwik for context. Enough to defend or critique your choice with confidence.', minutes: 45 }
    ]
  }
];

export type LessonRef = {
  module: Module;
  lesson: Lesson;
  href: string;
  prev?: LessonRef;
  next?: LessonRef;
};

export function flattenLessons(): LessonRef[] {
  const refs: LessonRef[] = [];
  for (const module of curriculum) {
    for (const lesson of module.lessons) {
      refs.push({
        module,
        lesson,
        href: `/lessons/${module.slug}/${lesson.slug}`
      });
    }
  }
  for (let i = 0; i < refs.length; i++) {
    refs[i].prev = i > 0 ? refs[i - 1] : undefined;
    refs[i].next = i < refs.length - 1 ? refs[i + 1] : undefined;
  }
  return refs;
}

export function totalLessons(): number {
  return curriculum.reduce((n, m) => n + m.lessons.length, 0);
}

export function totalMinutes(): number {
  return curriculum.reduce(
    (n, m) => n + m.lessons.reduce((mm, l) => mm + l.minutes, 0),
    0
  );
}
