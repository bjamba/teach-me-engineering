<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Shared State with .svelte.ts · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-4);">

<LessonHeader
  moduleSlug="04-chord-player"
  lessonSlug="04-shared-state"
  title="Shared State with .svelte.ts"
  blurb="Move the progression state out of the page component into a shared module. The Svelte 5 answer to stores."
/>

## Why this lesson exists

`progression` currently lives in `src/routes/+page.svelte`. That's fine while the whole app is one file. It stops being fine the moment a second component needs to read or modify the progression — a sidebar that lists saved progressions, a header counter showing how many chords are in the current one, a separate playback panel that needs the array to know what to schedule.

The Svelte 4 solution was the store API: `writable`, `readable`, `derived`, the auto-subscribe `$store` syntax. It worked, but it was a parallel reactivity system you had to learn on top of component reactivity. You wrote `let count = 0` for one and `$count` for the other; you reached for `set`, `update`, `subscribe` for shared state and reassignment for local state. Two mental models, one app.

Svelte 5 unifies them. You can put `$state` (and `$derived`, `$effect`) in any module whose filename ends in `.svelte.ts` or `.svelte.js`. Imports of that module see the same reactive values. The runtime tracks reads and writes across module boundaries the same way it does across component boundaries. The store API still exists for backwards compatibility, but you don't need it.

This lesson takes `progression` out of the page and into a shared module. The page reads and writes through an imported instance. Any future component does the same.

## Learning objectives

By the end of this lesson you'll be able to:

- Explain why the file extension `.svelte.ts` matters and what happens without it.
- Create a class with `$state` fields, instantiate it once, and export the instance.
- Read shared state in components and mutate it through methods.
- Use a getter or a `$derived` field for computed properties on the shared store.
- Decide between the rune-based shared-state pattern and the legacy `writable` store.

## Concept 1: The `.svelte.ts` file extension

### What it is

Svelte's compiler runs over `.svelte` files. The runes (`$state`, `$derived`, `$effect`, `$props`, `$bindable`) are recognized as part of that processing — they look like function calls but they're compiled into reactive primitives.

A plain `.ts` file is just TypeScript. It gets compiled by `tsc` (or esbuild, or whatever your toolchain uses), no Svelte compiler involvement. If you write `let count = $state(0)` in a `.ts` file, the `$state` identifier is just a variable reference. Without a definition, it errors. With a definition (importing some stub), it returns whatever the stub returns. Either way it doesn't do anything reactive.

`.svelte.ts` (and `.svelte.js`) is the opt-in: a TypeScript file that Svelte's compiler will process for runes. Inside, the runes work exactly as they do in a component. Outside, you write normal TypeScript.

The split is intentional. It would have been technically possible to make all TypeScript files rune-aware, but that would mean every TS file in your project gets piped through the Svelte compiler — slower builds, surprise reactivity in files that didn't expect it. The extension marks the boundary so the compiler and the reader both know what to do.

The naming convention: a state module is `xxx.svelte.ts`. A regular utility module that doesn't use runes is `xxx.ts`. Some teams use `.state.svelte.ts` or `.store.svelte.ts` to make the role even more obvious; the bare `.svelte.ts` works fine.

### Worked example

```ts
// src/lib/counter.svelte.ts
export const counter = $state({ value: 0 });

export function increment() {
  counter.value += 1;
}
```

```svelte
<!-- some-component.svelte -->
<script>
  import { counter, increment } from '$lib/counter.svelte';
</script>

<p>count: {counter.value}</p>
<button onclick={increment}>+</button>
```

Multiple components importing `counter` see the same object. Mutations through `counter.value += 1` (or through the exported `increment` function) are reactive everywhere. The component re-renders without any explicit subscription.

### Variations

A plain factory function:

```ts
// src/lib/makeCounter.svelte.ts
export function makeCounter(initial = 0) {
  let value = $state(initial);
  return {
    get value() { return value; },
    increment() { value++; }
  };
}
```

