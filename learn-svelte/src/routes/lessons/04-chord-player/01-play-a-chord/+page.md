<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Play One Chord · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-4);">

<LessonHeader
  moduleSlug="04-chord-player"
  lessonSlug="01-play-a-chord"
  title="Play One Chord"
  blurb="A polysynth, a button, a triad. Pick root + quality, hear it. The first lesson of a chord-progression builder you'll finish in five."
/>

## Why this lesson exists

The two previous modules taught timing (tap tempo) and scheduling (a metronome). This module is about pitch — playing notes together at the same time so they sound like a chord, then strung together so they sound like a song.

Module 4 builds, over five lessons, a chord progression player. The progression is editable in the browser, persisted to localStorage so it survives a refresh, and shareable through a URL anyone can open. The Svelte features that show up along the way — `<select bind:value>` with object values, keyed `{#each}` blocks, `$bindable` props, `.svelte.ts` shared state modules, `$effect.root` outside a component — are exactly the cluster you'd reach for in any non-trivial single-page app. The chord player is the excuse to teach them.

This first lesson is small. One chord, two dropdowns, one button. You'll learn how to drive Tone.js's polyphonic synth, how Svelte's binding handles non-string values in a `<select>`, and how a few lines of MIDI arithmetic gets you from "C major" to the three notes that actually play.

## Learning objectives

By the end of this lesson you'll be able to:

- Instantiate a `Tone.PolySynth` and trigger a chord with `triggerAttackRelease`.
- Bind a `<select>` element to a `$state` variable where the option values are objects, not strings.
- Convert a root note and a quality (a list of semitone intervals) into the actual note names you need to play.
- Explain why `Tone.start()` must run inside a user gesture handler and what happens if it doesn't.

## Concept 1: PolySynth and triggering a chord

### What it is

`Tone.Synth` plays one note at a time. Call `triggerAttackRelease` twice in quick succession and the second note replaces the first — the synth has one voice and you just stole it.

A chord is multiple notes at the same time. To play three notes simultaneously you need either three separate `Tone.Synth` instances or, more conveniently, a `Tone.PolySynth` — a polyphonic wrapper that allocates voices on demand. You pass it the voice class it should use internally (`Tone.Synth` here, but it could be `Tone.FMSynth`, `Tone.AMSynth`, anything that implements the voice interface) and it spins up as many copies as the chord needs.

`triggerAttackRelease` on a PolySynth accepts either a single note string or an array of note strings. Pass `['C4', 'E4', 'G4']` and the synth plays a C major chord, releasing all three notes after the duration you specified.

### Worked example

```js
import * as Tone from 'tone';

let synth = null;

async function play() {
  await Tone.start();
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.6 }
    }).toDestination();
  }
  synth.triggerAttackRelease(['C4', 'E4', 'G4'], '1n');
}
```

Line by line:

- `await Tone.start()` resumes the underlying `AudioContext`. Browsers refuse to start audio until the user has interacted with the page, so this must run inside a click (or keypress, or touch) handler. If you call it on page load you get a console warning and silence.
- The `if (!synth)` guard means we instantiate the PolySynth lazily, only once. Creating a synth on every click would leak audio nodes and eventually crash the tab.
- The second argument to the `PolySynth` constructor is the options bag passed through to each voice. `attack: 0.02` makes the note start almost immediately (no fade-in). `release: 0.6` gives it a soft tail when the note ends.
- `.toDestination()` wires the synth's output into the speakers. Without this, the synth produces sound that goes nowhere.
- `triggerAttackRelease(notes, '1n')` plays the notes for one whole note (`1n`) at the current Tone transport tempo. Strings like `'2n'` (half note), `'4n'` (quarter), `'8n'` (eighth) all work. You can also pass a number of seconds: `0.5`.

### Variations

A different voice for a darker sound:

```js
synth = new Tone.PolySynth(Tone.FMSynth).toDestination();
```

`Tone.FMSynth` is a frequency-modulation voice with a more metallic timbre. The PolySynth API is the same — you only swap the voice class.

A slower attack and longer release for a pad-like sound:

```js
synth = new Tone.PolySynth(Tone.Synth, {
  envelope: { attack: 0.4, decay: 0.5, sustain: 0.6, release: 1.5 }
}).toDestination();
```

The chord now swells in over 400ms and fades out over 1.5 seconds. The sound becomes less percussive and more sustained.

Setting volume independent of the system:

