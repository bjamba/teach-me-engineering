<script>
  import OpenTheHood from '$lib/components/OpenTheHood.svelte';
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Subdivisions and Snippets · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-3);">

<LessonHeader
  moduleSlug="03-metronome-studio"
  lessonSlug="04-subdivisions"
  title="Subdivisions and Snippets"
  blurb="Pick quarter / eighth / triplet / sixteenth notes. A subdivision picker built with snippets — Svelte 5's replacement for slots."
/>

## Why this lesson exists

A serious metronome lets you pick the subdivision: quarter notes are the basic pulse, eighth notes are twice as fast, triplets are three per beat, sixteenths are four per beat. Practicing odd subdivisions is a thing musicians actually do — drummers practice triplet rolls, guitarists work through sixteenth-note runs, pianists drill compound time. A metronome that only does quarter notes is a half-built tool.

The subdivision picker is also a perfect excuse to introduce snippets — Svelte 5's flexible answer to "how does the parent pass markup to the child." If you've used Svelte 4 you'll remember `<slot>` (the default-content insertion point) and named slots (`<slot name="foo">`). Snippets replace both, plus add the feature that slots never had: parameters. The child can call back into the parent's markup with arguments. That's the kind of thing you don't realize you needed until you have it, and then you reach for it constantly.

The audio side of this lesson is also more interesting than it sounds. Switching subdivisions while playing means rebuilding the Tone.Loop — and using the unconditional-read pattern again, since the rebuild needs to be reactive to subdivision changes. You'll see the same `$effect` pattern from lesson 2 applied to a different problem.

## Learning objectives

By the end of this lesson you'll be able to:

- Encode musical subdivisions as data and switch the Tone.Loop's interval based on a selected subdivision.
- Use `$effect` + the unconditional-read pattern to rebuild the audio loop when its source data changes.
- Declare a snippet prop in a component and render it with `&lbrace;@render snippetName(args)&rbrace;`.
- Define a snippet in a parent component with `&lbrace;#snippet name(args)&rbrace; ... &lbrace;/snippet&rbrace;` and pass it to a child.
- Distinguish snippets from `$children` and from Svelte 4's slot system.
- Build a small, reusable picker component that takes options and a renderOption snippet.

## Concept 1: Encoding subdivisions as data

### What the data model is

A subdivision is more than just a Tone.js notation string. It has a display name, a symbol, the Tone notation, and (for accent logic) the number of clicks per beat.

```js
const SUBDIVISIONS = [
  { id: 'quarter',  label: '𝅘𝅥',  notation: '4n',  ticksPerBeat: 1 },
  { id: 'eighth',   label: '𝅘𝅥𝅮',  notation: '8n',  ticksPerBeat: 2 },
  { id: 'triplet',  label: '𝅘𝅥𝅮𝅘𝅥𝅮𝅘𝅥𝅮', notation: '8t',  ticksPerBeat: 3 },
  { id: 'sixteenth', label: '𝅘𝅥𝅯', notation: '16n', ticksPerBeat: 4 }
];

let subdivision = $state(SUBDIVISIONS[0]);
```

Each entry has:

- **`id`** — a stable string for use as a key (in `&lbrace;#each&rbrace; ... (option.id)&rbrace;`) and for equality checks.
- **`label`** — a unicode music symbol for display. The characters in the source above are real Unicode (`U+1D15F` etc.), part of the Musical Symbols block. You can copy them from Wikipedia's musical-symbols article.
- **`notation`** — the Tone.js musical-time string. We pass this to `new Tone.Loop(callback, notation)`.
- **`ticksPerBeat`** — how many clicks fall within one quarter note's worth of time. Used to compute accent positions.

The `subdivision` state starts at the quarter-note default. The UI lets the user switch it; the audio loop reads it.

### Why encode it this way

A common alternative is to encode it as parallel arrays: one for labels, one for notations, one for ticksPerBeat counts, and an `index` state pointing into all of them. This works but couples the arrays by position — getting them out of sync is a class of bug that doesn't exist with the array-of-objects shape.

Another alternative is a flat enum: `let subdivision = $state('quarter')` and a lookup function `getNotation(subdivision)`. This loses the data locality — the metronome has to call the lookup function every time it needs the notation. The array-of-objects keeps everything related together.