Useful when you want multiple independent counters. Each call to `makeCounter()` creates a fresh `$state` and returns its own object. The getter exposes the value reactively; the method mutates it.

A `.svelte.js` (no TypeScript):

```js
// src/lib/counter.svelte.js
export const counter = $state({ value: 0 });
```

Identical, just JavaScript. Same compiler treatment.

### Common mistakes

- **Forgetting the `.svelte` part of the filename.** `progression.ts` with `$state` inside compiles to nothing reactive. The import works but the values don't track. Rename to `progression.svelte.ts`.
- **Importing from the wrong path.** `import { progression } from '$lib/progression.svelte'` — note the import path drops the `.ts` extension (standard). You import from the `.svelte` part of the filename, not the `.ts` part.
- **Trying to use runes in a `.ts` file with a workaround.** "I'll just import `$state` from somewhere" — there's nothing to import. The runes are compiler-level. There's no runtime function called `$state` for you to grab.
- **Putting all your code in `.svelte.ts` files "just in case."** Slightly slower compile and harder for readers to know which files actually need rune processing. Keep `.svelte.ts` for files that genuinely use runes; keep utility code in plain `.ts`.

### TypeScript notes

Type imports work normally:

```ts
// types.ts (plain TypeScript)
export type Chord = { id: string; root: string; quality: Quality };

// progression.svelte.ts
import type { Chord } from './types';

class ProgressionStore {
  chords = $state<Chord[]>([]);
}
```

Splitting types into a non-`.svelte.ts` file is fine and often nicer for organization. The runes only need to be where the reactive runtime is.

## Concept 2: A state class with `$state` fields

### What it is

Inside a `.svelte.ts` file, `$state` works on class fields the same way it works on local variables. A class is just a more organized way to bundle state with the methods that mutate it.

```ts
class ProgressionStore {
  chords = $state<Chord[]>([]);

  add(chord: Chord) {
    this.chords = [...this.chords, chord];
  }
}
```

The `chords = $state<Chord[]>([])` line is a class field initializer that creates a reactive array. Every instance of `ProgressionStore` gets its own `chords` proxy. Reads from any consumer register a dependency; writes invalidate.

You don't have to use a class. A plain object literal with methods works:

```ts
export const progression = {
  chords: $state<Chord[]>([]),
  add(chord: Chord) {
    this.chords = [...this.chords, chord];
  }
};
```

The class form is slightly cleaner when you have several methods and you want them grouped. The object literal form is shorter for one-method stores. Both work; pick one and be consistent.

### Worked example

`src/lib/progression.svelte.ts`:

```ts
const QUALITIES = [
  { id: 'maj', label: 'major',  intervals: [0, 4, 7] },
  { id: 'min', label: 'minor',  intervals: [0, 3, 7] },
  { id: '7',   label: '7',      intervals: [0, 4, 7, 10] },
  { id: 'maj7', label: 'maj7',  intervals: [0, 4, 7, 11] },
  { id: 'min7', label: 'min7',  intervals: [0, 3, 7, 10] }
];

export type Quality = typeof QUALITIES[number];
export type Chord = { id: string; root: string; quality: Quality };

class ProgressionStore {
  chords = $state<Chord[]>([
    { id: crypto.randomUUID(), root: 'C', quality: QUALITIES[0] },
    { id: crypto.randomUUID(), root: 'A', quality: QUALITIES[1] },
    { id: crypto.randomUUID(), root: 'F', quality: QUALITIES[0] },
    { id: crypto.randomUUID(), root: 'G', quality: QUALITIES[0] }
  ]);

  add(root: string, quality: Quality) {
    this.chords = [
      ...this.chords,
      { id: crypto.randomUUID(), root, quality }
    ];
  }

  remove(id: string) {
    this.chords = this.chords.filter(c => c.id !== id);
  }

  clear() {
    this.chords = [];
  }

  get count() {
    return this.chords.length;
  }
}

export const progression = new ProgressionStore();
export { QUALITIES };
```