```js
synth = new Tone.PolySynth(Tone.Synth).toDestination();
synth.volume.value = -12; // dB; -Infinity is silent, 0 is unity
```

Tone.js works in decibels. `-12` is roughly a quarter of the loudness of `0`. Pulling the synth down avoids clipping when several voices fire at once.

### Common mistakes

- **"No sound and no error."** Almost always `Tone.start()` not being called inside a user gesture. Move it into the click handler. The browser will not surface this as an error; it just silently refuses.
- **A new synth on every click.** You forgot the `if (!synth)` guard. Symptom: the page gets slower over time, eventually freezes the audio output entirely.
- **Forgot `.toDestination()`.** The synth runs but its output isn't connected to anything. No sound, no error. Always chain `.toDestination()` (or `.connect(someEffect)`) when you create the synth.
- **Pass a number instead of a note string.** `triggerAttackRelease(60, '1n')` interprets 60 as a frequency in Hz (very low buzz), not as MIDI note 60. Use `'C4'` or compute the frequency yourself.

### TypeScript notes

Tone.js ships its own types. If you assign `synth` lazily, declare it as the union of the type and `null`:

```ts
let synth: Tone.PolySynth | null = null;
```

The `triggerAttackRelease` signature accepts `Frequency | Frequency[]`, where `Frequency` is `string | number`. Passing the array of note strings type-checks without any cast.

## Concept 2: `<select bind:value>` with object values

### What it is

Two-way binding on a form element with `bind:value` is the same pattern you saw in Module 1 with `<input>` — the value flows from the variable into the element on render, and back into the variable on user input. For `<select>` specifically, the value is whatever the currently-selected `<option>`'s `value` attribute holds.

The interesting part: in plain HTML, an `<option value>` is always a string. The DOM has no way to express "the value of this option is an object." Svelte's compiler patches over this. When you write `<option value={someObject}>`, the runtime stores the object in a side table and uses identity comparison to figure out which option is currently selected. You read the binding and get the original object back, not a string.

This means you can have a dropdown of complex things — chord qualities, country records, user objects — and the bound variable is the full object, not a stringified ID you have to look up afterwards.

### Worked example

```svelte
<script>
  const QUALITIES = [
    &lbrace; id: 'maj', label: 'major',  intervals: [0, 4, 7] &rbrace;,
    &lbrace; id: 'min', label: 'minor',  intervals: [0, 3, 7] &rbrace;,
    &lbrace; id: 'dim', label: 'dim',    intervals: [0, 3, 6] &rbrace;
  ];

  let quality = $state(QUALITIES[0]);
</script>

<select bind:value={quality}>
  &lbrace;#each QUALITIES as q (q.id)&rbrace;
    <option value={q}>{q.label}</option>
  &lbrace;/each&rbrace;
</select>

<p>Intervals: {quality.intervals.join(', ')}</p>
```

The dropdown shows the three labels. When the user picks "minor," the `quality` variable becomes the entire `{ id: 'min', label: 'minor', intervals: [0, 3, 7] }` object. The paragraph re-renders to show "0, 3, 7."

The keyed `{#each ... (q.id)}` block is good hygiene here even though QUALITIES never changes — if it ever did, the key tells Svelte how to match options across renders.

### Variations

String values, for comparison:

```svelte
<select bind:value={root}>
  &lbrace;#each ['C', 'D', 'E'] as r&rbrace;<option value={r}>{r}</option>&lbrace;/each&rbrace;
</select>
```

When option values are strings, no key is needed and the comparison is straightforward string equality. This is the simpler case and the one you'll write most often.

Numeric values:

```svelte
<select bind:value={octave}>
  &lbrace;#each [2, 3, 4, 5, 6] as o&rbrace;<option value={o}>{o}</option>&lbrace;/each&rbrace;
</select>
```

`octave` is a number. The dropdown displays the numbers as strings (HTML), but the bound variable is `2`, not `'2'`. Plain HTML would give you a string and you'd have to `parseInt`. Svelte does the conversion for you because it knows the original value type.

A multi-select binding to an array:

```svelte
<select multiple bind:value={selected}>
  &lbrace;#each items as item (item.id)&rbrace;<option value={item}>{item.label}</option>&lbrace;/each&rbrace;
</select>
```

With `multiple`, the binding is to an array of the selected option values. Same object-value mechanics apply.

### Common mistakes

