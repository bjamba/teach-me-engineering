<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>A Progression You Can Edit · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-4);">

<LessonHeader
  moduleSlug="04-chord-player"
  lessonSlug="02-progression"
  title="A Progression You Can Edit"
  blurb="A list of chords. Add, remove, click to play one or play through the whole sequence. Lists with stable keys."
/>

## Why this lesson exists

One chord is a noise. A progression is music. The smallest interesting thing this app can do is hold an ordered list of chords, play them back in sequence, and let the user edit the list — add, remove, pick one to hear in isolation.

The Svelte features this requires are the keyed `{#each}` block, the reactive-array update pattern, event handling that has to think about bubbling, and a way to run an async sequence the user can interrupt. None of them are exotic — they're the bread and butter of any list-shaped UI — but they have specific shapes in Svelte 5 that are worth slowing down on.

This lesson goes from "one chord" to "an editable progression with a play-all button." By the end you'll understand why we hand out UUIDs to chords nobody can see, why the remove button needs `event.stopPropagation()`, and how a polling flag is enough cancellation for non-realtime sequencing.

## Learning objectives

By the end of this lesson you'll be able to:

- Render a list of items with `{#each items as item (item.id)}` and explain why the key matters.
- Mutate a `$state` array reactively by either spread-and-reassign or in-place push.
- Stop a child's click event from bubbling to its parent with `event.stopPropagation()`.
- Run an async loop that plays items in sequence and stops when a flag flips.
- Generate stable IDs with `crypto.randomUUID()` and explain when you need them.

## Concept 1: Keyed `{#each}` blocks and stable IDs

### What it is

`{#each}` is Svelte's way of rendering a list. Without a key, it does positional reconciliation — the first element corresponds to the first DOM node, the second to the second, and so on. If you insert or remove an item, Svelte sees the array shrink or grow and updates the DOM by index.

Positional reconciliation is fine for append-only lists and breaks subtly for everything else. Remove the second item from a five-item list and Svelte has to decide: did you remove item 2 (so items 3, 4, 5 should shift up), or did you change items 2, 3, 4 in place and remove item 5 from the end? Without more information it picks the second interpretation. The result is that the DOM nodes for items 3, 4, 5 get their content rewritten in place — focus is lost, in-progress CSS transitions are interrupted, child component state resets.

A keyed `{#each items as item (item.id)}` tells Svelte how to identify each item across renders. Now removing item 2 unambiguously means "drop the DOM node whose key was `2`'s id, leave the others alone." Focus stays where it was. Transitions complete. Child state is preserved.

For the chord progression, the items are positional in the UI but identity-bearing as data. The third C major in your progression and the seventh C major are different chord events even though their data is identical. They need stable IDs so the reconciler can tell them apart.

### Worked example

```svelte
<script>
  let progression = $state([
    &lbrace; id: crypto.randomUUID(), root: 'C', quality: 'major' &rbrace;,
    &lbrace; id: crypto.randomUUID(), root: 'A', quality: 'minor' &rbrace;,
    &lbrace; id: crypto.randomUUID(), root: 'F', quality: 'major' &rbrace;,
    &lbrace; id: crypto.randomUUID(), root: 'G', quality: 'major' &rbrace;
  ]);

  function remove(id) {
    progression = progression.filter(c => c.id !== id);
  }
</script>

<ol>
  &lbrace;#each progression as c (c.id)&rbrace;
    <li>
      {c.root} {c.quality}
      <button onclick={() => remove(c.id)}>×</button>
    </li>
  &lbrace;/each&rbrace;
</ol>
```

The key expression `(c.id)` sits between the loop variable and the block body. Each chord gets a UUID when it's created, so the reconciler can match items across renders even when their position changes.

`crypto.randomUUID()` is a Web Crypto API method available in browsers and modern Node. It returns a string like `"550e8400-e29b-41d4-a716-446655440000"` — 122 bits of randomness, effectively guaranteed unique for the life of the app. No `npm install uuid` needed.

### Variations

Using the array index as the key (almost always wrong):

```svelte
&lbrace;#each progression as c, i (i)&rbrace;
  <li>{c.root}</li>
&lbrace;/each&rbrace;
```

This is equivalent to no key at all — the index is exactly what positional reconciliation uses by default. It looks like a key but it's the identity function. Don't do this.