Three things to call out:

1. The class encapsulates the storage and the mutation methods.
2. `add` and `remove` reassign `this.chords` to a new array. Mutating in place (`this.chords.push(...)`) would also work because of the proxy; the reassignment form is just a stylistic preference here.
3. The exported value is the instance, not the class. Consumers import `progression`; they never `new ProgressionStore()`. There's exactly one store, shared everywhere.

### Variations

A factory for multiple stores:

```ts
export function createProgression(initial: Chord[] = []) {
  return new ProgressionStore(initial);
}
```

If your app needs multiple independent progressions (an A/B comparison view, say), expose a factory and let consumers instantiate as needed. Each instance has its own `chords` state.

A `$derived` field instead of a getter:

```ts
class ProgressionStore {
  chords = $state<Chord[]>([]);
  count = $derived(this.chords.length);
}
```

Same observable behavior. `count` is reactive either way. The `$derived` form caches the computation (worth it if the body is expensive); the getter form is recomputed on every read (fine for trivial expressions like `.length`).

A reset method:

```ts
reset() {
  this.chords = defaultChords();
}

function defaultChords(): Chord[] {
  return [/* the four starter chords */];
}
```

Factoring the default-chord generation out so both the constructor and `reset` use the same list. Helps avoid the "I forgot to update the reset method when I changed the defaults" bug.

### Common mistakes

- **Exporting the class, not the instance.** `export class ProgressionStore { ... }` and now every consumer makes their own. They don't share state. Always `export const progression = new ProgressionStore()`.
- **Forgetting `this.` inside methods.** A field is `this.chords`, not bare `chords`. Class scoping rules; not Svelte-specific.
- **Mutating `this.chords` from outside the class.** `progression.chords = []` works (the field is public), but it bypasses any encapsulation you intended. If you want methods to be the only mutation path, mark the field with `#` private syntax (`#chords = $state(...)`) and expose only methods and getters.
- **Putting reactive state on non-reactive places.** `class Foo { count = 0; bar = $state(0); }` — `count` is a regular field, not reactive. Reading `foo.count` in a component doesn't subscribe. Always wrap with `$state` to opt into reactivity.

### TypeScript notes

The `$state<Chord[]>(...)` generic gives you a typed reactive array. Without the generic, TS infers from the initial value:

```ts
chords = $state([]);  // inferred as never[], probably not what you want
chords = $state<Chord[]>([]);  // typed as Chord[]
chords = $state([defaultChord()]);  // inferred from the literal's element type
```

For empty initial arrays, always provide the generic.

## Concept 3: Computed properties — getter vs `$derived`

### What it is

Both forms give you a property whose value depends on other state. Their semantics differ in one important way: `$derived` caches; the getter doesn't.

A getter is just a JavaScript getter. Every time you read `progression.count`, the body runs. The runtime tracks the reads inside (e.g., `this.chords.length` registers a dependency on `this.chords`), so the surrounding component re-renders when `chords` changes. The body running every time is fine for trivial computations.

`$derived` wraps the value in a memoized cell. The body runs only when one of its tracked dependencies changes. Reads from anywhere return the cached value until the next invalidation. This pays off when the computation is non-trivial — sorting an array, summing fields, deep transforms.

For a chord progression with hundreds of items, you'd want `$derived`. For `chords.length`, a getter is fine.

### Worked example (getter)

```ts
class ProgressionStore {
  chords = $state<Chord[]>([]);
  get count() { return this.chords.length; }
  get isEmpty() { return this.chords.length === 0; }
  get totalNotes() {
    return this.chords.reduce((sum, c) => sum + c.quality.intervals.length, 0);
  }
}
```

Three getters. `count` and `isEmpty` are trivial. `totalNotes` sums across all chords; it's slightly heavier but still cheap. None of these are expensive enough to need caching.