- **Initial value doesn't match by identity.** You set `let quality = $state({ id: 'maj', ... })` with a fresh object literal, but the options bind to objects from the `QUALITIES` array. The two objects are different references, so no option appears selected. Always initialize from the same array: `let quality = $state(QUALITIES[0])`.
- **Comparing with `===` later and getting `false`.** Same root cause. If you reconstruct the object somewhere else, identity comparison fails. Compare by `id`: `quality.id === 'maj'`.
- **Mutating the bound object directly.** `quality.label = 'whatever'` mutates the entry inside QUALITIES — every option label changes. If you need to edit, copy first: `let edited = { ...quality, label: 'whatever' }`.
- **Forgetting the key on `{#each}`.** Without `(q.id)`, Svelte uses positional reconciliation. Usually fine for static lists; breaks subtly if the list reorders.

### TypeScript notes

Typing the QUALITIES array with `as const` gives you a tight union for the quality type:

```ts
const QUALITIES = [
  { id: 'maj', label: 'major', intervals: [0, 4, 7] },
  { id: 'min', label: 'minor', intervals: [0, 3, 7] }
] as const;

type Quality = typeof QUALITIES[number];

let quality = $state<Quality>(QUALITIES[0]);
```

The `as const` makes the literal arrays readonly, which means `intervals` is `readonly [0, 4, 7]` instead of `number[]`. If you need mutability later, drop `as const` and write the type by hand.

## Concept 3: From note name to MIDI and back

### What it is