Using a derived key when items are immutable plain values:

```svelte
&lbrace;#each colors as c (c)&rbrace;
  <li style="background: {c}">{c}</li>
&lbrace;/each&rbrace;
```

If `colors` is `['red', 'green', 'blue']` and the strings themselves are unique, you can use the string as the key. Same idea — Svelte needs to compare keys for identity, and strings compare fine. As soon as you can have duplicates (`['red', 'red', 'blue']`), you need synthetic IDs.

A composite key:

```svelte
&lbrace;#each entries as e (`${e.userId}:${e.timestamp}`)&rbrace;
```

Any expression works. The result is treated as the key. Useful when items don't have a single canonical ID but a combination of fields uniquely identifies them.

### Common mistakes

- **Using index as key on a list that reorders.** Symptom: items appear to swap content rather than swap position. Input focus jumps to the wrong row when you sort. Use stable IDs.
- **Forgetting to generate the ID at creation time.** If you compute the ID inside the render (e.g., `(crypto.randomUUID())`), you'll get a fresh ID every render and Svelte will think every item is new every time. The DOM gets thrashed. IDs go on the data, once, when the item is created.
- **Two items with the same key.** Svelte will warn at runtime and the reconciler's behavior is unspecified. Make sure IDs are unique.
- **Using `Math.random()` instead of `crypto.randomUUID()`.** Math.random has terrible collision resistance and isn't a good ID source. UUID is the right tool; it's free in the browser.

### TypeScript notes

A typed chord with an ID:

```ts
type Chord = {
  id: string;
  root: string;
  quality: { id: string; label: string; intervals: number[] };
};

let progression = $state<Chord[]>([]);
```

`crypto.randomUUID()` returns a branded string type (`` `${string}-${string}-${string}-${string}-${string}` ``). Assignable to `string`, so no friction.

## Concept 2: Updating `$state` arrays

### What it is

Svelte 5's `$state` uses JavaScript Proxies to track mutations. When you write `let progression = $state([...])`, the array is wrapped in a proxy that intercepts reads (to register dependencies) and writes (to invalidate dependents). This means both mutation styles work:

```js
progression.push(newChord);            // in-place
progression = [...progression, newChord]; // reassignment
```

Both trigger reactivity. The proxy catches the push by hooking into the array's internal methods; the reassignment is caught because the variable itself is being reassigned and that's a write.

In Svelte 4 (without proxies) only the reassignment worked — you had to write `progression = [...progression, newChord]` because plain `push` mutated in place and the runtime had no way to notice. The two-line equivalent `progression.push(newChord); progression = progression;` was the famous workaround.

In Svelte 5, both work but they have slightly different ergonomics. Reassignment makes the "this is a new array" intent explicit and is what most React refugees instinctively write. In-place mutation is shorter and often clearer for simple operations.

### Worked example

```js
// Adding (both equivalent):
function addV1() {
  progression = [...progression, { id: crypto.randomUUID(), root: 'C', quality: q }];
}

function addV2() {
  progression.push({ id: crypto.randomUUID(), root: 'C', quality: q });
}

// Removing:
function remove(id) {
  progression = progression.filter(c => c.id !== id);
}

// Removing in-place:
function removeV2(id) {
  const i = progression.findIndex(c => c.id === id);
  if (i >= 0) progression.splice(i, 1);
}

// Replacing an item:
function replace(id, newChord) {
  progression = progression.map(c => c.id === id ? newChord : c);
}

// Swapping two adjacent items:
function swap(i, j) {
  [progression[i], progression[j]] = [progression[j], progression[i]];
}
```

The swap is interesting because it's a deep mutation — writing to two indices on the proxy. Both writes register, the keyed `{#each}` block sees the items in their new positions, and the DOM nodes move rather than re-render.

### Variations

A reactive map of items:

```js
let chordsById = $state(new Map());
chordsById.set(id, chord);  // tracked
chordsById.delete(id);      // tracked
```

`$state` works with Maps and Sets via the same proxy machinery. Iteration in `{#each}` is awkward (`{#each [...chordsById] as [id, chord]}`), so for ordered display arrays are still more convenient.

A nested update on an item in an array:

```js
function rename(id, newRoot) {
  const chord = progression.find(c => c.id === id);
  if (chord) chord.root = newRoot;
}
```

This mutates a property of an item in the array. The proxy tracks it. Any binding reading that chord's `root` re-evaluates.

### Common mistakes

- **Replacing the whole array with the same reference.** `progression = progression` doesn't do anything (unlike Svelte 4). The proxy only invalidates on actual changes.
- **Trying to track a non-proxied copy.** If you do `const copy = [...progression]` and then mutate `copy`, those mutations are on a plain array — not tracked. Either operate on `progression` directly or reassign `progression = newArray` after.
- **Forgetting that `$state` is deeply reactive.** Mutating `progression[0].root = 'D'` IS reactive. You don't need to reassign the array; the proxy catches the property write on the nested object.
- **Comparing arrays with `===` after a mutation.** Old reference `===` new reference still returns true after `.push()`. If you need to detect changes by reference equality (e.g., to skip work), use `$derived` or copy explicitly.

### TypeScript notes

`$state<Chord[]>([])` gives you a typed array. The proxy is transparent to TypeScript — the type stays `Chord[]`, not some `Proxy<Chord[]>`. Method calls and indexed access type-check normally.

## Concept 3: Event bubbling and `stopPropagation`

### What it is

DOM events bubble. A click on a button inside a `<li>` first fires on the button, then on the `<li>`, then on each parent up to the document. Any element along the path that has a click handler gets called.

This is usually what you want. A click anywhere inside a card triggers the card's click handler, even if the click was on a child element. But sometimes the child has its own job — a delete button inside a clickable row, a checkbox inside a row that also responds to clicks — and the row's handler firing on top of the child's handler is wrong.

`event.stopPropagation()` is the standard DOM method to stop the bubble. The child handler runs, calls `stopPropagation`, and the parent handler doesn't fire. This is the same in every framework because it's a property of the DOM, not the framework.

Svelte 5 passes the raw `Event` object as the first argument to your handler. Earlier Svelte used a modifier syntax (`on:click|stopPropagation`); that's gone in Svelte 5. The modern form is just standard DOM.

### Worked example

```svelte
<li onclick={() => playChord(c)}>
  <span>{c.root} {c.quality.label}</span>
  <button onclick={(e) => { e.stopPropagation(); remove(c.id); }}>×</button>
</li>
```

Click on the `<span>`: bubbles up to the `<li>`, playChord runs.

Click on the `<button>`: the button's handler runs first, calls `stopPropagation`, then calls `remove`. The `<li>`'s handler is never invoked. The chord disappears; nothing plays.

Without `stopPropagation`, clicking the × would both play the chord AND remove it. The play would queue audio for a chord that no longer exists in the data model — usually harmless, but it's a phantom action the user didn't intend.

### Variations

`preventDefault` for forms and links:

```svelte
<form onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
```

Forms reload the page on submit by default. `preventDefault` stops that.

Both together:

```svelte
<a href="/x" onclick={(e) => { e.preventDefault(); e.stopPropagation(); doRoute(); }}>
```

Common for SPA navigation links that handle their own routing.

Avoiding the inline arrow:

```svelte
<button onclick={removeHandler(c.id)}>×</button>

<script>
  function removeHandler(id) {
    return (e) => { e.stopPropagation(); remove(id); };
  }
</script>
```

A factory returning a handler. Useful when several places need the same pattern; for one-off cases the inline arrow is fine.

### Common mistakes

- **Forgetting `stopPropagation` and being confused why two handlers run.** Add a console.log to each handler; you'll see them fire in order. Add the `stopPropagation` to the inner one.
- **Calling `stopPropagation` on the wrong handler.** If the parent handler fires first, stopping propagation on the child won't help — the parent already ran. The handler that calls `stopPropagation` must be on the inner element so the parent's handler is the one that gets suppressed.
- **Using `stopPropagation` when `preventDefault` is what you actually need.** They do different things. `preventDefault` cancels the browser's default behavior (form submit, link navigation). `stopPropagation` cancels the bubble. Different problems, different fixes.
- **Capturing-phase listeners.** Rare but exists. `addEventListener('click', fn, true)` fires during the capturing phase (before the target). `stopPropagation` from a bubble-phase handler can't stop a capture-phase handler that already ran. Svelte's `onclick=...` attaches in bubble phase, so this is rarely an issue.

