<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>The Step Grid · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-6);">

<LessonHeader
  moduleSlug="06-capstone-foundations"
  lessonSlug="02-step-grid"
  title="Build the 4×16 Step Grid"
  blurb="Toggle cells, see them light up. Per-track color, per-cell reactivity — the visual heart of the DAW."
/>

## Why this lesson exists

The 4-button drum pad from L1 proves the audio engine works. It doesn't look like a DAW. The visual heart of a step sequencer is the grid: rows are tracks, columns are 16th-note steps, lit cells fire their sound when the playhead reaches them. Building the grid before wiring audio playback gives us two wins. First, we get to focus on the UI in isolation — the grid is non-trivial in styling and reactive behavior, and it's easier to debug visual issues without audio in the mix. Second, the data shape we settle on for `pattern` is what the sequencer callback in L3 will read from on the audio thread.

This lesson is heavier on Svelte than audio. By the end you'll have a 64-cell grid that mutates correctly under per-cell clicks, animates its lit state, shows downbeat indicators, and themes each row by its track color. It will look like a DAW. It will not yet make sound when you click play (there is no play button yet). That comes in L3.

## Learning objectives

By the end of this lesson you'll be able to:

- Model a step pattern as a `Record<trackId, number[]>` and explain why this shape beats the alternatives.
- Mutate nested reactive state and rely on Svelte 5's proxy to surface the change without copy-and-replace.
- Write per-cell click handlers that update exactly one DOM node per click — no row re-renders, no grid re-renders.
- Use CSS custom properties on a row element to theme every descendant via the cascade.
- Add downbeat indicators that make a 16-step row visually scannable.

## Concept 1: Pattern as `Record<string, number[]>`

### The shape

Each track is a row of 16 cells. A cell is on or off. Four tracks total. The natural data shape:

```ts
type Pattern = Record<string, number[]>;
```

Where each array has length 16 and contains 0s and 1s. We're using numbers instead of booleans because (a) they're a hair faster to JSON-serialize, (b) they map directly to gain multipliers if we later want per-cell velocity (a 0.7 means "75% volume"), and (c) the `class:on` directive does the right thing for any truthy value.

### Add it to the engine

Open `src/lib/audio/engine.svelte.ts` and extend the `AudioEngine` class:

```ts
class AudioEngine {
  // ... existing isReady / isLoading / loadError ...

  pattern = $state<Record<string, number[]>>({
    kick:  [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
    hat:   [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    perc:  [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1]
  });

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
      this.pattern[t.id] = Array.from(
        { length: 16 },
        () => (Math.random() < density ? 1 : 0)
      );
    }
  }

  // ... rest of class
}
```

Five things worth pointing out:

- **`$state<Record<string, number[]>>({...})`**. The generic spells out the shape explicitly. The compiler would infer it, but a future reader (probably you in two weeks) benefits from the annotation.
- **Default pattern is opinionated.** Boom-bap-ish. Anything specific beats an empty grid: the user immediately hears a beat when L3 ships and they hit play. An empty default forces the user to click 16 cells before anything happens, which is bad onboarding.
- **`toggleCell` mutates.** This is the per-cell story. We'll dwell on it in Concept 3 because it's important and the reflexes you have from React point the wrong direction.
- **`clearPattern` replaces each row.** Assigning a new array to `pattern[t.id]` triggers reactivity for every cell of that row (they all change identity), which is the right semantics for "wipe the row."
- **`randomizePattern(density)` defaults to 0.25.** A 25% density gives 4 hits per 16-step row on average — sparse enough to be interesting, dense enough to feel like a beat.

### Why not `boolean[][]`?

Two-dimensional arrays would work. The reasons to prefer `Record<string, number[]>`:

- **Stable IDs survive reordering.** If you let the user reorder tracks, the indices in `boolean[][]` shift; the IDs in `Record<...>` don't. Future-proofing.
- **JSON-friendly for sharing.** When we URL-encode the pattern in L4, `{ kick: [1,0,0,...], snare: [...] }` is short and self-documenting. A 2D array is shorter but loses the track-name labels.
- **Mirrors `TRACKS`.** Looking up a pattern row for track `t` is `pattern[t.id]`, which reads the way you'd describe it. Index lookups (`pattern[TRACKS.indexOf(t)]`) are noise.

### Common mistakes with the pattern shape