### Worked example ($derived)

```ts
class ProgressionStore {
  chords = $state<Chord[]>([]);
  count = $derived(this.chords.length);
  rootCounts = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const c of this.chords) {
      counts.set(c.root, (counts.get(c.root) ?? 0) + 1);
    }
    return counts;
  });
}
```

`count` could be a getter; `rootCounts` is an iteration that builds a Map. With many consumers and many reads, the cached `$derived` saves work.

`$derived.by` is the function form, used when the expression is a multi-line block. `$derived(expr)` works for a single expression.

### Variations

A derived that depends on multiple state fields:

```ts
isOverLimit = $derived(this.chords.length > this.maxChords);
```

Tracks both `chords` and `maxChords`. Invalidates when either changes.

A derived that's expensive enough to want explicit caching:

```ts
encoded = $derived.by(() => encodeProgression(this.chords));
```

Encoding to base64 every render would be wasteful; encoding once per change is fine. The cache amortizes the cost.

### Common mistakes

- **Forgetting that getters re-run on every read.** A tight loop calling `progression.totalNotes` multiple times will re-run the reducer each time. Hoist into a local: `const total = progression.totalNotes; for (...) { use(total); }`.
- **Marking a non-reactive computation as `$derived`.** `$derived(someExternalCounter())` where `someExternalCounter` isn't a `$state` — the value is captured once on creation and never recomputed. The cache is the right behavior, but maybe not what you intended.
- **Using `$derived` without `.by` for a multi-statement body.** `$derived(() => { ... })` is wrong — that creates a derived whose value is a function. Use `$derived.by(() => { ... })` for the function form.

## Concept 4: Replacing Svelte 4 stores

### What it is

Svelte 4's store API is `writable`, `readable`, `derived`, plus the `$storeName` auto-subscribe syntax inside components. The shapes the rune-based pattern replaces:

```ts
// Svelte 4
import { writable, derived } from 'svelte/store';

export const chords = writable<Chord[]>([]);
export const count = derived(chords, $chords => $chords.length);

// In a component:
{#each $chords as c (c.id)} ... {/each}
{$count} chords

chords.update(arr => [...arr, newChord]);
```

Two new APIs to learn (writable/derived, plus `update`/`set`/`subscribe`). The `$store` syntax inside components is its own magic. Worked fine; was always slightly its own thing.

The rune-based pattern uses the same language as in-component state. Read a property, write a property. No `$store` prefix. The same `$state` and `$derived` you already know, in a different file.

### Worked example (side-by-side)

Svelte 4:

```ts
// store.ts
import { writable, derived } from 'svelte/store';

export const chords = writable<Chord[]>([]);
export const count = derived(chords, $c => $c.length);

export function add(c: Chord) {
  chords.update(arr => [...arr, c]);
}
```

```svelte
<!-- component -->
<script>
  import { chords, count, add } from './store';
</script>

<p>{$count} chords</p>
&lbrace;#each $chords as c (c.id)&rbrace;...&lbrace;/each&rbrace;
```

Svelte 5 with runes:

```ts
// store.svelte.ts
class Store {
  chords = $state<Chord[]>([]);
  count = $derived(this.chords.length);
  add(c: Chord) { this.chords = [...this.chords, c]; }
}
export const store = new Store();
```

```svelte
<!-- component -->
<script>
  import { store } from './store.svelte';
</script>

<p>{store.count} chords</p>
&lbrace;#each store.chords as c (c.id)&rbrace;...&lbrace;/each&rbrace;
```

Fewer concepts, more uniform syntax. Same behavior.

### Variations

Stores still work in Svelte 5. If you have a Svelte 4 library that exports stores, you can import and use them — the `$store` syntax is still valid. New code doesn't need to use them.

For state you genuinely want write-once-read-many semantics, the `readable` store has no rune equivalent. Closest is `$state` with documentation telling consumers "don't mutate this." If you need actual enforcement, expose only a getter:

```ts
class Config {
  #value = $state<Config>(loadConfig());
  get value() { return this.#value; }
  // no setter — consumers can't mutate
}
```

### Common mistakes

- **Mixing `$store` syntax with rune-based stores.** Doesn't work. The `$store` prefix is for Svelte stores specifically (anything implementing the store contract). A rune-based shared state is a plain object; no `$` prefix.
- **Trying to subscribe explicitly.** `progression.subscribe(...)` doesn't exist. Reactivity is tracked by the runtime through read/write proxies; you don't subscribe, you just read.
- **Reaching for stores out of habit.** If you're starting a Svelte 5 project, `.svelte.ts` modules are the default for shared state. Stores are for compatibility, not for first reach.

### TypeScript notes

Generic class state:

```ts
class Collection<T> {
  items = $state<T[]>([]);
  add(item: T) { this.items = [...this.items, item]; }
}

export const chords = new Collection<Chord>();
```

The class is generic; the export pins the type parameter for the single instance. Useful pattern for reusable collection shapes.

## Putting it together

Update `src/routes/+page.svelte`:

```svelte
<script>
  import * as Tone from 'tone';
  import ChordPicker from '$lib/components/ChordPicker.svelte';
  import { progression, QUALITIES } from '$lib/progression.svelte';

  let pickerRoot = $state('C');
  let pickerQuality = $state(QUALITIES[0]);

  let synth = null;
  let isPlaying = $state(false);
  let currentIndex = $state(-1);

  // ... helpers, ensureSynth, playChord, playProgression unchanged

  function handleAdd() &lbrace;
    progression.add(pickerRoot, pickerQuality);
  &rbrace;
</script>

<div class="card">
  <header class="card-head">
    <h2>Progression</h2>
    <span class="meta">{progression.count} chord{progression.count === 1 ? '' : 's'}</span>
  </header>

  <ol class="chords">
    &lbrace;#each progression.chords as c, i (c.id)&rbrace;
      <li class="chord" class:active={i === currentIndex} onclick={() => playChord(c)}>
        <span class="name">{c.root}{c.quality.label === 'major' ? '' : ' ' + c.quality.label}</span>
        <button class="remove" onclick={(e) => { e.stopPropagation(); progression.remove(c.id); }}>×</button>
      </li>
    &lbrace;/each&rbrace;
  </ol>

  <div class="add-row">
    <ChordPicker bind:root={pickerRoot} bind:quality={pickerQuality} />
    <button class="add" onclick={handleAdd}>+ ADD</button>
  </div>

  <button class="play-all" onclick={playProgression} disabled={progression.count === 0}>
    {isPlaying ? '■ STOP' : '▶ PLAY ALL'}
  </button>
</div>
```

Differences from the previous lesson:

- `progression` is imported, not local.
- `progression.chords` for iteration, `progression.count` for the meta, `progression.add(...)` and `progression.remove(...)` for mutation.
- The page is no longer the owner of the data. It's a view.

Visually identical. Architecturally, you now have a self-contained module that any component can pull from.

### A second consumer to prove it

A sidebar that summarizes the progression and can clear it:

```svelte
<!-- src/lib/components/Sidebar.svelte -->
<script>
  import { progression } from '$lib/progression.svelte';
</script>

<aside>
  <h3>Summary</h3>
  <p>{progression.count} chords</p>
  <button onclick={() => progression.clear()}>clear all</button>
</aside>
```

Drop this into the page. The sidebar reads `progression.count` and `progression.clear()` — same `progression` instance. The count updates as the main view mutates the array. Clicking "clear all" updates both panes.

No prop passing. No event bubbling. Direct, shared state.

## Exercises

### Exercise 1: A "recently removed" history

**Setup:** the `remove` method drops a chord and forgets it.

**What to do:** add a `removedHistory: Chord[]` field to ProgressionStore. Modify `remove` to push the removed chord onto the history (keeping at most the last 5). Add an `undo()` method that pops the most recent removed chord and re-inserts it at the end of the progression.