## Concept 4: Async sequences with cancellation

### What it is

Playing a progression is an asynchronous operation: trigger chord 1, wait 1.5 seconds, trigger chord 2, wait 1.5 seconds, and so on. Halfway through, the user might click STOP. The loop needs to notice and stop.

The canonical web approach is `AbortController`/`AbortSignal`, which is what `fetch` uses. For a simple "stop playback" button, a `$state` flag is more than enough — set it to false on STOP, check it at the top of each loop iteration, break.

The reason this works without races: JavaScript is single-threaded. Between `await new Promise(r => setTimeout(r, 1500))` resolving and the next iteration starting, no other code can run except via the event loop. When the user clicks STOP, the click handler runs, flips the flag, and returns. The next iteration of the playback loop then reads the flipped flag and breaks.

This isn't sample-accurate. The 1.5-second `setTimeout` has at least a few milliseconds of jitter; the audio scheduling has a tiny gap between `triggerAttackRelease` returning and the next chord firing. For "play these chords in order," this is fine. For musical timing where each chord must land precisely on the beat, you'd schedule everything in advance on the Tone Transport — that's the capstone DAW's job.

### Worked example

```js
let isPlaying = $state(false);
let currentIndex = $state(-1);

async function playProgression() {
  if (isPlaying) {
    isPlaying = false;  // user clicked while playing; STOP
    return;
  }
  await ensureSynth();
  isPlaying = true;
  for (let i = 0; i < progression.length; i++) {
    if (!isPlaying) break;
    currentIndex = i;
    synth.triggerAttackRelease(chordNotes(progression[i]), '1n');
    await new Promise(r => setTimeout(r, 1500));
  }
  currentIndex = -1;
  isPlaying = false;
}
```

`currentIndex` drives the visual highlight on the currently-playing chord in the UI. The `class:active={i === currentIndex}` directive on each `<li>` reads it; the highlight follows playback automatically because `currentIndex` is reactive.

The early-return on the second click is the toggle behavior: one button does both PLAY and STOP. If `isPlaying`, set the flag to false and return — the in-flight loop will see the flag flipped on its next iteration and exit cleanly.

### Variations

With `AbortController`:

```js
let controller = null;

async function play() {
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  for (const chord of progression) {
    if (signal.aborted) break;
    synth.triggerAttackRelease(chordNotes(chord), '1n');
    await wait(1500, signal);
  }
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('aborted', 'AbortError'));
    });
  });
}
```

More plumbing, but the wait is interruptible immediately instead of at the next chord boundary. Worth it for longer delays; overkill for 1.5-second steps.

A generator-based version:

```js
async function* playGenerator() {
  for (const chord of progression) {
    yield chord;
    await new Promise(r => setTimeout(r, 1500));
  }
}

for await (const chord of playGenerator()) {
  if (!isPlaying) break;
  synth.triggerAttackRelease(chordNotes(chord), '1n');
}
```

Cleaner separation between "what to play next" and "the side effects of playing." Probably overengineered for this lesson; useful when the play logic gets more complex.

### Common mistakes

- **Forgetting the cancellation check at the top of the loop.** Without `if (!isPlaying) break`, the loop runs to completion no matter what the user clicks. STOP appears to do nothing.
- **Setting `isPlaying = false` only on natural completion.** Then a STOP click leaves the flag stuck at true. Set it at the end AND on the toggle path.
- **Storing the array length in a variable.** `const n = progression.length; for (let i = 0; i < n; i++)`. If the user adds a chord during playback, the loop doesn't pick it up. Reading `progression.length` each iteration is what you want here.
- **Returning from `playProgression` while `isPlaying` is true.** If an error throws mid-loop, the flag stays true forever; subsequent clicks now do the "user clicked STOP" path. Wrap the loop in try/finally and reset the flag in the finally block.

### TypeScript notes

Marking the function as `async`: TypeScript infers its return type as `Promise<void>`. Nothing else changes. The `isPlaying` and `currentIndex` types are inferred as `boolean` and `number` from the initial values.

## Putting it together

