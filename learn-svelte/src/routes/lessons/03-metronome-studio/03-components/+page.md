<script>
  import OpenTheHood from '$lib/components/OpenTheHood.svelte';
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Components and Props · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-3);">

<LessonHeader
  moduleSlug="03-metronome-studio"
  lessonSlug="03-components"
  title="Splitting into Components and Props"
  blurb="Extract <BpmDial>, <ClickIndicator>, <TransportButton>. Pass props. The component model in practice."
/>

## Why this lesson exists

The metronome's `+page.svelte` after lesson 2 is doing too much. Audio engine state, pulse counter, BPM display, slider, indicator, transport button — all in one file, all in one component. It works, but it's the kind of file you can write but don't enjoy reading. And the moment you add subdivisions and accent patterns (lesson 4), it becomes unmaintainable.

The standard fix is to extract components. This lesson does exactly that and uses the extraction as an excuse to walk through Svelte 5's component interface properly: `$props()` for declaring inputs, `$bindable()` for opt-in two-way props, and callback props for events flowing back to the parent. You've seen `$props()` in passing in earlier modules; this lesson makes it the explicit topic.

Extraction is also a skill, not just a syntax. The interesting questions aren't "how do I write `$props()`" — they're "where do I draw the component boundary," "what does each component own," "what does it expose to its parent." Get those wrong and your refactor is worse than the original. This lesson walks through the choices I made for this metronome, and why.

## Learning objectives

By the end of this lesson you'll be able to:

- Declare component props with `let { ... } = $props()` and provide defaults via destructuring.
- Mark a prop as opt-in two-way with `$bindable(initialValue)`, and bind to it from the parent with `bind:propName`.
- Pass callbacks as props (the modern equivalent of Svelte 4 event dispatchers).
- Decide when a piece of UI deserves its own component, using "self-contained state," "self-contained styling," and "reuse" as guides.
- Compose multiple small components into a parent page, passing the right data down and the right callbacks up.
- Recognize the trade-off between deeply-extracted components and a single big component, and pick deliberately.

## Concept 1: Declaring props with `$props()`

### What `$props()` returns

`$props()` is a Svelte 5 rune that returns an object containing every prop the parent passed to this component. You destructure it into local variables:

```svelte
<script>
  let { pulse = 0, accent = false } = $props();
</script>
```

Now `pulse` and `accent` are reactive props. Whenever the parent passes new values, they update in the child. The destructuring syntax is plain JavaScript — defaults via `= 0`, renaming via `pulse: localName`, rest with `...others`, all the usual tricks work.

The defaults activate when the parent omits the prop or passes `undefined`. They DON'T activate when the parent passes `null` (null is a value; only undefined triggers the default). This is a subtle JavaScript-destructuring rule that bites everyone at least once.

### Worked example: `ClickIndicator.svelte`

The simplest component to extract from the metronome is the click indicator. It takes a pulse count, an accent flag, renders the dot, and flashes when pulse changes. No internal state, no logic — just props in, markup out.

Create `src/lib/components/ClickIndicator.svelte`:

```svelte
<script>
  let { pulse = 0, accent = false } = $props();
</script>

{#key pulse}
  <div class="indicator" class:accent></div>
{/key}

<style>
  .indicator {
    width: 60px; height: 60px; border-radius: 50%;
    background: #4a8fe7;
    box-shadow: 0 0 24px #4a8fe7;
    margin: 0 auto;
    animation: flash 200ms ease-out;
  }
  .indicator.accent {
    background: #f0c050;
    box-shadow: 0 0 24px #f0c050;
  }
  @keyframes flash {
    0%   { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); opacity: 0.3; }
  }
</style>
```

Use it from the parent:

```svelte
<script>
  import ClickIndicator from '$lib/components/ClickIndicator.svelte';
</script>

<ClickIndicator pulse={pulse} accent={isAccent} />
```

The shorthand `<ClickIndicator {pulse} accent={isAccent} />` is equivalent when the prop name matches the variable name — Svelte's `{name}` is sugar for `name={name}`.

### Variations on declaring props