A chord on paper is a root note (C, F#, Bb) plus a quality (major, minor, diminished). A chord in code is an array of frequencies, or, more conveniently, an array of note names like `['C4', 'E4', 'G4']`. The "4" is the octave.

To get from "C major" to those three names, you go through MIDI. MIDI note numbers are integers — 60 is middle C, 61 is C#, 62 is D, and so on. Arithmetic on MIDI numbers is just addition: C major's intervals `[0, 4, 7]` mean "the root, the root plus 4 semitones (the major third), and the root plus 7 semitones (the perfect fifth)."

You convert the root name to a MIDI number, add the intervals, convert back to note names. A handful of lines because the rest of the work — voice allocation, frequencies, audio scheduling — is done by Tone.

### Worked example

```js
const NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteToMidi(name) {
  const m = name.match(/^([A-G]#?)(\d+)$/);
  return NOTE_ORDER.indexOf(m[1]) + (parseInt(m[2]) + 1) * 12;
}

function midiToNote(midi) {
  const octave = Math.floor(midi / 12) - 1;
  return NOTE_ORDER[midi % 12] + octave;
}

function chordNotes(root, intervals) {
  const rootMidi = noteToMidi(root + '4');
  return intervals.map(i => midiToNote(rootMidi + i));
}

chordNotes('C', [0, 4, 7]);  // ['C4', 'E4', 'G4']
chordNotes('G', [0, 4, 7]);  // ['G4', 'B4', 'D5']
chordNotes('A', [0, 3, 7]);  // ['A4', 'C5', 'E5']  (A minor)
```

Line by line:

- `NOTE_ORDER` is the chromatic scale in twelve-tone-equal-temperament. Position in this array is the semitone offset within an octave.
- `noteToMidi` splits a name like `"C#4"` into its pitch class (`"C#"`) and its octave (`"4"`). The MIDI standard is `C-1 = 0`, so octave 4 starts at MIDI 60. The formula `(parseInt(m[2]) + 1) * 12` produces 60 for octave 4. Add the pitch class's offset (`indexOf("C")` = 0) and you get 60 exactly.
- `midiToNote` is the inverse. `midi % 12` is the pitch class. `Math.floor(midi / 12) - 1` is the octave.
- `chordNotes` is the convenience function: root + intervals to note name array. The root always lives in octave 4 here; higher chord notes naturally cross into octave 5 when the math says so (the G major example).

### Variations

Different chord qualities just change the intervals array:

```js
const intervals = {
  major:    [0, 4, 7],
  minor:    [0, 3, 7],
  dim:      [0, 3, 6],
  aug:      [0, 4, 8],
  sus4:     [0, 5, 7],
  seventh:  [0, 4, 7, 10],
  major7:   [0, 4, 7, 11],
  minor7:   [0, 3, 7, 10],
  minor6:   [0, 3, 7, 9]
};

chordNotes('C', intervals.major7);  // ['C4', 'E4', 'G4', 'B4']
```

An inversion (the root no longer at the bottom):

```js
function firstInversion(root, intervals) {
  const notes = chordNotes(root, intervals);
  const [low, ...rest] = notes;
  const lowMidi = noteToMidi(low) + 12;
  return [...rest, midiToNote(lowMidi)];
}

firstInversion('C', [0, 4, 7]);  // ['E4', 'G4', 'C5']
```

Drop the bass note up an octave; what's left becomes a first-inversion voicing. This is exactly the kind of thing inline MIDI math makes easy.

Using a real library:

```js
import { Chord } from 'tonal';
Chord.get('Cmaj7').notes;  // ['C', 'E', 'G', 'B'] (no octaves)
```

[tonal.js](https://github.com/tonaljs/tonal) handles every chord symbol you've ever seen, plus scales, intervals, key signatures. If your app needs to parse user-entered chord symbols like "Cmaj7b5/E," reach for tonal. For "give me the notes of these few qualities," the inline version stays out of your dependency tree.

### Common mistakes

- **Confusing MIDI octave with display octave.** Different software disagrees on whether middle C is C3, C4, or C5. The formula here matches the most common convention (middle C = C4 = MIDI 60), which is what Tone.js expects.
- **Off-by-one on the octave.** A common bug: `Math.floor(midi / 12)` (no `- 1`) gives you C5 instead of C4 for middle C. The `- 1` is because the MIDI standard starts at C-1 = 0.
- **Sharps only, no flats.** This implementation only handles sharps. `'Bb4'` won't parse. For chord roots that's usually fine (you can spell everything with sharps), but if you ever need to display flats, convert sharps to their flat equivalents in the output layer.

### TypeScript notes

Tight types for the helpers if you care:

```ts
type PitchClass = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
type NoteName = `${PitchClass}${number}`;

function noteToMidi(name: NoteName): number { /* ... */ }
function midiToNote(midi: number): NoteName { /* ... */ }
```

The template literal type `${PitchClass}${number}` enforces the shape. Useful when the names come from user input; overkill for an internal helper.

## Putting it together

Here's the full lesson component — the picker, the synth, the play button.

```svelte
<script>
  import * as Tone from 'tone';

  const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const QUALITIES = [
    &lbrace; id: 'maj', label: 'major',  intervals: [0, 4, 7] &rbrace;,
    &lbrace; id: 'min', label: 'minor',  intervals: [0, 3, 7] &rbrace;,
    &lbrace; id: 'dim', label: 'dim',    intervals: [0, 3, 6] &rbrace;,
    &lbrace; id: 'aug', label: 'aug',    intervals: [0, 4, 8] &rbrace;,
    &lbrace; id: 'sus4', label: 'sus4',  intervals: [0, 5, 7] &rbrace;,
    &lbrace; id: '7',   label: '7',      intervals: [0, 4, 7, 10] &rbrace;
  ];

  let root = $state('C');
  let quality = $state(QUALITIES[0]);
  let synth = null;

  const NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function noteToMidi(name) {
    const m = name.match(/^([A-G]#?)(\d+)$/);
    return NOTE_ORDER.indexOf(m[1]) + (parseInt(m[2]) + 1) * 12;
  }
  function midiToNote(midi) {
    const octave = Math.floor(midi / 12) - 1;
    return NOTE_ORDER[midi % 12] + octave;
  }
  function chordNotes() {
    const rootMidi = noteToMidi(root + '4');
    return quality.intervals.map(i => midiToNote(rootMidi + i));
  }

  async function play() {
    await Tone.start();
    if (!synth) synth = new Tone.PolySynth(Tone.Synth, {
      envelope: &lbrace; attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.6 &rbrace;
    }).toDestination();
    synth.triggerAttackRelease(chordNotes(), '1n');
  }
</script>

<div class="card">
  <h2>{root} {quality.label}</h2>

  <div class="picker">
    <select bind:value={root}>
      &lbrace;#each ROOTS as r&rbrace;<option value={r}>{r}</option>&lbrace;/each&rbrace;
    </select>

    <select bind:value={quality}>
      &lbrace;#each QUALITIES as q (q.id)&rbrace;<option value={q}>{q.label}</option>&lbrace;/each&rbrace;
    </select>
  </div>

  <button onclick={play}>▶ PLAY</button>
</div>

<style>
  .card {
    max-width: 320px; margin: 40px auto; padding: 28px;
    background: #1a1d2a; border-radius: 16px;
    color: #ecedf3; font-family: system-ui;
  }
  h2 { margin: 0 0 20px; font-size: 36px; color: #5bc85a; }
  .picker { display: flex; gap: 8px; margin-bottom: 20px; }
  select {
    flex: 1; padding: 10px;
    background: #11131a; color: #ecedf3;
    border: 1px solid #262a3a; border-radius: 8px;
    font: inherit;
  }
  button {
    width: 100%; padding: 14px;
    background: #5bc85a; color: white;
    border: 0; border-radius: 10px;
    font: inherit; font-weight: 700;
    cursor: pointer; letter-spacing: 0.1em;
  }
</style>
```

Pick a root, pick a quality, click play. The heading updates as you change the dropdowns; the chord plays when you click.

Three feature areas working together: reactive state (`$state` for root and quality), object-value binding (the quality dropdown), and the audio side (Tone PolySynth driven from converted MIDI numbers). Each by itself is small. The combination is the smallest thing a chord-player app needs.

## Exercises

### Exercise 1: Add more chord qualities

**Setup:** the component above with the six QUALITIES.

**What to do:** add three more qualities to the array: `min7` (intervals `[0, 3, 7, 10]`), `maj7` (`[0, 4, 7, 11]`), and `min6` (`[0, 3, 7, 9]`). The dropdown should pick them up automatically.

**Verify by:** the quality dropdown now shows nine options. Each plays a different-sounding chord.

**Stretch:** add `add9` (`[0, 4, 7, 14]`). Notice the `14` — that's an octave plus a major second. The resulting chord spans two octaves. Use `chordNotes()` in the console (or a `console.log` in `play()`) to inspect the note array and verify it crosses into the fifth octave.

<details>
<summary>Show solution</summary>

```js
const QUALITIES = [
  { id: 'maj',  label: 'major',  intervals: [0, 4, 7] },
  { id: 'min',  label: 'minor',  intervals: [0, 3, 7] },
  { id: 'dim',  label: 'dim',    intervals: [0, 3, 6] },
  { id: 'aug',  label: 'aug',    intervals: [0, 4, 8] },
  { id: 'sus4', label: 'sus4',   intervals: [0, 5, 7] },
  { id: '7',    label: '7',      intervals: [0, 4, 7, 10] },
  { id: 'min7', label: 'min7',   intervals: [0, 3, 7, 10] },
  { id: 'maj7', label: 'maj7',   intervals: [0, 4, 7, 11] },
  { id: 'min6', label: 'min6',   intervals: [0, 3, 7, 9] },
  { id: 'add9', label: 'add9',   intervals: [0, 4, 7, 14] }
];
```

Because the dropdown is `{#each QUALITIES as q (q.id)}`, any addition to the array shows up automatically. No other change needed.

</details>

### Exercise 2: Add an octave selector

**Setup:** the component currently hardcodes octave 4 inside `chordNotes()`.

**What to do:** add a new `<select bind:value={octave}>` with options 2 through 6. The selected octave should be used instead of the hardcoded `4` when computing chord notes.

**Verify by:** picking octave 2 plays a very low chord; octave 6 plays a very high one. The heading still shows the root + quality label (no octave displayed).

**Stretch:** disable the play button when the chord would contain a note outside the audible MIDI range (below MIDI 21 or above MIDI 108). Show a small note next to the disabled button explaining why.

<details>
<summary>Show solution</summary>

```svelte
<script>
  // ... ROOTS, QUALITIES, helpers, synth setup as before ...

  let root = $state('C');
  let quality = $state(QUALITIES[0]);
  let octave = $state(4);

  function chordNotes() {
    const rootMidi = noteToMidi(root + String(octave));
    return quality.intervals.map(i => midiToNote(rootMidi + i));
  }
</script>

<select bind:value={octave}>
  &lbrace;#each [2, 3, 4, 5, 6] as o&rbrace;<option value={o}>oct {o}</option>&lbrace;/each&rbrace;
</select>
```

The numeric value flows through the binding as a number, not a string. `String(octave)` only exists because `noteToMidi` parses strings. The rest of the file doesn't change.

</details>

### Exercise 3: Volume slider

**Setup:** the synth currently plays at full volume.

**What to do:** add a `<input type="range" bind:value={volume} min="-40" max="0" step="1">` and apply it to the synth via `synth.volume.value = volume` whenever it changes. Show the volume in dB next to the slider.

**Verify by:** sliding to `-40` makes the chord nearly inaudible; sliding to `0` is loud. Each new play uses the current volume.

**Stretch:** the volume should apply immediately when the slider moves, not just at the next play. Use `$effect(() => { if (synth) synth.volume.value = volume })` to react to changes.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let volume = $state(-6);

  $effect(() => {
    if (synth) synth.volume.value = volume;
  });
</script>

<label>
  volume: {volume} dB
  <input type="range" bind:value={volume} min="-40" max="0" step="1" />
</label>
```

The `$effect` re-runs whenever `volume` changes (and when `synth` becomes non-null). Setting `synth.volume.value` is a side-effect on the audio graph; the effect is the right place for it because it's a write to something outside the component's own state.

</details>

### Exercise 4 (stretch): Arpeggiate instead of strum

**Setup:** the chord currently plays as a block — all notes start at the same time.

**What to do:** change `play()` so the notes start in sequence, 80ms apart, but still overlap (release stays at 0.6s). The chord rolls in like a strum.

**Verify by:** clicking play, you hear the notes one at a time but they overlap into the chord. Compare to the block-chord version.

**Stretch:** add a checkbox to toggle between block and arpeggiated playback.

<details>
<summary>Show solution</summary>

```js
async function play() {
  await Tone.start();
  if (!synth) synth = new Tone.PolySynth(Tone.Synth, {
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.6 }
  }).toDestination();
  const notes = chordNotes();
  const now = Tone.now();
  notes.forEach((n, i) => {
    synth.triggerAttackRelease(n, '2n', now + i * 0.08);
  });
}
```

`Tone.now()` is the current audio-context time. Scheduling each note at `now + i * 0.08` gives them 80ms staggered starts. `triggerAttackRelease` can take a time argument; for sample-accurate scheduling this is what you'd use instead of `setTimeout`.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- A `src/routes/+page.svelte` containing the chord-picker card.
- A working PolySynth instance, created lazily on first click.
- Two dropdowns: ROOTS (strings) and QUALITIES (objects), both bound with `bind:value`.
- A play button that triggers a triad.

### Verify it works

- Page loads with a green-on-dark card showing "C major" and two dropdowns.
- Picking a different root changes the heading and changes the chord that plays.
- Picking a different quality changes the heading; the chord sounds different.
- No audio on first load until you click — and then audio every subsequent click.
- The console shows no warnings about AudioContext after the first click.

### Compare against the reference

For this module the reference repo is `learn-svelte/capstone-reference/chord-player/`. Compare your `+page.svelte` to lesson-01-equivalent there if you get stuck.

## Common questions

**Q: Why does `Tone.start()` need a user gesture?**
A: Browser autoplay policy. Browsers don't let audio play on page load because of the years of abuse from autoplaying ads and unmuted videos. `AudioContext.resume()` (which `Tone.start()` calls) only succeeds if a user interaction is currently being processed. Inside a click handler, you're fine. On page load or inside a timer, you're not.

**Q: Why a PolySynth instead of three Synths?**
A: Voice allocation. If you trigger a new chord while the previous one is still releasing, a PolySynth allocates fresh voices for the new chord; the old ones keep ringing out. With three pre-instantiated Synths, you'd cut off the previous chord every time. PolySynth handles this automatically.

**Q: Can I bind a `<select>` to a string value but use the displayed text as something else?**
A: Yes. `<option value="maj">major</option>` — the value bound to the variable is `"maj"`, the displayed text is "major." This is the standard HTML pattern and works fine in Svelte. The object-value version is useful when you need more than a single string per option; for simple cases the string-value version is shorter.

**Q: Why `triggerAttackRelease` instead of separate `triggerAttack` and `triggerRelease` calls?**
A: They both work. `triggerAttackRelease(notes, '1n')` is sugar for "start the notes, wait one whole note, then release." Use the separate calls when you don't know the duration in advance (e.g., the user is holding down a key — release on keyup).

**Q: Do I need an explicit `await Tone.start()` if I've clicked once already?**
A: It's idempotent. After the first successful start, subsequent calls resolve immediately. Keeping the `await` in the handler costs nothing and protects against the first-click case.

## What's next

The next lesson turns one chord into a sequence. You'll learn how to render a keyed list of chords with `{#each ... (id)}`, how to add and remove items from a `$state` array, why stable IDs matter for the reconciler, and how to step through the progression with an async loop you can cancel mid-flight.

<SourcesSection lessonKey="04-chord-player/01-play-a-chord" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