```svelte
<script>
  import * as Tone from 'tone';

  const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const QUALITIES = [
    &lbrace; id: 'maj', label: 'major',  intervals: [0, 4, 7] &rbrace;,
    &lbrace; id: 'min', label: 'minor',  intervals: [0, 3, 7] &rbrace;,
    &lbrace; id: '7',   label: '7',      intervals: [0, 4, 7, 10] &rbrace;,
    &lbrace; id: 'maj7', label: 'maj7',  intervals: [0, 4, 7, 11] &rbrace;,
    &lbrace; id: 'min7', label: 'min7',  intervals: [0, 3, 7, 10] &rbrace;
  ];

  let progression = $state([
    &lbrace; id: crypto.randomUUID(), root: 'C', quality: QUALITIES[0] &rbrace;,
    &lbrace; id: crypto.randomUUID(), root: 'A', quality: QUALITIES[1] &rbrace;,
    &lbrace; id: crypto.randomUUID(), root: 'F', quality: QUALITIES[0] &rbrace;,
    &lbrace; id: crypto.randomUUID(), root: 'G', quality: QUALITIES[0] &rbrace;
  ]);

  let pickerRoot = $state('C');
  let pickerQuality = $state(QUALITIES[0]);

  let synth = null;
  let isPlaying = $state(false);
  let currentIndex = $state(-1);

  const NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function noteToMidi(n) &lbrace; const m = n.match(/^([A-G]#?)(\d+)$/); return NOTE_ORDER.indexOf(m[1]) + (parseInt(m[2]) + 1) * 12; &rbrace;
  function midiToNote(m) &lbrace; return NOTE_ORDER[m % 12] + (Math.floor(m / 12) - 1); &rbrace;
  function chordNotes(c) &lbrace;
    const root = noteToMidi(c.root + '4');
    return c.quality.intervals.map(i => midiToNote(root + i));
  &rbrace;

  async function ensureSynth() &lbrace;
    await Tone.start();
    if (!synth) synth = new Tone.PolySynth(Tone.Synth, &lbrace;
      envelope: &lbrace; attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.6 &rbrace;
    &rbrace;).toDestination();
  &rbrace;

  async function playChord(c) &lbrace;
    await ensureSynth();
    synth.triggerAttackRelease(chordNotes(c), '1n');
  &rbrace;

  function addChord() &lbrace;
    progression = [...progression, &lbrace;
      id: crypto.randomUUID(),
      root: pickerRoot,
      quality: pickerQuality
    &rbrace;];
  &rbrace;

  function removeChord(id) &lbrace;
    progression = progression.filter(c => c.id !== id);
  &rbrace;

  async function playProgression() &lbrace;
    if (isPlaying) &lbrace; isPlaying = false; return; &rbrace;
    await ensureSynth();
    isPlaying = true;
    for (let i = 0; i < progression.length; i++) &lbrace;
      if (!isPlaying) break;
      currentIndex = i;
      synth.triggerAttackRelease(chordNotes(progression[i]), '1n');
      await new Promise(r => setTimeout(r, 1500));
    &rbrace;
    currentIndex = -1;
    isPlaying = false;
  &rbrace;
</script>

<div class="card">
  <h2>Progression</h2>

  <ol class="chords">
    &lbrace;#each progression as c, i (c.id)&rbrace;
      <li
        class="chord"
        class:active={i === currentIndex}
        onclick={() => playChord(c)}
      >
        <span class="name">{c.root}{c.quality.label === 'major' ? '' : ' ' + c.quality.label}</span>
        <button class="remove" onclick={(e) => { e.stopPropagation(); removeChord(c.id); }}>×</button>
      </li>
    &lbrace;/each&rbrace;

    &lbrace;#if progression.length === 0&rbrace;
      <li class="empty">no chords yet — add one below</li>
    &lbrace;/if&rbrace;
  </ol>

  <div class="picker">
    <select bind:value={pickerRoot}>&lbrace;#each ROOTS as r&rbrace;<option value={r}>{r}</option>&lbrace;/each&rbrace;</select>
    <select bind:value={pickerQuality}>&lbrace;#each QUALITIES as q (q.id)&rbrace;<option value={q}>{q.label}</option>&lbrace;/each&rbrace;</select>
    <button class="add" onclick={addChord}>+ ADD</button>
  </div>

  <button class="play-all" onclick={playProgression} disabled={progression.length === 0}>
    {isPlaying ? '■ STOP' : '▶ PLAY ALL'}
  </button>
</div>
```