- **You declare it as `Record<TrackId, number[]>` with a `TrackId = 'kick' | 'snare' | ...` union.** Tighter, but every UI loop that iterates `TRACKS` has to cast or you get TS errors when iterating the dynamic-string `track.id`. The `Record<string, number[]>` is honest about how it's used.
- **You initialize with `Array(16).fill(0)` once and pass it to every track.** All four tracks share the same array. Mutating one mutates all. Use `new Array(16).fill(0)` or `Array.from({ length: 16 }, () => 0)` per row.
- **You initialize as `[]` and grow it on first toggle.** Now reads of `pattern[id][step]` are `undefined` for unset cells. The sequencer in L3 treats `undefined` as falsy, so it kinda works, but the grid's `{#each audio.pattern[track.id] as on, i}` renders zero cells. Always pre-fill to length 16.

## Concept 2: The Sequencer component

### A first pass

```svelte
<!-- src/lib/components/Sequencer.svelte -->
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';
  import { TRACKS } from '$lib/audio/tracks';
</script>

<div class="grid" role="grid" aria-label="Step sequencer">
  {#each TRACKS as track (track.id)}
    <div class="row" style="--c-track: {track.color}">
      <div class="row-label">
        <span class="color-bar"></span>
        <span class="track-name">{track.name}</span>
      </div>
      <div class="cells">
        {#each audio.pattern[track.id] as on, i (i)}
          <button
            class="cell"
            class:on
            class:downbeat={i % 4 === 0}
            type="button"
            onclick={() => audio.toggleCell(track.id, i)}
            aria-label={`${track.name} step ${i + 1}: ${on ? 'on' : 'off'}`}
          ></button>
        {/each}
      </div>
    </div>
  {/each}
</div>
```

The structure: outer `.grid` with a `.row` per track. Each row has a `.row-label` (track name + color swatch) and a `.cells` container that grids 16 buttons. Each button has `class:on` (the lit state) and `class:downbeat` (the every-4th-cell accent).

The visible markup is about 20 lines. The interesting part is the inline `style="--c-track: {track.color}"` — Concept 4 — and the `(i)` key on the inner each — let's talk about that now.

### Why `{#each audio.pattern[track.id] as on, i (i)}`

The keyed-each form locks each iteration to a specific identity. For a fixed-length array of 16 numbers, the identity is the index (`(i)`). The cell at step 5 stays mounted to the same DOM button across re-renders; only its `on` value and class change.

The unkeyed alternative — `{#each audio.pattern[track.id] as on, i}` — works correctly here because the array length never changes. But the keyed form is more honest about your intent and protects you if the array length ever becomes dynamic. In M2 you saw this in the survey-results lesson; same rule applies.

### The styles

```svelte
<style>
  .grid {
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    padding: var(--sp-3);
    display: flex;
    flex-direction: column;
    gap: 6px;
    user-select: none;
  }

  .row {
    --c-track: #888;
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: var(--sp-3);
    align-items: center;
  }

  .row-label {
    display: grid;
    grid-template-columns: 6px 1fr 14px;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    height: 36px;
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
  }
  .color-bar {
    width: 4px;
    height: 18px;
    background: var(--c-track);
    border-radius: 2px;
    box-shadow: 0 0 8px -2px var(--c-track);
  }
  .track-name {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text);
    letter-spacing: 0.06em;
  }

  .cells {
    display: grid;
    grid-template-columns: repeat(16, 1fr);
    gap: 4px;
  }

  .cell {
    position: relative;
    height: 36px;
    background: color-mix(in srgb, var(--c-track) 6%, var(--c-surface));
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    cursor: pointer;
    padding: 0;
    transition: background var(--d-fast), border-color var(--d-fast),
      transform 80ms var(--ease-spring);
    overflow: hidden;
  }
  .cell:hover {
    background: color-mix(in srgb, var(--c-track) 18%, var(--c-surface));
    border-color: color-mix(in srgb, var(--c-track) 60%, var(--c-border));
  }
  .cell.downbeat::before {
    content: '';
    position: absolute;
    top: 4px;
    left: 4px;
    width: 4px;
    height: 4px;
    border-radius: 99px;
    background: color-mix(in srgb, var(--c-track) 50%, transparent);
  }
  .cell.on {
    background: var(--c-track);
    border-color: var(--c-track);
    box-shadow: 0 0 12px -3px var(--c-track);
  }
  .cell.on:hover { transform: translateY(-1px); }

  @media (max-width: 720px) {
    .row { grid-template-columns: 64px 1fr; gap: var(--sp-2); }
    .row-label { padding: 6px; grid-template-columns: 4px 1fr 10px; }
    .cell { height: 28px; }
  }
</style>
```