- **Renaming.** `let { pulse: count = 0 } = $props()` makes the prop callable as `pulse=` from the parent but available as `count` inside.
- **Rest.** `let { pulse, ...rest } = $props()` collects unrecognized props into `rest`. Useful when you want to spread them onto a child element: `<div {...rest}></div>`.
- **No declaration.** `let props = $props()` keeps the whole object. Useful when the component is generic and the props vary at runtime.
- **A "children" snippet.** `let { children } = $props()` — `children` is the special snippet prop that holds whatever markup the parent put between the component's tags. We'll cover snippets in lesson 4.

### Common mistakes with `$props()`

- **Calling `$props()` more than once.** It's a rune, not a function. Call it once at the top of `<script>`. Multiple calls are a compile error.
- **Mutating destructured props.** Props are reactive but read-only inputs. `pulse = pulse + 1` does nothing useful (it updates the local variable but doesn't propagate to the parent). If you want write-back, use `$bindable` (see concept 2).
- **Forgetting defaults.** If the parent doesn't pass a prop, it's `undefined`. Without a default, your template will read `undefined` and probably break (e.g., `class:accent={undefined}` doesn't crash but doesn't behave the way `class:accent={false}` does).
- **Passing reactive state down through a non-reactive wrapper.** If you do `const wrapper = { pulse }` and pass `wrapper` as a prop, the child sees the value at the time you built the object — not subsequent updates. Pass reactive values directly.

### TS notes

If you want types on props, annotate the destructuring's type parameter:

```svelte
<script lang="ts">
  let {
    pulse = 0,
    accent = false
  }: { pulse?: number; accent?: boolean } = $props();
</script>
```

Or define an interface and use it:

```ts
interface Props {
  pulse?: number;
  accent?: boolean;
}
let { pulse = 0, accent = false }: Props = $props();
```

The Svelte language server uses these types for autocomplete in the parent (`<ClickIndicator pulse={...} />` — hover over `pulse` and you see `number`).

## Concept 2: `$bindable()` for two-way props

### Why two-way props exist

Most of the time, props are one-way: parent owns the data, child reads it. If the child needs to communicate back, it calls a callback the parent provided (more on this in concept 3).

But sometimes that ceremony is excessive. A form-input component (a text field, a slider, a date picker) is logically "I display and edit a value the parent owns." Forcing the parent to pass `value={x} onChange={v => x = v}` for every input is the React style — verbose and easy to get wrong.

Svelte's answer: `$bindable()`. A prop marked `$bindable()` can be bound to from the parent with `bind:propName`. The parent and child share the same value; writes from either side propagate.

This is OPT-IN. By default, props are one-way. You explicitly mark a prop as bindable when you want the two-way behavior. This keeps the data-flow story honest — you can look at a component and see immediately which of its props the children might write back.

### Worked example: `BpmDial.svelte`

```svelte
<script>
  let { bpm = $bindable(120), min = 40, max = 240 } = $props();
</script>

<div class="dial">
  <div class="display">
    <span class="num">{bpm}</span>
    <span class="unit">BPM</span>
  </div>
  <input type="range" {min} {max} step="1" bind:value={bpm} />
</div>

<style>
  .dial { text-align: center; }
  .display { margin-bottom: 16px; }
  .num { font-size: 56px; font-weight: 700; color: #4a8fe7; line-height: 1; }
  .unit { font-size: 14px; color: #9ea3b8; margin-left: 6px; }
  input { width: 100%; accent-color: #4a8fe7; }
</style>
```

The signature `bpm = $bindable(120)` declares: "the parent can two-way bind to `bpm`; if they don't, it defaults to 120." Then `bind:value={bpm}` on the slider routes user input back through the bindable, which routes back up to the parent.

Use it from the parent:

```svelte
<BpmDial bind:bpm />
```

The shorthand `bind:bpm` is equivalent to `bind:bpm={bpm}` when the parent variable has the same name.

Now: the parent has `let bpm = $state(120)`. The slider in `BpmDial` writes to its local `bpm` (which is the same `bpm` because it's bindable-bound). The parent's `bpm` sees the change. The parent's `$effect` that pushes to Tone fires. Done.

### Variations

- **Bindable without a default.** `let { value = $bindable() } = $props()` — the binding works, but the value is `undefined` until the parent sets it. Annoying for most use cases; provide a default.
- **Multiple bindables.** A component can have several bindable props. A date-range picker might have `bind:start` and `bind:end`.
- **Non-bindable use.** If a prop is `$bindable()` but the parent passes `{prop}` without `bind:`, that works too — they just get one-way behavior, like a regular prop.

### Compared to React

React doesn't have bindable props. The closest equivalent is the "controlled input" pattern: `<input value={x} onChange={e => setX(e.target.value)} />` — and you write this for every input.

React also has uncontrolled inputs (with refs), but they break the "single source of truth" model and are recommended against. So React has one good way (verbose) and one bad way (concise).

Svelte has both shapes. One-way for everything that doesn't need write-back; two-way (via `$bindable`) for form inputs and similar cases where the verbosity isn't pulling its weight.

### Common mistakes with `$bindable`

- **Using `$bindable` for everything.** It's there for genuine two-way cases. Most props are not two-way. If you find yourself making everything bindable, you've probably designed the data flow upside-down.
- **Mutating a bindable prop that wasn't bound.** If the parent passes `{prop}` (not `bind:prop`), the parent doesn't see your writes. Your local variable updates but the parent's doesn't. Silent.
- **Binding to a $derived value.** Doesn't work; derived values are read-only. Bind to the underlying $state instead.
- **Binding across deep component trees.** Two-way binding works on every level, but if you're propagating a bindable through five layers, you've probably hit the point where shared state in a `.svelte.ts` module would be cleaner. We'll cover that in Module 4.

## Concept 3: Callback props

### The Svelte 5 way of "events"

Svelte 4 had a `createEventDispatcher()` API for child-to-parent communication: the child dispatches an event, the parent listens with `on:eventname`. It worked, but it added a layer of indirection (the event object, the dispatcher boilerplate) that didn't earn its keep.

Svelte 5 replaces this with callback props. The parent passes a function as a prop; the child calls it. That's the whole pattern.

```svelte
<!-- TransportButton.svelte -->
<script>
  let { playing = false, onstart, onstop } = $props();
</script>

<button onclick={() => playing ? onstop?.() : onstart?.()}>
  {playing ? '■ STOP' : '▶ START'}
</button>
```

Used from the parent:

```svelte
<TransportButton playing={isPlaying} onstart={start} onstop={stop} />
```

The parent's `start` and `stop` functions are passed in as props. The child calls them. Identical to React's pattern — and identical to passing any other prop.

### The `?.()` defensive call

`onstart?.()` is JavaScript optional chaining: "if `onstart` is defined, call it; if it's null/undefined, do nothing." This makes the prop optional — the parent can omit `onstop` and the button just doesn't do anything when pressed in playing mode.

If the prop is required, drop the `?.`: `onstart()` will throw if `onstart` is missing, which is fine for a strict contract.

### Naming convention

Convention is to prefix event-callback props with `on`: `onclick`, `onstart`, `oncomplete`. This mirrors the DOM event handler naming (`onclick`, `onchange`) and makes the intent obvious at a call site.

Svelte 5 actually accepts ANY callback prop name (`whenPressed`, `handleStart`, etc.) — there's nothing magical about the `on` prefix. But following the convention makes your components readable to anyone who's seen Svelte before.

### Worked example: `TransportButton.svelte`

Create `src/lib/components/TransportButton.svelte`:

```svelte
<script>
  let { playing = false, onstart, onstop } = $props();
</script>

<button onclick={() => playing ? onstop?.() : onstart?.()}>
  {playing ? '■ STOP' : '▶ START'}
</button>

<style>
  button {
    width: 100%; padding: 14px; font: inherit; font-weight: 700;
    background: #4a8fe7; color: white; border: 0; border-radius: 10px;
    cursor: pointer; letter-spacing: 0.1em;
  }
</style>
```

The component is dumb: it knows whether it's "playing" or not (from the `playing` prop), shows the right label, and calls the right callback when clicked. It doesn't know what start or stop mean. The parent owns the audio engine; the button is just a button.

### Variations on callback props

- **Passing arguments.** Callbacks can take args: `<SubdivisionPicker onpick={(option) => selected = option} />`. The child calls `onpick(option)` and the parent receives the value.
- **A single onevent that distinguishes via argument.** `onaction={(type) => type === 'start' ? start() : stop()}`. Less typing on the parent side, more branching in the parent's handler. Pick whichever's cleaner for the case.
- **Returning a value (rare).** Callbacks usually return void, but nothing stops you from returning. Useful for "ask the parent if this is allowed" patterns.

### Common mistakes with callback props

- **Forgetting `?.()` and the parent omits the prop.** Crashes with "onstart is not a function." Either make the prop required (and drop `?.`), or use `?.()` and accept it might be undefined.
- **Wrapping in a redundant arrow.** `onclick={() => onstart()}` is the same as `onclick={onstart}`. The arrow is only needed when you want to add logic or pass specific args.
- **Forgetting that callbacks captured at component creation are stale.** They aren't in Svelte 5 — props update reactively, so a fresh `onstart` from the parent replaces the old one on the next render. But if you cached it in a local variable (`const cb = onstart`), that's stale.
- **Wiring `onclick={start()}` instead of `onclick={start}`.** The first one CALLS `start` at render time and assigns the return value to `onclick`. The second one passes the function. Easy typo.

## Concept 4: Deciding what to extract

### Three good reasons to extract

I'm against splitting components for the sake of splitting. Most "best practices" articles will tell you to extract anything over 50 lines. That's a measurement, not a reason. The reasons that actually matter:

1. **Self-contained state.** A component owns some state that only it cares about. Examples: a tooltip that knows its open/closed state, a tabs widget that knows which tab is active. Extracting it puts the state and the behavior in one place.
2. **Self-contained styling.** A piece of UI has elaborate scoped CSS. Extracting it puts the styles in a file where they don't compete for attention with unrelated styles.
3. **Reuse.** The same piece of UI shows up in more than one place. Extracting it gives you one definition to maintain.

For the metronome, all three apply somewhere:

- **`ClickIndicator`** — self-contained styling (the dot, the animation, the accent variant). Not currently reused, but the styling is heavy enough that extracting cleans up the parent.
- **`BpmDial`** — self-contained styling (the big number, the slider). Could be reused (any tempo-setting component would want this UI).
- **`TransportButton`** — self-contained styling. Will probably be styled differently in different contexts (a small one in the header, a big one on the main screen) — reuse with prop variation is plausible.

### Bad reasons to extract

- **"This file is too long."** Length isn't a meaningful signal. A 500-line component that's coherent is fine; a 50-line component that's secretly four mini-components glued together is worse.
- **"I want to test this in isolation."** If the only reason to extract is testing, your component has a testability problem. Usually a sign that the LOGIC should be in a `.svelte.ts` module (testable on its own) and the COMPONENT just renders that logic.
- **"It feels more architecty."** No.

### When NOT to extract

Sometimes the inline version is right. If a piece of UI is one-off, tied tightly to its parent, and won't be reused — leaving it inline keeps related code together. Extracting it forces you to jump between two files for every change.

A good question: "if I had to add a feature here, would I need to edit one file or two?" If two, you've split too aggressively.

### The metronome's extraction plan

Three components, all under `src/lib/components/`:

- **`<ClickIndicator pulse={number} accent={boolean} />`** — the flashing dot. Re-triggers its animation when `pulse` changes; uses a different color when `accent` is true.
- **`<BpmDial bind:bpm />`** — the BPM display + slider. Two-way binds the bpm value back to the parent.
- **`<TransportButton playing={boolean} onstart onstop />`** — the play/stop button. Receives the playing state and callbacks for start and stop.

The page becomes a composition: it owns the audio engine state, instantiates the three components, passes the right props.

## Concept 5: Composing the page

### The composed page

`src/routes/+page.svelte` after extraction:

```svelte
<script>
  import * as Tone from 'tone';
  import ClickIndicator from '$lib/components/ClickIndicator.svelte';
  import BpmDial from '$lib/components/BpmDial.svelte';
  import TransportButton from '$lib/components/TransportButton.svelte';

  let isPlaying = $state(false);
  let bpm = $state(120);
  let pulse = $state(0);
  let beat = $state(0);

  let synth = null;
  let loop = null;

  async function start() {
    if (isPlaying) return;
    await Tone.start();
    if (!synth) synth = new Tone.MembraneSynth().toDestination();
    Tone.Transport.bpm.value = bpm;
    loop = new Tone.Loop((time) => {
      const isAccent = beat % 4 === 0;
      synth.triggerAttackRelease(isAccent ? 'C3' : 'C2', '32n', time);
      Tone.Draw.schedule(() => {
        pulse++;
        beat++;
      }, time);
    }, '4n').start(0);
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
</script>

<div class="metronome">
  <ClickIndicator {pulse} accent={beat % 4 === 1} />
  <BpmDial bind:bpm />
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

Notice how the markup shrunk. The audio engine is still here (it has to live somewhere; it doesn't belong in any one component). The three sub-components handle the visual concerns: the indicator's animation, the slider's binding, the button's labeling.

The data flow is clean:

- **Down:** `pulse` and `accent` to `ClickIndicator`. `bpm` (bindable) to `BpmDial`. `playing`, `onstart`, `onstop` to `TransportButton`.
- **Up:** `BpmDial`'s slider writes back to `bpm`. `TransportButton` calls `onstart`/`onstop` which are the parent's `start`/`stop` functions.

One direction of data per prop, except for `bpm` which is two-way because the slider lives in the child but the value belongs to the parent.

### The accent logic, briefly

`accent={beat % 4 === 1}` triggers the gold flash on every fourth beat (the downbeat). The `=== 1` (not `=== 0`) is because `beat` is incremented INSIDE `Tone.Draw.schedule`, so by the time the indicator renders, `beat` is one ahead of "current beat." Off-by-one bookkeeping that's annoying but unavoidable when you have state that mutates inside an audio callback.

We'll clean this up in lesson 4 by deriving the accent flag from a single source of truth instead of two interacting variables.

### Common mistakes when composing

- **Forgetting to import the components.** Svelte doesn't auto-import. Add the `import` line at the top of `<script>`.
- **Mixing camelCase and PascalCase.** Components use PascalCase (`<ClickIndicator />`); HTML elements use lowercase (`<div>`). The Svelte compiler distinguishes based on case.
- **Passing the wrong shape.** Type-check with TS if it matters; otherwise read your own component's signature before calling it.
- **Putting too much in the parent.** If your "composition" page is still 200 lines, you haven't extracted enough. Or you've extracted the wrong things.

## Putting it together

The four files together: three component files in `src/lib/components/`, one page in `src/routes/+page.svelte`. The audio engine lives in the page; the visual concerns live in the components.

Run it. Same UI as the lesson 2 version, but the code is split into smaller pieces. The page is ~50 lines of script and 5 lines of markup. Each component is 10-30 lines.

Now — and this is the real test — try to add something. Make the indicator larger when the BPM is over 180. (Hint: pass a `size` prop to `ClickIndicator`.) Or add a `--theme` color to the BPM display. With the extracted components, each of these changes is localized to one file.

## Exercises

### Exercise 1: Extract `<ClickIndicator>`

**Setup:** the working lesson 2 metronome with all code in `+page.svelte`.

**What to do:** create `src/lib/components/ClickIndicator.svelte` with the component shown above. Import it in the page. Replace the inline `&lbrace;#key pulse&rbrace; <div class="indicator"></div> &lbrace;/key&rbrace;` and its CSS with `<ClickIndicator {pulse} />`. Remove the indicator's styles from the page's `<style>` block.

**Verify by:** the metronome still works. The dot flashes on every tick. The page's `<style>` is shorter; the indicator's styling is now in the component file.

**Stretch:** add an `accent` prop and pass `accent={beat % 4 === 1}` from the page. Style `.indicator.accent` gold instead of blue. Watch every fourth beat flash differently.

<details>
<summary>Show solution</summary>

The component is as shown in concept 1. The parent uses it as:

```svelte
<ClickIndicator {pulse} accent={beat % 4 === 1} />
```

The reason `=== 1` and not `=== 0`: by the time the indicator renders, `beat` has already been incremented to one past the just-played click. (We'll clean this up in lesson 4.)

</details>

### Exercise 2: Extract `<BpmDial>` with `$bindable`

**Setup:** Exercise 1 complete.

**What to do:** create `src/lib/components/BpmDial.svelte` with the component shown above. Import it. Replace the inline display/slider markup and its CSS with `<BpmDial bind:bpm />`. Confirm the parent's `bpm` variable still updates when the slider moves.

**Verify by:** the BPM number displays the current `bpm`. Moving the slider in the component updates the parent's `bpm` (visible because the `$effect` that pushes to Tone still fires). The display in the component updates in real time as you drag.

**Stretch:** pass `min={60} max={200}` from the parent to constrain the slider to a narrower range. Verify the slider can't go outside those bounds.

<details>
<summary>Show solution</summary>

Component as shown. Parent imports and uses:

```svelte
<BpmDial bind:bpm min={60} max={200} />
```

The `min` and `max` are non-bindable regular props. The component reads them and passes them through to the `<input>`'s `min` / `max` attributes.

The `bind:bpm` is the interesting part — without it, the component's local `bpm` is its own variable and the parent never sees the slider changes.

</details>

### Exercise 3: Extract `<TransportButton>` with callback props

**Setup:** Exercises 1 and 2 complete.

**What to do:** create `src/lib/components/TransportButton.svelte` with the component shown above. Import it. Replace the inline button with `<TransportButton playing={isPlaying} onstart={start} onstop={stop} />`.

**Verify by:** the button shows "▶ START" when not playing and "■ STOP" when playing. Clicking it starts/stops the metronome.

**Stretch:** add a third "pause" state with `onpause` callback. Display a different icon for paused vs stopped. Wire it up in the parent (use `Tone.Transport.pause()` instead of stop).

<details>
<summary>Show solution</summary>

Component as shown. With pause added:

```svelte
<script>
  let { state = 'stopped', onstart, onstop, onpause } = $props();
  const labels = { stopped: '▶ START', playing: '■ STOP', paused: '▶ RESUME' };
</script>

<button onclick={() => {
  if (state === 'playing') onpause?.();
  else onstart?.();
}}>
  {labels[state]}
</button>
```

This is one of those "the simple version with three callbacks is fine, but a single `state` prop scales better" moments. Either design works.

</details>

### Exercise 4: Prove the components are reusable

**Setup:** all three components extracted.

**What to do:** in `+page.svelte`, render TWO copies of `<ClickIndicator>` side by side. One should flash blue (default), one should flash gold (accent always true). Both should pulse on every tick.

**Verify by:** both dots flash in sync. One is blue, one is gold. They don't interfere with each other; both are independent instances of the same component.

**Stretch:** render two complete metronome panels (full `<ClickIndicator>` + `<BpmDial>` + `<TransportButton>`) side by side, each with its own state. They should play independently — different BPMs, different start/stop states. You'll need to duplicate the audio engine state in the page (which is awkward; this is the kind of thing where a `.svelte.ts` module starts to look attractive).

<details>
<summary>Show solution</summary>

```svelte
<div class="indicators">
  <ClickIndicator {pulse} />
  <ClickIndicator {pulse} accent={true} />
</div>

<style>
  .indicators { display: flex; gap: 24px; justify-content: center; }
</style>
```

Both indicators key on the same `pulse`, so they flash together. The components are independent instances; the scoped styles work per-instance; the `&lbrace;#key&rbrace;` re-mounts each one on every change.

For two independent metronomes, you'd duplicate `isPlaying`, `bpm`, `pulse`, `beat`, `synth`, `loop`, and the start/stop logic. This is exactly where you'd want a `Metronome` class or module that encapsulates one engine — Module 4 covers shared state in `.svelte.ts` modules.

</details>

### Exercise 5 (stretch): Tempo-name component

**Setup:** the extracted metronome.

**What to do:** add a small `<TempoName bpm={number} />` component that displays the Italian tempo name for the current BPM (Largo, Andante, Allegro, etc.). Place it inside `BpmDial`, below the BPM number. Pass the BPM prop down (`<TempoName {bpm} />`).

**Verify by:** the tempo name updates as you drag the slider. At BPM 60 it says "Largo"; at 120 it says "Moderato"; at 180 it says "Presto."

**Stretch:** instead of a fixed lookup table, take a prop `tempos={array}` that lets the parent customize the ranges and names. Default to the standard Italian names.

<details>
<summary>Show solution</summary>

```svelte
<!-- TempoName.svelte -->
<script>
  let { bpm, tempos = DEFAULTS } = $props();

  const DEFAULTS = [
    { max: 60, name: 'Largo' },
    { max: 76, name: 'Adagio' },
    { max: 108, name: 'Andante' },
    { max: 120, name: 'Moderato' },
    { max: 156, name: 'Allegro' },
    { max: 168, name: 'Vivace' },
    { max: Infinity, name: 'Presto' }
  ];

  const name = $derived(tempos.find(t => bpm < t.max)?.name ?? '—');
</script>

<span class="tempo-name">{name}</span>

<style>
  .tempo-name { color: #9ea3b8; font-size: 13px; font-style: italic; }
</style>
```

Inside `BpmDial`:

```svelte
<script>
  import TempoName from './TempoName.svelte';
</script>

<div class="display">
  <span class="num">{bpm}</span>
  <span class="unit">BPM</span>
  <TempoName {bpm} />
</div>
```

The `$derived` recomputes on every `bpm` change. The component is purely a function of its props — nice and simple.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- Three new files under `src/lib/components/`: `ClickIndicator.svelte`, `BpmDial.svelte`, `TransportButton.svelte`.
- `src/routes/+page.svelte` rewritten to import and compose those three components.
- The audio engine code unchanged in behavior (synth, loop, transport).

### Verify it works

- Visiting `localhost:5173` shows the metronome panel.
- The UI is identical to lesson 2's: dark panel, big BPM number, slider, indicator, START button.
- Click START. Audio plays, indicator flashes.
- Drag the slider. BPM updates in the display AND the audio tempo changes immediately. This proves `bind:bpm` is working both directions.
- Every fourth beat flashes gold instead of blue. This proves the `accent` prop is being passed.
- STOP and re-START work without errors.

### Compare against the reference

Your three components and `+page.svelte` should be roughly the sizes shown above. If `+page.svelte` is still very long, look at what's left and ask whether more should be extracted. If a component is one line of markup, you've over-extracted.

## Common questions

**Q: When should I use `$bindable` versus a callback prop?**
A: Use `$bindable` when the prop represents "a value the parent owns that the child also edits" (form inputs, sliders, controlled UI). Use callbacks when the child needs to tell the parent "something happened" (a button was clicked, an item was selected, an action completed). The rough test: if the question is "what's the current value?" use `$bindable`; if the question is "what just happened?" use a callback.

**Q: Why not use `$bindable` for everything that the child writes back?**
A: Because two-way binding hides the data flow. Reading a component's signature with one bindable per prop, you can't tell which the parent expects to receive updates on. Callbacks make the flow explicit: the child says "I'm calling onfoo, parent decide what to do." For a slider, "the value of the slider" is unambiguous — `$bindable` is fine. For "user clicked an item in a list" the right shape is `onselect(item)`, not `bind:selected`.

**Q: Can I pass a snippet as a prop?**
A: Yes — that's exactly what snippets are. We'll cover them in lesson 4 (they're how the `SubdivisionPicker` lets the parent customize how each option is rendered). The short version: snippets are reusable chunks of markup you can pass around like values.

**Q: What replaced `createEventDispatcher` from Svelte 4?**
A: Callback props. The Svelte 5 docs have a migration guide. The summary: a Svelte 4 `dispatch('action', payload)` becomes a callback prop `onaction(payload)`. The parent's `on:action={handler}` becomes `onaction={handler}`. Cleaner, fewer concepts, and the types flow naturally because callbacks are just functions.

**Q: My component re-renders too much. How do I optimize?**
A: Usually you don't have to. Svelte 5's reactivity is fine-grained — only the bits that actually changed re-render. If you've measured a real performance issue (in dev tools, not in your head), then look at: derived values that depend on too much, effects that mutate state in a loop, or large lists where each item is a heavy component. The `&lbrace;#each&rbrace;` block has a `(key)` syntax that helps Svelte identify which items changed — use it for lists. For most apps, premature optimization here is a waste.

## What's next

Lesson 4 adds subdivisions to the metronome: quarter, eighth, triplet, sixteenth notes. The picker UI introduces snippets — Svelte 5's parameterized chunks of markup, replacing Svelte 4's slot system. You'll see how a snippet prop lets a parent customize a child's rendering without inheritance or composition gymnastics.

<SourcesSection lessonKey="03-metronome-studio/03-components" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