The default progression is vi-IV-I-V in C — Am, F, C, G — which is roughly half of pop music. Click a chord to hear just that one. Click PLAY ALL to step through all four. Click any chord while it's playing and you'll trigger that chord on top of the playback; click PLAY ALL again mid-playback and it stops.

## Exercises

### Exercise 1: Add a "duplicate" button to each chord

**Setup:** each chord row has a remove button (×). Add a second button next to it that duplicates the chord.

**What to do:** add a "⎘" button (or any glyph) that inserts a copy of the chord right after itself in the progression. Use `splice` or build a new array with `slice`. Don't forget to give the duplicate a fresh ID.

**Verify by:** clicking duplicate on the second chord inserts an identical chord at position three; the original third chord becomes the fourth. PLAY ALL plays the duplicate in its new position.

**Stretch:** make sure the duplicate button also calls `stopPropagation` so clicking it doesn't play the original chord.

<details>
<summary>Show solution</summary>

```js
function duplicateChord(id) {
  const i = progression.findIndex(c => c.id === id);
  if (i < 0) return;
  const copy = { ...progression[i], id: crypto.randomUUID() };
  progression = [
    ...progression.slice(0, i + 1),
    copy,
    ...progression.slice(i + 1)
  ];
}
```

```svelte
<button class="dup" onclick={(e) => { e.stopPropagation(); duplicateChord(c.id); }}>⎘</button>
```

The spread of the original chord plus a fresh `id` is the idiomatic way to clone with a key change. The slice-insert-slice pattern is the cleanest way to insert at an arbitrary position without mutating.

</details>

### Exercise 2: Reorder by buttons

**Setup:** the progression is rendered as an ordered list. Items don't move on their own.

**What to do:** add up and down arrow buttons to each row. Up swaps the chord with the previous one; down swaps with the next. Disable up on the first chord and down on the last.

**Verify by:** clicking down on chord 1 swaps it with chord 2. The active highlight (if any) follows the chord by its content, because the key tracking keeps the DOM nodes in their new positions.

**Stretch:** add `animate:flip` (from `svelte/animate`) to the `<li>` so the swap animates smoothly.

<details>
<summary>Show solution</summary>

```js
function swap(i, j) {
  if (i < 0 || j < 0 || i >= progression.length || j >= progression.length) return;
  [progression[i], progression[j]] = [progression[j], progression[i]];
}
```

```svelte
<script>
  import { flip } from 'svelte/animate';
</script>

&lbrace;#each progression as c, i (c.id)&rbrace;
  <li animate:flip=&lbrace;&lbrace; duration: 200 &rbrace;&rbrace;>
    ...
    <button onclick=&lbrace;(e) => &lbrace; e.stopPropagation(); swap(i, i - 1); &rbrace;&rbrace; disabled={i === 0}>↑</button>
    <button onclick=&lbrace;(e) => &lbrace; e.stopPropagation(); swap(i, i + 1); &rbrace;&rbrace; disabled={i === progression.length - 1}>↓</button>
  </li>
&lbrace;/each&rbrace;
```

The keyed `{#each}` plus `animate:flip` is the entire reorder animation. FLIP (First Last Invert Play) measures positions before and after the change and animates between them.

</details>

### Exercise 3: Tempo slider for play-all

**Setup:** `playProgression` waits a hardcoded 1500ms between chords.

**What to do:** add a tempo slider (BPM) and use it to compute the inter-chord delay. At 60 BPM, one chord per second; at 120 BPM, two per second.

**Verify by:** dragging the slider mid-playback doesn't change the in-flight delay (read happens once per iteration) but the next chord uses the new value. Lower BPM = slower playback.

**Stretch:** show the computed ms-per-chord next to the slider in real time.

<details>
<summary>Show solution</summary>

```js
let bpm = $state(80);

async function playProgression() {
  if (isPlaying) { isPlaying = false; return; }
  await ensureSynth();
  isPlaying = true;
  for (let i = 0; i < progression.length; i++) {
    if (!isPlaying) break;
    currentIndex = i;
    synth.triggerAttackRelease(chordNotes(progression[i]), '1n');
    const ms = (60 / bpm) * 1000;
    await new Promise(r => setTimeout(r, ms));
  }
  currentIndex = -1;
  isPlaying = false;
}
```