The CSS uses the design tokens shared across the course (`--c-bg-code`, `--c-surface`, `--c-border`, `--c-accent`, `--font-mono`, etc.) so the DAW slots into the same visual system as the lesson site. In a brand-new project you'd want to define these globally first — copy the token block from `capstone-reference/src/app.css` if you want a quick start.

Two CSS tricks worth pointing at:

- **`color-mix(in srgb, var(--c-track) 6%, var(--c-surface))`** — modern CSS for "tint the surface 6% toward the track color." Replaces what used to require Sass or a hand-rolled `rgba()` calculation per track color.
- **`.cell.downbeat::before`** — a 4×4 dot in the corner of every 4th cell. We talk about why in Concept 5.

### Using it on the page

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import Sequencer from '$lib/components/Sequencer.svelte';
</script>

<svelte:head><title>SVELTE DAW</title></svelte:head>

<h1>SVELTE <span class="accent">DAW</span></h1>
<Sequencer />

<style>
  :global(body) {
    background: var(--c-bg, #0a0b10);
    color: var(--c-text, #ecedf3);
    font-family: system-ui;
    margin: 0;
    padding: 32px;
  }
  h1 { letter-spacing: 0.1em; margin-bottom: 24px; }
  .accent { color: var(--c-accent, #ff3e00); }
</style>
```

Run `npm run dev`. You see the grid. Click cells; they toggle with a glow. Click already-lit cells; they go dark.

The drum-pad page from L1 is gone now. We'll bring back trigger buttons differently in L3 (a real transport bar). For now the grid is the whole UI.

## Concept 3: Per-cell reactivity — what's actually happening

### The mutation

```ts
toggleCell(trackId: string, step: number) {
  this.pattern[trackId][step] = this.pattern[trackId][step] ? 0 : 1;
}
```

A single nested assignment. No spread, no copy, no `set` call. In a React component you'd write something like:

```jsx
// React equivalent
setPattern((prev) => ({
  ...prev,
  [trackId]: prev[trackId].map((v, i) => (i === step ? (v ? 0 : 1) : v))
}));
```

Three nested copies (object spread, array map, conditional ternary) to avoid mutation, because React's identity-tracking diff requires a new reference to detect change.

Svelte 5's reactivity does identity-tracking too, but through proxies, not through reference comparison. The runtime wraps your `$state` object in a `Proxy`. When you write `this.pattern[trackId][step] = 0`, the proxy intercepts the set. It knows which signals are subscribed to that specific cell read, and it invalidates only those signals.

### What re-renders

For a click on kick's step 5, exactly these things re-evaluate:

- The kick row's step-5 cell — because it reads `on` from `audio.pattern.kick[5]`.
- The aria-label string for that cell (same reason).

That's it. The other 63 cells don't re-evaluate. The row label doesn't. The grid container doesn't. The header doesn't. The compiled output literally updates one button's class list and one aria-label attribute per click.

You can verify this. Add `console.log('rendering', track.id, i)` inside the inner each (you'd need to wrap it in something — the each block doesn't accept arbitrary JS — but you can move the markup into a child component and log in the component's setup). You'll see four logs on first mount, then nothing on toggles. Single-cell granularity, by default, with no `memo` calls.

### Why mutation works here but is foot-gunny in some places

The proxy approach works for any object/array operation: `arr[i] = x`, `arr.push(x)`, `arr.splice(i, 1)`, `obj.foo = bar`, `obj.foo.bar = baz`. The runtime intercepts each of these on the live proxy.

What doesn't work: replacing the reactive root with a plain object. If you wrote `audio.pattern = JSON.parse(JSON.stringify(audio.pattern))`, you'd lose reactivity unless the assignment goes through the proxy correctly. In practice, the rune's setter handles this — assigning to the top-level `pattern` field replaces the proxy with a new one, and Svelte's compiler re-instruments. But if you keep a local non-reactive copy and mutate that, you're off the reactive graph. Be deliberate about where the source of truth lives.

### Common mistakes with per-cell reactivity

- **You write `audio.pattern = { ...audio.pattern, kick: [...audio.pattern.kick] }` instead of mutating.** Works, but every cell of the kick row re-evaluates because the row identity changed. The whole point of the proxy is to avoid that. Just mutate.
- **You expect a `console.log` placed inside the each block to fire on every keystroke.** It only fires when the block re-evaluates, which is when the array's identity changes or its length changes — not when cells inside change. (Per-cell logs need to be inside a child component that reads the cell value.)
- **You read `audio.pattern.kick.length` somewhere and the read tracks the wrong dependency.** Length is fine, but the each block also subscribes to `audio.pattern.kick` (the array reference). Replacing the array (which we do in `clearPattern`) re-evaluates the each block; mutating cells doesn't.
- **You bind `onclick` to a function that captures the outer `track` variable in a way that's stale.** With `{#each TRACKS as track}` and an inline `onclick={() => audio.toggleCell(track.id, i)}`, `track` is captured fresh each iteration, so this is fine. The bug shows up if you assign the handler to a variable outside the each — don't.

## Concept 4: Per-track color via CSS custom properties

### The pattern

```svelte
<div class="row" style="--c-track: {track.color}">
  <span class="color-bar"></span>
  <button class="cell" class:on></button>
</div>
```

```css
.color-bar { background: var(--c-track); }
.cell {
  background: color-mix(in srgb, var(--c-track) 6%, var(--c-surface));
  border-color: var(--c-border);
}
.cell:hover {
  background: color-mix(in srgb, var(--c-track) 18%, var(--c-surface));
}
.cell.on {
  background: var(--c-track);
  box-shadow: 0 0 12px -3px var(--c-track);
}
```

The row sets `--c-track` as an inline CSS custom property. Every descendant resolves `var(--c-track)` to that value via the cascade. The color bar, the cell hover state, the lit-cell background, the lit-cell glow shadow — all driven by one variable, set in one place.

To add a fifth track, you add it to `TRACKS` with a `color` field. The grid picks it up automatically. No prop drilling, no theme regeneration, no SCSS variables to add. The cascade is doing the work.

### What CSS custom properties give you that JS-driven styling doesn't

The alternative pattern — set the colors in JS, pass as inline `style` to each cell — gets you the same visual result but with three problems:

- **Every cell's inline style is a separate string the compiler generates and writes.** With 64 cells × multiple states, the inline-style churn on hover/toggle would be noticeable.
- **CSS-only effects break.** `:hover` lives in CSS, not in your component. If your hover state depends on the track color, you need it accessible from CSS. Custom properties make it accessible.
- **Compounding gets messy.** `color-mix(in srgb, var(--c-track) 18%, var(--c-surface))` is one CSS line. The JS equivalent is parsing your color, blending it with the surface color, formatting back to a string. Not hard, just unnecessary.

CSS custom properties are the right tool when you have a value that drives a visual treatment and you want the cascade to apply it.

### Common mistakes with the custom-property pattern

- **You set `--c-track` on the `.cells` container instead of the `.row`.** Now the row label's color bar can't see it. Set the property as high in the row's tree as you need it visible.
- **You use the custom property in a place outside the row's subtree.** Custom properties cascade down, not across. A neighboring DOM tree can't read another tree's properties.
- **You write `style="--c-track: {track.color};"` with a stray semicolon.** Valid CSS, no issue, but worth noting that the inline-style attribute is fine without trailing semicolons.
- **You attempt to animate a custom property via `transition: --c-track 200ms`.** This requires registering the property with `@property { ... }` for the browser to know it's a `<color>`. Without registration, custom properties are typed as strings and don't animate. The DAW doesn't need this, but it's a gotcha if you go looking for it.

## Concept 5: Downbeat indicators and the ruler

### Why every 4th cell looks different

A 16-step row is one bar in 4/4 time: four beats of four 16th notes each. Reading "boom-bap-bap-bap-boom-bap-bap-bap..." without a visual cue for where each beat starts is hard. The convention every step sequencer uses is to mark the downbeats (steps 1, 5, 9, 13) somehow — a brighter background, a small dot, a separator line.

The dot version:

```css
.cell.downbeat::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  width: 4px;
  height: 4px;
  border-radius: 99px;
  background: color-mix(in srgb, var(--c-track) 50%, transparent);
}
```

A 4×4 dot in the top-left corner of every 4th cell. The dot uses the track's color at 50% opacity, so it's visible but not loud. Subtle enough you don't notice it on individual cells, useful enough to count beats.

### Adding the step-number ruler

The reference adds a ruler row at the top of the grid that shows the step numbers (01–16). The ruler is decorative but useful — it lets you point at a step ("oh, the snare on 13") without counting cells.

Add this above the `{#each TRACKS}` loop in `Sequencer.svelte`:

```svelte
<div class="ruler" aria-hidden="true">
  <div class="ruler-spacer"></div>
  <div class="ruler-cells">
    {#each Array(16) as _, i (i)}
      <div
        class="ruler-cell lcd"
        class:downbeat={i % 4 === 0}
      >
        {String(i + 1).padStart(2, '0')}
      </div>
    {/each}
  </div>
</div>
```

And the styles:

```css
.ruler {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: var(--sp-3);
  align-items: center;
  padding-bottom: 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--c-border) 60%, transparent);
  margin-bottom: 2px;
}
.ruler-cells {
  display: grid;
  grid-template-columns: repeat(16, 1fr);
  gap: 4px;
}
.ruler-cell {
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--c-text-faint);
}
.ruler-cell.downbeat { color: var(--c-text-muted); }
```

`aria-hidden="true"` because the ruler is purely decorative — the cells themselves already have aria-labels with the step number, so screen reader users don't need to hear the ruler.

The grid-template-columns of the ruler match the rows below it (`90px 1fr`) so the step labels align with the cells. This is the brittle part of CSS grid layouts — if you change `90px` in one place you need to change it in two more. A future refactor could lift the value into a custom property.

### Common mistakes with the ruler / downbeats

- **The ruler's 16 columns don't line up with the cells.** Usually because the ruler's `.ruler-spacer` has a different width than the row label, or the gap values don't match. Fix by using a CSS custom property for the label width and the gap.
- **You added the ruler but forgot the spacer.** Now the ruler starts at the left edge of the page and the labels point at the wrong cells. The spacer matches the row-label column.
- **The downbeat dot looks misaligned at smaller sizes.** Mobile breakpoint shrinks `.cell` to 28px height; if the dot's `top: 4px` made it look centered at 36px, it'll look off-center at 28px. Either accept it (the dot is decorative) or scale it via the breakpoint too.

## Putting it together

The full `Sequencer.svelte` after L2:

```svelte
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';
  import { TRACKS } from '$lib/audio/tracks';
</script>

<div class="grid" role="grid" aria-label="Step sequencer">
  <div class="ruler" aria-hidden="true">
    <div class="ruler-spacer"></div>
    <div class="ruler-cells">
      {#each Array(16) as _, i (i)}
        <div class="ruler-cell" class:downbeat={i % 4 === 0}>
          {String(i + 1).padStart(2, '0')}
        </div>
      {/each}
    </div>
  </div>

  {#each TRACKS as track (track.id)}
    <div class="row" style="--c-track: {track.color}">
      <div class="row-label">
        <span class="color-bar"></span>
        <span class="track-name">{track.name}</span>
      </div>
      <div class="cells">
        {#each audio.pattern[track.id] as on, i (i)}
          <button
            class="cell"
            class:on
            class:downbeat={i % 4 === 0}
            type="button"
            onclick={() => audio.toggleCell(track.id, i)}
            aria-label={`${track.name} step ${i + 1}: ${on ? 'on' : 'off'}`}
          ></button>
        {/each}
      </div>
    </div>
  {/each}
</div>
```

About 30 lines of markup, 80 lines of CSS. A 64-cell interactive grid with per-cell reactivity, per-track theming, downbeat indicators, a ruler, hover affordances, accessibility labels. The framework did a lot of the work — the interactive reactive part is the inner `onclick` and `class:on` lines, which are about three lines combined.

## Exercises

### Exercise 1: A clear-all button on the page

**Setup:** the engine has `clearPattern()` and `randomizePattern()` methods. They exist but nothing in the UI calls them.

**What to do:** add two buttons above the `<Sequencer />` on the page: one labeled "clear" that calls `audio.clearPattern()`, one labeled "rand" that calls `audio.randomizePattern()`.

**Verify by:** clicking "clear" empties the grid (all cells dark). Clicking "rand" fills it with a random sparse pattern. Repeated clicks on "rand" generate different patterns each time.

**Stretch:** the "rand" button takes a density argument. Add a slider next to it (0.0 to 1.0) that controls density. A density of 0 gives an empty pattern; 1.0 fills every cell.

<details>
<summary>Show solution</summary>

```svelte
<script lang="ts">
  import Sequencer from '$lib/components/Sequencer.svelte';
  import { audio } from '$lib/audio/engine.svelte';

  let density = $state(0.25);
</script>

<div class="controls">
  <button type="button" onclick={() => audio.clearPattern()}>clear</button>
  <button type="button" onclick={() => audio.randomizePattern(density)}>rand</button>
  <input type="range" min="0" max="1" step="0.05" bind:value={density} />
  <span>{density.toFixed(2)}</span>
</div>

<Sequencer />
```

`randomizePattern` replaces each row with a new array of length 16. Every cell of the grid re-evaluates because the array identity changed — exactly the behavior we want for a "regenerate the whole pattern" action.

</details>

### Exercise 2: A row-level clear

**Setup:** the engine has `clearPattern()` (whole grid) but not a per-row equivalent.

**What to do:** add a `clearRow(trackId: string)` method to the engine. Add a tiny "×" button to each row's label area that calls it for that track.

**Verify by:** clicking the × on the snare row clears only the snare. The other rows are unaffected.

**Stretch:** make the row clear hold a confirmation modal/inline-confirm — first click arms it, second click within 2 seconds confirms.

<details>
<summary>Show solution</summary>

```ts
// engine.svelte.ts
clearRow(trackId: string) {
  this.pattern[trackId] = new Array(16).fill(0);
}
```

```svelte
<!-- Sequencer.svelte -->
<div class="row-label">
  <span class="color-bar"></span>
  <span class="track-name">{track.name}</span>
  <button
    class="row-clear"
    type="button"
    onclick={() => audio.clearRow(track.id)}
    aria-label={`Clear ${track.name}`}
  >×</button>
</div>
```

The assignment `pattern[trackId] = new Array(16).fill(0)` replaces the row array; every cell of that row's each block re-evaluates with the new (zero) values. Other rows are untouched.

</details>

### Exercise 3: A copy-row affordance

**Setup:** sometimes you want to mirror one track to another (copy the hat onto perc as a starting point, then mutate).

**What to do:** add a `copyRow(fromId: string, toId: string)` method to the engine. Wire up a UI affordance (right-click? long-press? Two small buttons?) to invoke it. Pick whatever interaction you want.

**Verify by:** copy the kick to the snare. Snare now plays the kick's pattern. Toggle a cell on the snare — kick is unchanged (proves it's a copy, not a reference).

**Stretch:** add an "undo" button. Stash the previous pattern before each operation; clicking undo restores it.

<details>
<summary>Show solution</summary>

```ts
copyRow(fromId: string, toId: string) {
  // Slice to get a fresh array — without it, snare and kick would share
  // the same underlying array and edits would mirror.
  this.pattern[toId] = this.pattern[fromId].slice();
}
```

```svelte
<!-- A dead-simple dropdown UI per row -->
<select onchange={(e) => audio.copyRow(e.currentTarget.value, track.id)}>
  <option value="">copy from...</option>
  {#each TRACKS.filter(t => t.id !== track.id) as src}
    <option value={src.id}>{src.name}</option>
  {/each}
</select>
```

The `.slice()` is load-bearing — without it, mutating one row would mutate both. This is the "primitives vs references" thing JavaScript hands you. Arrays are references.

</details>

### Exercise 4 (stretch): Drag to paint

**Setup:** the current interaction is click-to-toggle. Drag-to-paint (hold down, drag across cells, they all turn on) is a common DAW pattern.

**What to do:** implement drag-to-paint on the grid. Mousedown on a cell starts a paint session, the session remembers whether you're painting-on or painting-off based on the first cell's state, mouseenter on subsequent cells while still pressed applies the paint.

**Verify by:** drag across an empty row — all cells in the drag path turn on. Drag across a lit row — all cells in the drag path turn off. Releasing the mouse ends the session.

**Stretch:** make it touch-friendly. `pointermove` events handle both mouse and touch.

<details>
<summary>Show solution</summary>

```svelte
<script lang="ts">
  // ... existing imports
  let painting: 0 | 1 | null = $state(null);

  function startPaint(trackId: string, step: number) {
    const current = audio.pattern[trackId][step];
    const next: 0 | 1 = current ? 0 : 1;
    painting = next;
    audio.pattern[trackId][step] = next;
  }

  function paintCell(trackId: string, step: number) {
    if (painting === null) return;
    audio.pattern[trackId][step] = painting;
  }

  function endPaint() { painting = null; }
</script>

<svelte:window onpointerup={endPaint} />

<!-- inside the cells loop -->
<button
  class="cell"
  class:on
  onpointerdown={() => startPaint(track.id, i)}
  onpointerenter={(e) => { if (e.buttons & 1) paintCell(track.id, i); }}
></button>
```

The `e.buttons & 1` check confirms the primary mouse button is still held during the enter event. `<svelte:window onpointerup>` catches the release even if the cursor has left the cell.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/lib/components/Sequencer.svelte` (new)
- pattern state in `engine.svelte.ts` (a `pattern` $state field and `toggleCell`, `clearPattern`, `randomizePattern` methods)
- the page imports and renders `<Sequencer />`

### Verify it works

- A 4×16 grid renders on the page
- A step-number ruler (01–16) appears above the grid with downbeat positions visually distinct
- Each row uses its track's color (kick orange, snare pink, hat teal, perc purple)
- Clicking any cell toggles its lit state with a glow effect
- Every fourth cell shows a small corner dot (the downbeat indicator)
- The default pattern is pre-filled (boom-bap-ish)
- Hovering a cell shows a subtle tinted background
- Resizing the window down to mobile width shrinks cells to 28px height without breaking the layout

### Compare against the reference

If your version doesn't match: `capstone-reference/src/lib/components/Sequencer.svelte` — the full sequencer component. For L2 your version should omit the `class:current` (playhead) styling, the mute-aware visuals, and the per-row mute button — those land in L3 and L7.

The reference project lives at `learn-svelte/capstone-reference/` in this repo. Run it locally — `cd capstone-reference && npm install && npm run dev` — to see a verified working version. If your DAW doesn't match the reference behaviorally, the bug is in your code, not the framework.

## Common questions

**Q: Why store `0`/`1` instead of `true`/`false`?**
A: Three small wins. (1) The compiled JS for `class:on={cell.on}` and `class:on={cell}` is identical — both check truthiness. (2) Numbers JSON-encode shorter (`1` vs `true`). (3) Future-proof for per-cell velocity: a 0.7 means a softer hit. Most production DAWs store velocity per cell.

**Q: Why iterate `TRACKS` instead of `Object.keys(audio.pattern)`?**
A: Two reasons. (1) `TRACKS` defines the ordering — kick, snare, hat, perc — and you want that ordering preserved in the UI. Object key order is reliable in modern JS but conceptually a side effect. (2) `TRACKS` carries the name and color; the pattern object only carries the data. Iterating `TRACKS` and looking up the pattern row gives you all the metadata in one go.

**Q: Should the grid be a child component per row, or one big grid?**
A: For 4 rows it doesn't matter. If you scaled to 16+ tracks, splitting each row into its own `<TrackRow>` component would help isolate re-renders (though Svelte's per-cell reactivity already keeps this cheap). The reference uses one big grid for readability.

**Q: Why not store `pattern` as a flat `number[]` of length 64?**
A: Same reason as `boolean[][]` — looking up a cell becomes `pattern[trackIndex * 16 + step]`, which is unreadable and error-prone. The `Record<id, number[]>` mirrors how you think about the data.

**Q: How does Svelte know which DOM node to update when I mutate one cell?**
A: At compile time, the each-block produces code that subscribes each iteration's `on` expression to a signal. Mutating `audio.pattern.kick[5]` invalidates exactly the signal subscribed by the kick row's index-5 iteration. The compiled runtime then updates the corresponding DOM node's class list. The mechanism is per-binding, not per-component or per-element.

## What's next

L3 wires audio. The grid you built starts making sounds when the playhead reaches each lit cell. We add `Tone.Sequence` for sample-accurate scheduling, a TransportBar (PLAY / STOP / BPM), and a `currentStep` cursor that highlights cells in sync with the audio. The reactivity story stays the same — what changes is who's calling `toggleCell` (still you, the user) versus who's reading `pattern` (now also the audio thread, every 16th note).

<SourcesSection lessonKey="06-capstone-foundations/02-step-grid" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