**Verify by:** removing three chords, then calling `progression.undo()` three times, restores them in reverse order. (Add an undo button in the page to test.)

**Stretch:** make undo insert the chord at its ORIGINAL position, not at the end. (Hint: save the index along with the chord in the history.)

<details>
<summary>Show solution</summary>

```ts
class ProgressionStore {
  chords = $state<Chord[]>([]);
  removedHistory = $state<{ chord: Chord; index: number }[]>([]);

  remove(id: string) {
    const index = this.chords.findIndex(c => c.id === id);
    if (index < 0) return;
    const chord = this.chords[index];
    this.chords = this.chords.filter(c => c.id !== id);
    this.removedHistory = [{ chord, index }, ...this.removedHistory].slice(0, 5);
  }

  undo() {
    const last = this.removedHistory[0];
    if (!last) return;
    this.removedHistory = this.removedHistory.slice(1);
    this.chords = [
      ...this.chords.slice(0, last.index),
      last.chord,
      ...this.chords.slice(last.index)
    ];
  }

  get canUndo() { return this.removedHistory.length > 0; }
}
```

The history is an array of `{ chord, index }` so undo can put the chord back where it was. Limiting to 5 with `.slice(0, 5)` is a simple cap. `canUndo` is a getter the UI can use to disable the button.

</details>

### Exercise 2: A read-only header counter

**Setup:** the page renders `progression.count` in the card header.

**What to do:** extract a `<ProgressionMeta />` component that imports `progression` directly and renders the count. Replace the inline `<span class="meta">...</span>` with `<ProgressionMeta />`.

**Verify by:** the meta still updates as chords are added or removed. The page component doesn't pass `count` as a prop — the meta reads it directly.

**Stretch:** add a tooltip on hover showing the unique root counts (e.g., "C: 2, A: 1, F: 1, G: 1"). Compute it as a `$derived` or getter on the store.

<details>
<summary>Show solution</summary>

```svelte
<!-- src/lib/components/ProgressionMeta.svelte -->
<script>
  import { progression } from '$lib/progression.svelte';
</script>

<span class="meta">
  {progression.count} chord{progression.count === 1 ? '' : 's'}
</span>
```

```ts
// in ProgressionStore
get rootSummary() {
  const counts = new Map<string, number>();
  for (const c of this.chords) {
    counts.set(c.root, (counts.get(c.root) ?? 0) + 1);
  }
  return [...counts].map(([r, n]) => `${r}: ${n}`).join(', ');
}
```

The component imports the store directly. No prop wiring. The page becomes one line shorter; the meta is reusable.

</details>

### Exercise 3: Migrate to `$derived`

**Setup:** `count` is a getter.