For a four-element list, any of these works. I prefer the array-of-objects because it scales: if you later want to add metadata (a description, a difficulty rating, an icon), you add a property to the object. With parallel arrays you'd add another array.

### Worked example: the four subdivisions

The four I picked:

- **Quarter (`'4n'`, 1 click per beat).** At 120 BPM, one click every 500ms. The default.
- **Eighth (`'8n'`, 2 clicks per beat).** Two clicks per 500ms — 250ms apart. Twice as fast.
- **Triplet (`'8t'`, 3 clicks per beat).** Three clicks evenly within 500ms — 167ms apart. The Tone notation `'8t'` is "eighth-note triplet" — three of them fill a quarter note.
- **Sixteenth (`'16n'`, 4 clicks per beat).** Four clicks per beat — 125ms apart. Standard "fast subdivision" practice tempo.

Musicians could add more: dotted eighths, septuplets, fives. Tone supports all of them. For a teaching metronome these four are enough.

### Common mistakes with the data model

- **Using floats for `ticksPerBeat`.** Doesn't work for triplets (3 isn't a power of 2). The integer `ticksPerBeat` plus modulo arithmetic handles every subdivision evenly.
- **Forgetting that `'4n'` (lowercase 'n') is different from `'4N'`.** Tone is case-sensitive. Use lowercase.
- **Storing the active subdivision as an `id` string instead of the full object.** Then you have to look up the object every time. Storing the object directly is simpler.
- **Mutating an entry in `SUBDIVISIONS`.** Don't. Keep the array immutable; if the user customizes, build a new array with the override.

## Concept 2: Rebuilding the loop when the subdivision changes

### Why rebuilding is needed

`Tone.Loop` is created with a fixed interval (`new Tone.Loop(cb, '4n')`). Changing the loop's interval after creation isn't a single property assignment — you have to dispose the existing loop and build a new one. The Loop holds internal scheduling state that's tied to the interval.

So the pattern is: when the subdivision changes, dispose the old loop and build a fresh one.

### The buildLoop function

Factor the loop construction into a function:

```js
function buildLoop() {
  if (loop) loop.dispose();
  loop = new Tone.Loop((time) => {
    const isAccent = beat % subdivision.ticksPerBeat === 0;
    const isDownbeat = beat % (subdivision.ticksPerBeat * 4) === 0;
    const pitch = isDownbeat ? 'C4' : isAccent ? 'C3' : 'C2';
    const vel = isDownbeat ? 0.9 : isAccent ? 0.7 : 0.4;
    synth.triggerAttackRelease(pitch, '32n', time, vel);
    Tone.Draw.schedule(() => {
      pulse++;
      beat++;
    }, time);
  }, subdivision.notation);
  loop.start(0);
}
```

A few things to notice:

- **Three accent levels.** A downbeat (every group of 4 beats — the "ONE" in "ONE-two-three-four"), a beat accent (every subdivision boundary — beats 2, 3, 4 if we're playing sixteenths), and the off-beats (the in-between clicks). Different pitches and velocities for each. This is what makes a metronome FEEL like a metronome rather than a generic clock.
- **`triggerAttackRelease(pitch, dur, time, velocity)` with the velocity arg.** Lower velocity = quieter. Off-beats are 0.4, accents 0.7, downbeats 0.9. The dynamics are what make the pulse audibly hierarchical.
- **`subdivision.notation`** is passed to the Loop constructor. When the subdivision changes, the next `buildLoop()` call uses the new notation.

### Rebuilding on subdivision change

We want the loop to rebuild whenever `subdivision` changes — but only if we're actually playing. The pattern is the unconditional-read effect from lesson 2:

```js
$effect(() => {
  const sub = subdivision;            // unconditional read
  if (isPlaying && synth) {
    beat = 0;
    buildLoop();
  }
});
```

`const sub = subdivision` runs first so the effect always tracks `subdivision`. Then the guard: only rebuild if we're playing (otherwise there's no loop to rebuild — it'll be built fresh on next start). Reset `beat = 0` so accent counting starts from the downbeat in the new subdivision.

If you forget the unconditional read and write the guard first:

```js
$effect(() => {
  if (isPlaying && synth) {           // subdivision NOT yet read
    beat = 0;
    const sub = subdivision;          // read inside guard
    buildLoop();
  }
});
```

— then on the first run, if `isPlaying` is false, the effect never reads `subdivision`, never tracks it, and never re-fires when subdivision changes. Same trap as lesson 2.

### Why we don't rebuild on every BPM change

We DON'T tear down and rebuild the loop when BPM changes — we just write the new BPM into `Tone.Transport.bpm.value`. The Loop's interval is in musical time (`'4n'`), which is relative to the Transport's BPM. Change the BPM, the actual ms-interval of the Loop changes automatically. No rebuild needed.

This is one of the nice properties of musical-time scheduling. The schedule doesn't change; the clock does.

### Worked example: stop and start with subdivisions

```js
async function start() {
  if (isPlaying) return;
  await Tone.start();
  if (!synth) synth = new Tone.MembraneSynth().toDestination();
  Tone.Transport.bpm.value = bpm;
  buildLoop();                        // initial loop build
  Tone.Transport.start();
  isPlaying = true;
}

function stop() {
  if (!isPlaying) return;
  Tone.Transport.stop();
  Tone.Transport.cancel();
  loop?.dispose();
  loop = null;
  isPlaying = false;
  beat = 0;
}
```

Start: build the loop, start the Transport. Stop: cancel scheduled events, dispose the loop. The subdivision-change effect handles changes WHILE playing.

### Common mistakes when rebuilding

- **Calling `buildLoop()` without disposing the old one.** Memory leak and duplicate scheduled events. The function above checks `if (loop) loop.dispose()` first.
- **Forgetting to reset `beat` on rebuild.** The first click after a subdivision switch lands on a weird beat number, accent is wrong. Resetting to 0 puts you cleanly on a downbeat.
- **Forgetting `.start(0)` after building.** New loop, never scheduled, no sound. Same trap as lesson 1.
- **Reading `subdivision` inside the loop callback only.** The callback runs at audio time and isn't tracked as a Svelte dependency. Reading subdivision in the effect (outside the callback) is what makes Svelte re-fire the effect on changes.

## Concept 3: What snippets are

### The problem snippets solve

Suppose you write a `Picker` component that takes a list of options. Each option needs to be rendered as a button. By default the button just shows the option's `label`:

```svelte
{#each options as option}
  <button>{option.label}</button>
{/each}
```

That works for the default case. But what if the parent wants more elaborate rendering — say, an icon plus a label plus a description? You could:

1. **Pre-render the markup as HTML strings and inject with `{@html}`.** Dangerous (XSS) and inflexible (no event handlers, no scoped CSS).
2. **Add a flag prop for each variant.** `<Picker showDescription showIcon />`. Doesn't scale — every new variation is another prop.
3. **Let the parent pass markup.** This is what snippets are for.

### What a snippet is, mechanically

A snippet is a reusable chunk of Svelte markup that can take parameters. It's defined with `{#snippet name(args)}...{/snippet}` and rendered with `{@render name(args)}`. You can define snippets inside a component for local reuse, OR pass them as props to children.

```svelte
{#snippet greeting(name)}
  <p>Hello, {name}!</p>
{/snippet}

{@render greeting('Chris')}
{@render greeting('Brandon')}
```

That renders two `<p>` tags with different names. The snippet is a parameterized chunk of markup.

### Snippets as props

A child component can declare a snippet prop. The parent passes a snippet; the child renders it with `{@render}`.

```svelte
<!-- Picker.svelte -->
<script>
  let { options = [], renderOption } = $props();
</script>

{#each options as option (option.id)}
  <button>
    {@render renderOption(option)}
  </button>
{/each}
```

Parent:

```svelte
<Picker {options}>
  {#snippet renderOption(option)}
    <span>{option.icon}</span>
    <span>{option.label}</span>
  {/snippet}
</Picker>
```

The snippet is defined inside the `<Picker>` tags. The Svelte compiler routes it to the `renderOption` prop of the child. The child renders it for each option, passing the option as the argument.

### Why this is better than Svelte 4 slots

Svelte 4 had `<slot>` for default content and `<slot name="foo">` for named slots. They worked, but:

- Slots couldn't take parameters. The child couldn't pass data to the slot.
- The slot syntax was different from prop syntax. You had to learn two interfaces.
- Slot fallbacks were verbose (`<slot>fallback content</slot>`).
- Multiple slots required named slots with `<svelte:fragment slot="foo">` wrapping, which was awkward.

Snippets fix all of this:

- Parameters: `{#snippet name(args)}`.
- Same prop interface as everything else: snippet is just a prop.
- Fallbacks: just check if the prop is defined, render default if not.
- Multiple "slots" = multiple snippet props. No special syntax.

Svelte 4's `<slot>` still works in Svelte 5 for backwards compatibility, but new code should use snippets.

### Worked example: a snippet with a fallback

```svelte
<!-- Picker.svelte -->
<script>
  let { options = [], renderOption } = $props();
</script>

<div class="picker">
  {#each options as option (option.id)}
    <button>
      {#if renderOption}
        {@render renderOption(option)}
      {:else}
        {option.label}
      {/if}
    </button>
  {/each}
</div>
```

If the parent passes a `renderOption` snippet, the child renders it. If not, it falls back to displaying `option.label`. The parent doesn't have to pass a snippet for the simple case.

### Common mistakes with snippets

- **Forgetting the `@` in `{@render}`.** `{render foo()}` is a syntax error or worse — Svelte tries to interpret `render foo()` as an expression.
- **Defining a snippet at module scope.** `{#snippet}` is markup; it has to be in the template, not the script. (You can pass snippets around as values once they're defined in markup, though.)
- **Forgetting to pass arguments when the snippet has parameters.** `{@render renderOption()}` (no argument) when the snippet expects an option leads to `option` being `undefined`.
- **Trying to use snippets as if they're functions you can call from script.** They're markup constructs. You render them with `{@render}` in markup, not by calling them in JavaScript.

### TS notes

If you're typing snippets:

```ts
import type { Snippet } from 'svelte';

let { options, renderOption }: {
  options: Option[];
  renderOption?: Snippet<[Option]>;
} = $props();
```

`Snippet<[Option]>` is "a snippet that takes one Option argument." The square brackets denote the parameter tuple. `Snippet<[]>` (or just `Snippet`) is a no-arg snippet.

## Concept 4: Building `<SubdivisionPicker>`

### The picker component

Create `src/lib/components/SubdivisionPicker.svelte`:

```svelte
<script>
  let { options = [], value = $bindable(), renderOption } = $props();
</script>

<div class="picker">
  {#each options as option (option.id)}
    <button
      class:selected={value?.id === option.id}
      onclick={() => value = option}
    >
      {#if renderOption}
        {@render renderOption(option)}
      {:else}
        {option.label}
      {/if}
    </button>
  {/each}
</div>

<style>
  .picker { display: flex; gap: 4px; }
  button {
    flex: 1; padding: 8px 4px;
    background: #11131a; color: #9ea3b8;
    border: 1px solid #262a3a; border-radius: 8px;
    font: inherit; cursor: pointer; font-size: 18px;
  }
  button.selected {
    background: #4a8fe7; color: white; border-color: #4a8fe7;
  }
</style>
```

Three things going on:

- **`options` prop:** the array of choices. Plain data.
- **`value` prop with `$bindable()`:** the currently-selected option. Two-way bindable so the parent owns the value but the picker updates it.
- **`renderOption` prop:** the optional snippet for custom rendering. Fallback to `option.label`.

The `&lbrace;#each ... (option.id)&rbrace;` form uses `option.id` as the key — when the options change, Svelte reuses DOM nodes for items with the same id rather than rebuilding from scratch. For a static list this doesn't matter much; for dynamic lists it's important.

The selected button is highlighted via the `class:selected` directive. The comparison is `value?.id === option.id` — optional chaining guards against `value` being undefined (e.g., parent didn't pass an initial value).

### Default usage

```svelte
<SubdivisionPicker options={SUBDIVISIONS} bind:value={subdivision} />
```

Each button shows the subdivision's `label` (the unicode symbol). The selected one is highlighted blue. Click another button, the selection moves.

### Customized usage with a snippet

```svelte
<SubdivisionPicker options={SUBDIVISIONS} bind:value={subdivision}>
  {#snippet renderOption(option)}
    <div class="opt">
      <span class="symbol">{option.label}</span>
      <span class="name">{option.id}</span>
    </div>
  {/snippet}
</SubdivisionPicker>

<style>
  .opt { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .symbol { font-size: 20px; }
  .name { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; }
</style>
```

Now each button shows BOTH the symbol AND the name. The snippet is defined in the parent, passed to the child, called once per option.

The parent's `<style>` block scopes the `.opt`, `.symbol`, `.name` classes to the parent component. The button styling stays in `SubdivisionPicker`. Each component owns its own styles.

### Why making `value` bindable

We could have used a callback prop instead:

```svelte
<SubdivisionPicker options={SUBDIVISIONS} value={subdivision} onpick={(s) => subdivision = s} />
```

Inside the picker: `onclick={() => onpick?.(option)}`. Equally valid.

The choice between bindable and callback comes down to "what is this picker, conceptually?" If it's a controlled UI element where the parent owns the value (think: a slider, a date picker, a select), `$bindable` matches that mental model. If it's an action emitter where each click is an event, a callback matches better.

For a subdivision picker, both interpretations work. I picked `$bindable` because the picker visually IS the current value — the highlight on the selected button is just a view of the bound state. A callback would work equally well; this is a taste call.

### Common mistakes with the picker

- **Forgetting `(option.id)` keying in `&lbrace;#each&rbrace;`.** Svelte will warn at build time if the array might change identity. For a static SUBDIVISIONS array it's optional but good habit.
- **Calling the snippet without the argument.** `{@render renderOption()}` when the snippet expects an `option`. Causes `option` in the snippet to be undefined.
- **Putting the styles in the parent.** If the picker's button styles live in the parent, every consumer of the picker needs to duplicate them. Keep the picker's own styles in the picker.

## Concept 5: Integrating subdivisions into the metronome

### The full page

`src/routes/+page.svelte`:

```svelte
<script>
  import * as Tone from 'tone';
  import ClickIndicator from '$lib/components/ClickIndicator.svelte';
  import BpmDial from '$lib/components/BpmDial.svelte';
  import TransportButton from '$lib/components/TransportButton.svelte';
  import SubdivisionPicker from '$lib/components/SubdivisionPicker.svelte';

  const SUBDIVISIONS = [
    { id: 'quarter',  label: '𝅘𝅥',  notation: '4n',  ticksPerBeat: 1 },
    { id: 'eighth',   label: '𝅘𝅥𝅮',  notation: '8n',  ticksPerBeat: 2 },
    { id: 'triplet',  label: '𝅘𝅥𝅮𝅘𝅥𝅮𝅘𝅥𝅮', notation: '8t',  ticksPerBeat: 3 },
    { id: 'sixteenth', label: '𝅘𝅥𝅯', notation: '16n', ticksPerBeat: 4 }
  ];

  let isPlaying = $state(false);
  let bpm = $state(120);
  let subdivision = $state(SUBDIVISIONS[0]);
  let pulse = $state(0);
  let beat = $state(0);

  let synth = null;
  let loop = null;

  function buildLoop() {
    if (loop) loop.dispose();
    loop = new Tone.Loop((time) => {
      const isAccent = beat % subdivision.ticksPerBeat === 0;
      const isDownbeat = beat % (subdivision.ticksPerBeat * 4) === 0;
      const pitch = isDownbeat ? 'C4' : isAccent ? 'C3' : 'C2';
      const vel = isDownbeat ? 0.9 : isAccent ? 0.7 : 0.4;
      synth.triggerAttackRelease(pitch, '32n', time, vel);
      Tone.Draw.schedule(() => {
        pulse++;
        beat++;
      }, time);
    }, subdivision.notation);
    loop.start(0);
  }

  async function start() {
    if (isPlaying) return;
    await Tone.start();
    if (!synth) synth = new Tone.MembraneSynth().toDestination();
    Tone.Transport.bpm.value = bpm;
    buildLoop();
    Tone.Transport.start();
    isPlaying = true;
  }

  function stop() {
    if (!isPlaying) return;
    Tone.Transport.stop();
    Tone.Transport.cancel();
    loop?.dispose();
    loop = null;
    isPlaying = false;
    beat = 0;
  }

  $effect(() => {
    const next = bpm;
    if (Tone.Transport) Tone.Transport.bpm.value = next;
  });

  $effect(() => {
    const sub = subdivision;
    if (isPlaying && synth) {
      beat = 0;
      buildLoop();
    }
  });
</script>

<div class="metronome">
  <ClickIndicator
    pulse={pulse}
    accent={beat % subdivision.ticksPerBeat === 1}
  />
  <BpmDial bind:bpm />
  <SubdivisionPicker options={SUBDIVISIONS} bind:value={subdivision} />
  <TransportButton playing={isPlaying} onstart={start} onstop={stop} />
</div>

<style>
  .metronome {
    max-width: 320px; margin: 40px auto; padding: 32px;
    background: #1a1d2a; color: #ecedf3; border-radius: 16px;
    font-family: system-ui;
    display: flex; flex-direction: column; gap: 24px;
  }
</style>
```

Run it. Click START in quarter mode — same as before. Click "eighth" — twice the click rate. Click "triplet" — three per beat. Click "sixteenth" — four per beat. All while playing, no glitch, the loop rebuilds smoothly.

### What's actually happening on a subdivision switch

1. User clicks "triplet" in the SubdivisionPicker.
2. The picker writes `value = SUBDIVISIONS[2]` (the triplet object).
3. Because `value` is `$bindable`, this propagates to the parent's `subdivision`.
4. The parent's subdivision-change `$effect` fires (its tracked dep `subdivision` changed).
5. The effect calls `buildLoop()`: disposes the old loop, builds a new one with `subdivision.notation = '8t'`, starts it at time 0.
6. The Transport is still running. The new loop joins the schedule, the old one is gone. Next click is at the triplet rate.

This is what fine-grained reactivity gets you. Each step is a small reactive cause-and-effect. There's no central "update everything" function — the data flow tells the story.

## Putting it together

The metronome now has four components: ClickIndicator, BpmDial, SubdivisionPicker, TransportButton. Four pieces of data flowing through: `bpm`, `subdivision`, `pulse`, `isPlaying` (with `beat` as derived bookkeeping). The audio engine is ~30 lines; each component is 10-40 lines.

Try the subdivisions. Listen to the difference between eighth notes and triplets — the triplets feel "swung," the eighths feel "even." This is one of the basic distinctions in rhythm; having a metronome that lets you switch between them on the fly is genuinely useful for practice.

Then try the snippet variation — the customized picker with both symbol and name. The picker doesn't need to know about names; the parent provides the rendering, and the picker just hosts it.

## Exercises

### Exercise 1: Wire up the SubdivisionPicker

**Setup:** the lesson 3 metronome with three components.

**What to do:** add the SUBDIVISIONS data, the `subdivision` $state, the `SubdivisionPicker` component file, the `buildLoop` factoring, and the second `$effect`. Add the picker to the metronome panel.

**Verify by:** clicking different subdivision buttons while playing changes the click rate. Quarter is 1× speed, eighth is 2×, triplet is 3× per beat, sixteenth is 4×. The selected button is highlighted.

**Stretch:** add a fifth subdivision: "swing eighths" (`'8n'` notation but with a triplet feel). Hint: there's no clean Tone notation for this; you'd need to alternate `'8n.'` and `'16n'` lengths via a Sequence.

<details>
<summary>Show solution</summary>

The full code is in "putting it together." Key bits:

```js
let subdivision = $state(SUBDIVISIONS[0]);

function buildLoop() {
  if (loop) loop.dispose();
  loop = new Tone.Loop((time) => {
    synth.triggerAttackRelease('C2', '32n', time);
    Tone.Draw.schedule(() => { pulse++; beat++; }, time);
  }, subdivision.notation);
  loop.start(0);
}

$effect(() => {
  const sub = subdivision;
  if (isPlaying && synth) {
    beat = 0;
    buildLoop();
  }
});
```

The `const sub = subdivision` line is doing the tracking work — without it, the effect wouldn't re-fire on subdivision changes.

</details>

### Exercise 2: Use the default snippet fallback

**Setup:** the SubdivisionPicker working with default rendering.

**What to do:** confirm that the picker shows each subdivision's `label` (the unicode symbol) when you DON'T pass a `renderOption` snippet. Inspect the rendered HTML in dev tools — each button should contain only the symbol text.

**Verify by:** the buttons show 𝅘𝅥, 𝅘𝅥𝅮, 𝅘𝅥𝅮𝅘𝅥𝅮𝅘𝅥𝅮, 𝅘𝅥𝅯. The dev tools "Elements" panel confirms each button contains a plain text node with the symbol.

**Stretch:** add a `class` prop to the picker that's applied to the outer `<div class="picker">`. Use it from the parent to override the picker's styling without forking the component.

<details>
<summary>Show solution</summary>

The fallback is in the component:

```svelte
{#if renderOption}
  {@render renderOption(option)}
{:else}
  {option.label}
{/if}
```

For the stretch, the picker accepts and forwards a class:

```svelte
<script>
  let { options = [], value = $bindable(), renderOption, class: klass = '' } = $props();
</script>

<div class="picker {klass}">
  ...
</div>
```

Note the rename: `class` is a JavaScript reserved word, so you destructure it as `class: klass`. The parent calls `<SubdivisionPicker class="my-picker" ... />`.

</details>

### Exercise 3: Customize the picker with a snippet

**Setup:** the working picker.

**What to do:** pass a `renderOption` snippet to the picker that shows both the unicode symbol AND the subdivision's name (e.g., "eighth"). Use the snippet syntax from the "customized usage" example above.

**Verify by:** each picker button now shows two lines: the symbol on top, the name below. Selection still works (clicking a button selects it, the audio loop rebuilds).

**Stretch:** make the snippet take a second argument: whether this option is currently selected. Use it to render an animated indicator (a tiny pulse, a checkmark) on the selected option without relying on CSS `.selected` styling.

<details>
<summary>Show solution</summary>

```svelte
<SubdivisionPicker options={SUBDIVISIONS} bind:value={subdivision}>
  {#snippet renderOption(option)}
    <div class="opt">
      <span class="symbol">{option.label}</span>
      <span class="name">{option.id}</span>
    </div>
  {/snippet}
</SubdivisionPicker>

<style>
  .opt { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .symbol { font-size: 20px; }
  .name { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; }
</style>
```

For the stretch, modify the picker to pass `selected`:

```svelte
{@render renderOption(option, value?.id === option.id)}
```

And the snippet takes two args:

```svelte
{#snippet renderOption(option, selected)}
  <div class="opt">
    {#if selected}<span class="dot">●</span>{/if}
    <span>{option.label}</span>
  </div>
{/snippet}
```

</details>

### Exercise 4: Trigger the dependency-tracking trap (again)

**Setup:** the working subdivision effect.

**What to do:** rewrite the effect with the read INSIDE the guard:

```js
$effect(() => {
  if (isPlaying && synth) {
    beat = 0;
    const sub = subdivision;  // INSIDE the guard
    buildLoop();
  }
});
```

Reload. Start the metronome. Change subdivision. Does the loop change?

**Verify by:** if the first run of the effect happened with `isPlaying = false`, the effect didn't track `subdivision` and won't re-fire when you change it. The audio keeps playing in the original subdivision. Fix it back to the unconditional-read pattern.

**Stretch:** read about Svelte's `$effect.pre` and `untrack()`. The `untrack()` helper lets you read a reactive value without tracking it as a dependency — useful for the inverse of this problem, when you want to write conditional logic based on a value WITHOUT triggering re-runs on that value's changes.

<details>
<summary>Show solution</summary>

The fix is the unconditional read:

```js
$effect(() => {
  const sub = subdivision;     // always read
  if (isPlaying && synth) {
    beat = 0;
    buildLoop();
  }
});
```

This trap is the same one from lesson 2's BPM effect. Recognizing the pattern is half the battle.

</details>

### Exercise 5 (stretch): Beat counter display

**Setup:** the working metronome.

**What to do:** add a small display showing the current "beat in bar" (1, 2, 3, 4 for a 4/4 time). Reset to 1 when stopped, increment on each downbeat, wrap from 4 back to 1.

The trick: with subdivisions, your `beat` counter advances on every tick (which is more than 4 per bar at subdivisions like sixteenths). You need a separate "downbeat counter" that only advances when `beat % (subdivision.ticksPerBeat * 4) === 0`.

**Verify by:** at 120 BPM in quarter notes, the display reads 1, 2, 3, 4, 1, 2, 3, 4, ... cycling once per second. At sixteenth notes, it still reads 1, 2, 3, 4 — once per beat, not once per tick.

**Stretch:** make the time signature configurable. Add a "bar length" picker (3, 4, 5, 7) and have the beat counter wrap accordingly. 7/8 metronomes are useful for practicing odd-time music.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let bar = $state(1);
  const barLength = 4;

  function buildLoop() {
    if (loop) loop.dispose();
    loop = new Tone.Loop((time) => {
      const isDownbeat = beat % subdivision.ticksPerBeat === 0;
      // ... rest of accent logic
      Tone.Draw.schedule(() => {
        pulse++;
        if (isDownbeat) bar = (bar % barLength) + 1;
        beat++;
      }, time);
    }, subdivision.notation);
    loop.start(0);
  }

  function stop() {
    // ... existing
    bar = 1;
  }
</script>

<div class="bar-display">Beat {bar} of {barLength}</div>
```

For odd time, just take `barLength` from a state and a picker.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/lib/components/SubdivisionPicker.svelte` containing the picker component with a snippet prop.
- `src/routes/+page.svelte` updated with the SUBDIVISIONS constant, `subdivision` state, `buildLoop` function, second `$effect`, and the `<SubdivisionPicker>` in the markup.

### Verify it works

- The metronome panel now has four sub-components stacked: indicator, BPM dial, subdivision picker, transport button.
- Switching subdivision while playing changes the click rate immediately, without audio glitches.
- The downbeat (every fourth tick at quarter notes, every 16th tick at sixteenths) plays at a higher pitch and louder velocity. The visual indicator flashes accent (gold) on the right beats.
- The BPM slider still works; switching subdivision doesn't reset BPM.

### Compare against the reference

Your SubdivisionPicker should be ~25 lines. Your `+page.svelte` should be ~80 lines. The growth is mostly the SUBDIVISIONS data and the second `$effect`. If your page is noticeably longer, look for code that belongs in a component.

## Common questions

**Q: Why is the snippet syntax different from the prop syntax?**
A: Snippets are markup, not values. They're defined with template syntax (`{#snippet}`), passed as props (which the compiler routes via the prop interface), and rendered with template syntax (`{@render}`). Under the hood they ARE values — you can pass a snippet defined in one place to a child of another component. But the way you DEFINE and INVOKE them is template-shaped because markup is what they produce.

**Q: Can snippets contain `<script>` blocks?**
A: No. Snippets are pure markup. They can reference variables in scope (the component's state, the snippet's arguments), but they can't declare their own. If you want logic, do it in the parent's `<script>` and reference the results from the snippet.

**Q: What happens to the old `<slot>` syntax?**
A: It still works in Svelte 5 for backwards compatibility. New code should use snippets. The Svelte docs include a migration guide. The mapping: `<slot />` becomes `{@render children?.()}` with `let { children } = $props()`; named slots become named snippet props.

**Q: Can I define a snippet that takes a snippet as an argument?**
A: Yes. Snippets are values; you can pass them around. This is sometimes useful for higher-order rendering (a "with-tooltip" wrapper snippet that takes a content snippet). It's also the kind of thing that, three levels deep, becomes unreadable. Use sparingly.

**Q: Why does the subdivision picker rebuild the loop instead of just changing the existing Loop's interval?**
A: Tone.js's Loop doesn't expose a settable interval property. The interval is baked in at construction time. To change it you dispose and rebuild. This isn't a Svelte limitation — it's a Tone limitation. If you go around it (you could mutate Loop's internals), you're depending on undocumented behavior that might break in a Tone update.

## What's next

The last lesson in this module adds spring physics on the click indicator using `Spring` from `svelte/motion`, properly explains how scoped styles work under the hood, and shows how CSS custom properties + cascade make theming clean without prop drilling. The metronome will go from "functional" to "feels good to use," and you'll have used most of the framework features you'll reach for day to day.

<SourcesSection lessonKey="03-metronome-studio/04-subdivisions" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