```svelte
<label>
  tempo: {bpm} BPM ({Math.round(60000 / bpm)} ms/chord)
  <input type="range" bind:value={bpm} min="40" max="200" />
</label>
```

`60 / bpm` is seconds per beat. Times 1000 is milliseconds. Reading `bpm` inside the loop gets a fresh value each iteration without any extra plumbing.

</details>

### Exercise 4 (stretch): A "loop" toggle

**Setup:** PLAY ALL stops at the end of the progression.

**What to do:** add a checkbox labeled "loop." When checked, PLAY ALL restarts at the beginning instead of stopping. STOP still works to interrupt.

**Verify by:** with loop on, playback continues indefinitely. Click STOP to halt. With loop off, behavior is unchanged.

<details>
<summary>Show solution</summary>

```js
let loop = $state(false);

async function playProgression() {
  if (isPlaying) { isPlaying = false; return; }
  await ensureSynth();
  isPlaying = true;
  do {
    for (let i = 0; i < progression.length; i++) {
      if (!isPlaying) break;
      currentIndex = i;
      synth.triggerAttackRelease(chordNotes(progression[i]), '1n');
      await new Promise(r => setTimeout(r, 1500));
    }
  } while (isPlaying && loop);
  currentIndex = -1;
  isPlaying = false;
}
```

The `do-while` runs the for loop once unconditionally, then checks both `isPlaying` (not stopped) and `loop` (loop is on). If both are true, it goes again.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- A `progression` array in `$state` holding chord objects with IDs.
- A rendered list using keyed `{#each ... (c.id)}`.
- Add and remove buttons that mutate the array.
- A play-all loop with toggle/stop behavior.

### Verify it works

- The page loads with four default chords (Am, F, C, G).
- Clicking the picker dropdowns and ADD inserts a new chord at the end.
- Clicking × on any chord removes it; the highlight (if active) handles the removal gracefully.
- Clicking PLAY ALL plays through every chord with visual highlight following along; clicking again mid-playback stops.
- Clicking a single chord plays only that chord even while PLAY ALL is running.

### Compare against the reference

`learn-svelte/capstone-reference/chord-player/` should match this lesson's state at this stage.

## Common questions

**Q: Why generate IDs in the data instead of letting Svelte use array position?**
A: Because positions aren't identity. Two C major chords at positions 2 and 5 are different chord events; if you remove position 1, the position-2 chord becomes position-1. A reconciler keyed by position would think you deleted position 5 and shifted everything. A reconciler keyed by UUID knows you deleted exactly the chord that had ID X.

**Q: Is `crypto.randomUUID()` available everywhere I need it?**
A: All modern browsers (since 2022 on Safari, earlier elsewhere) and Node 19+. If you have to support older browsers, polyfill with `uuid` from npm. For this course's target audience, no polyfill needed.

**Q: Why does the in-flight playback work even though I mutate the array during playback?**
A: Because the loop reads `progression[i]` fresh each iteration. If you add a chord at the end, the loop's bound `progression.length` is also evaluated each iteration, so it picks up new chords too. If you remove a chord earlier in the list, the loop indexes shift — usually you don't want this and you'd want to halt playback on edit. We don't bother for this lesson.

**Q: Why an `<ol>` instead of a `<ul>`?**
A: A chord progression has order — chord 3 comes after chord 2 because we said so. `<ol>` is semantically correct. Visually it doesn't matter (we hide the numbers with CSS); for accessibility it does.

**Q: Should I use a state machine library for the play/stop logic?**
A: For three states (idle, playing, transitioning) a flag and a flag check is fine. State machines pay off when you have many states with many transitions and the logic is hard to follow as conditionals. We have two states — flip a boolean.

## What's next

Both the progression view and the (future) "edit existing chord" UI need the same root + quality dropdown widget. The next lesson extracts that into a `ChordPicker` component and introduces `$bindable`, the rune that lets a parent two-way-bind to a child component's props. You'll see when two-way binding is the right shape and when a one-way prop with a callback is better.

<SourcesSection lessonKey="04-chord-player/02-progression" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