**What to do:** convert `count` to `count = $derived(this.chords.length)`. Verify nothing breaks. Then convert `rootSummary` (if you did exercise 2's stretch) to `$derived.by(() => { ... })`. Compare the experience.

**Verify by:** the UI still shows the right counts. The `$derived` cell only recomputes when `chords` changes, not on every read.

**Stretch:** in the component, add a `$inspect(progression.count)` call to log every time count changes. Confirm the log fires only when the array changes, not on unrelated state updates.

<details>
<summary>Show solution</summary>

```ts
class ProgressionStore {
  chords = $state<Chord[]>([]);
  count = $derived(this.chords.length);
  rootSummary = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const c of this.chords) counts.set(c.root, (counts.get(c.root) ?? 0) + 1);
    return [...counts].map(([r, n]) => `${r}: ${n}`).join(', ');
  });
}
```

`$inspect` is a Svelte 5 helper that logs whenever its argument changes. Useful as a quick reactivity-debugger.

```svelte
<script>
  import { progression } from '$lib/progression.svelte';
  $inspect(progression.count);
</script>
```

</details>

### Exercise 4 (stretch): A separate "favorites" store

**Setup:** there's one progression store.

**What to do:** create `src/lib/favorites.svelte.ts` that holds a `Set<string>` of favorited chord IDs (or root+quality strings). Add `toggle(id)` and `isFavorite(id)` methods. In the page, show a ★ on each chord that's a favorite; clicking it toggles.

**Verify by:** the favorites persist across re-orders and edits (they're keyed by chord ID, not by position). Adding a chord starts un-favorited.

**Stretch:** show the favorite count in the sidebar component too. Two shared stores, both consumed from multiple places.

<details>
<summary>Show solution</summary>

```ts
// src/lib/favorites.svelte.ts
class FavoritesStore {
  ids = $state(new Set<string>());

  toggle(id: string) {
    const next = new Set(this.ids);
    if (next.has(id)) next.delete(id); else next.add(id);
    this.ids = next;
  }

  isFavorite(id: string) {
    return this.ids.has(id);
  }

  get count() { return this.ids.size; }
}
export const favorites = new FavoritesStore();
```

```svelte
<script>
  import { favorites } from '$lib/favorites.svelte';
</script>

<button onclick={(e) => { e.stopPropagation(); favorites.toggle(c.id); }}>
  {favorites.isFavorite(c.id) ? '★' : '☆'}
</button>
```

Reassigning the whole `Set` (`this.ids = next`) ensures the reactivity proxy notices the change. Mutating in place (`this.ids.add(id)`) also works because Sets are wrapped by the proxy, but reassignment is the safe default.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/lib/progression.svelte.ts` with the `ProgressionStore` class and exported `progression` instance.
- `src/routes/+page.svelte` importing and using the shared store instead of local state.
- (Optionally) one or two additional components that also consume the store, proving sharedness.

### Verify it works

- The page loads with the default four chords (now defined in the store).
- Adding, removing, and playback all work as before.
- The count in the header updates as you add and remove.
- If you have a second consumer (sidebar, meta component), it stays in sync with the main view.

### Compare against the reference

`learn-svelte/capstone-reference/chord-player/src/lib/progression.svelte.ts` should match the store you wrote.

## Common questions

**Q: Is the rune-based shared state really faster than stores?**
A: Roughly equivalent for typical uses. The point isn't performance; it's that you learn one reactivity model instead of two. Both compile to similarly fine-grained tracking.

**Q: Can I subscribe to the store from non-Svelte code (e.g., a Web Worker)?**
A: No, not directly. The reactivity is implemented through Proxies that only the Svelte runtime knows how to track. If you need cross-context subscription, fall back to events (`postMessage`) or a regular pub/sub library.

**Q: What about SSR? Does the store get shared across requests?**
A: This is a real risk. A module-level singleton on the server is one instance for the whole process; multiple users hitting your SSR-rendered page would share the same `progression`. For client-only state (like a UI store), that's fine because SvelteKit re-instantiates per-client on hydration. For state that genuinely should be per-request, use SvelteKit's `locals` or a request-scoped pattern. We don't run this app server-side, so no issue here.

**Q: Can I have circular imports between stores?**
A: Avoid them. Module imports execute top-to-bottom; circular references can leave one side seeing the other's exports as `undefined`. If two stores need each other, either merge them or extract a third module they both depend on.

**Q: Should every component-level piece of state move to a `.svelte.ts` module?**
A: No. Local state should stay local. Move to a module only when more than one component genuinely needs the same state. Premature sharing makes the data flow harder to follow.

## What's next

The progression is shared and editable, but it disappears when you close the tab. The last lesson in this module persists the current progression to localStorage with an `$effect` that auto-saves, adds named save slots, and lets you share a progression by URL with no backend at all. You'll see `$effect.root` (effects outside a component), `$state.snapshot` (non-reactive copies of reactive data), and SvelteKit dynamic routes for receiving shared links.

<SourcesSection lessonKey="04-chord-player/04-shared-state" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
