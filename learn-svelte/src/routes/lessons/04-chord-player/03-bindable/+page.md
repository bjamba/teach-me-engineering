<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Two-Way Binding with $bindable · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-4);">

<LessonHeader
  moduleSlug="04-chord-player"
  lessonSlug="03-bindable"
  title="Two-Way Binding with $bindable"
  blurb="Extract the chord picker into a component. The parent binds to its values. Two-way data flow done right."
/>

## Why this lesson exists

The chord picker — the root dropdown plus the quality dropdown — is going to appear in at least two places: the add-a-chord row at the bottom of the progression, and an inline editor for existing chords. Two copies of the same JSX-like markup with two copies of the same handler wiring is a smell. Extracting a `ChordPicker` component is the obvious move.

The question is how the parent and the picker communicate. The picker has internal state (the currently-selected root and quality). The parent needs to read that state — to know what chord to add when the user clicks ADD. It also needs to write to it sometimes — to preset the picker to a chord the user wants to edit. Both directions.

Svelte 5 gives you two clean answers: callback props (one-way data + an event) or `$bindable` props (two-way binding). This lesson teaches `$bindable`, the cases it's right for, and — equally important — the cases where reaching for it is the wrong instinct.

## Learning objectives

By the end of this lesson you'll be able to:

- Declare a prop as `$bindable()` and explain what changes vs. a regular prop.
- Use `bind:` on a custom component from the parent.
- Decide between `$bindable` and a callback prop for a given component contract.
- Explain how Svelte's `bind:` compiles to a getter/setter pair under the hood.
- Recognize the over-bindable anti-pattern (using `$bindable` for props that don't need it).

## Concept 1: Plain props recap

### What it is

Before `$bindable`, the picker can already be extracted with regular props. The parent passes initial values and a callback; the child reports changes by calling the callback. This is one-way data flow plus events — the React shape, the Vue 2 shape, the every-other-framework shape.

Worth keeping in mind: `$bindable` is a convenience layered on top of plain props. If you understand how the one-way version works, the two-way version is just nicer ergonomics around the same idea.

### Worked example (one-way version)

```svelte
<!-- ChordPicker.svelte (one-way version) -->
<script>
  const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const QUALITIES = [/* ... */];

  let { root, quality, onchange } = $props();
</script>

<select value={root} onchange={(e) => onchange({ root: e.target.value, quality })}>
  &lbrace;#each ROOTS as r&rbrace;<option value={r}>{r}</option>&lbrace;/each&rbrace;
</select>
<select onchange={(e) => onchange({ root, quality: QUALITIES.find(q => q.id === e.target.value) })}>
  &lbrace;#each QUALITIES as q (q.id)&rbrace;
    <option value={q.id} selected={q === quality}>{q.label}</option>
  &lbrace;/each&rbrace;
</select>
```

```svelte
<!-- parent -->
<ChordPicker
  root={pickerRoot}
  quality={pickerQuality}
  onchange={(c) => { pickerRoot = c.root; pickerQuality = c.quality; }}
/>
```

This works. It's also verbose. The picker can't use `bind:value` on its own `<select>` because `root` and `quality` are read-only props (the child shouldn't reassign them); so the child has to fake binding by reading the current value, computing the new one, and shipping the result via `onchange`.

The parent has to write a callback that destructures the partial-state object and reassigns each variable. Multiply by every place the picker shows up, and the cruft adds up.

### When this is the right choice anyway

If the child has more than two pieces of state, or the change semantics are complex (e.g., a debounced change, validated input that can reject the new value), the explicit callback is more honest. You can see exactly what the contract is. With `$bindable` the contract is implicit: "binding to this prop assigns to the parent's variable on every change, no transform, no validation."

For the chord picker, where the contract really is just "tell the parent what's currently selected, with no transformation," `$bindable` is the right tool. For an `EmailInput` component that validates and only commits on blur, a callback prop is cleaner.

### Common mistakes

- **Trying to reassign a normal prop in the child.** `root = 'D'` in the child does nothing visible to the parent and Svelte will warn about it. Plain props are read-only from the child's perspective.
- **Spread the whole state in `onchange` even when only one field changed.** That's what the example above does and it's annoying. Either accept it as the price of one-way data, or pass two callbacks (`onrootchange`, `onqualitychange`), or — the lesson — switch to `$bindable`.

## Concept 2: `$bindable()` props

### What it is

`$bindable()` marks a prop as bindable from the parent. It's a function you wrap the default value in:

```js
let { root = $bindable('C'), quality = $bindable(QUALITIES[0]) } = $props();
```

The default-value argument to `$bindable` is used only if the parent doesn't pass anything for that prop. The presence of `$bindable()` tells the compiler "if a parent does `bind:root={...}`, that's legal; otherwise this acts like a normal prop with this default."

Inside the child, the bindable prop behaves like reactive state. You can read it and write it. Writes flow back to whatever the parent bound to.

From the parent's side, `bind:root={parentVar}` is the directive. The parent's `parentVar` is the source of truth. The child's `root` is a window onto it. Both sides see the same value; either side can update it.

The mental model is identical to `bind:value` on an `<input>`. The native form binding has been working this way since Svelte 1; `$bindable` just extends the mechanism to custom-component props.

### Worked example

`src/lib/components/ChordPicker.svelte`:

```svelte
<script>
  const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const QUALITIES = [
    &lbrace; id: 'maj', label: 'major',  intervals: [0, 4, 7] &rbrace;,
    &lbrace; id: 'min', label: 'minor',  intervals: [0, 3, 7] &rbrace;,
    &lbrace; id: '7',   label: '7',      intervals: [0, 4, 7, 10] &rbrace;,
    &lbrace; id: 'maj7', label: 'maj7',  intervals: [0, 4, 7, 11] &rbrace;,
    &lbrace; id: 'min7', label: 'min7',  intervals: [0, 3, 7, 10] &rbrace;
  ];

  let {
    root = $bindable('C'),
    quality = $bindable(QUALITIES[0])
  } = $props();
</script>

<div class="picker">
  <select bind:value={root}>
    &lbrace;#each ROOTS as r&rbrace;<option value={r}>{r}</option>&lbrace;/each&rbrace;
  </select>
  <select bind:value={quality}>
    &lbrace;#each QUALITIES as q (q.id)&rbrace;<option value={q}>{q.label}</option>&lbrace;/each&rbrace;
  </select>
</div>

<style>
  .picker { display: flex; gap: 6px; }
  select {
    flex: 1; padding: 8px;
    background: #11131a; color: #ecedf3;
    border: 1px solid #262a3a; border-radius: 8px;
    font: inherit;
  }
</style>
```

The child uses `bind:value` on its own `<select>` elements as if `root` and `quality` were local state. They aren't — they're bindable props — but the binding mechanism doesn't care. A write flows from the user's interaction into the child's `root` variable, through the bindable mechanism, into the parent's bound variable.

The parent:

```svelte
<script>
  import ChordPicker from '$lib/components/ChordPicker.svelte';

  let pickerRoot = $state('C');
  let pickerQuality = $state(QUALITIES[0]);
</script>

<ChordPicker bind:root={pickerRoot} bind:quality={pickerQuality} />
```

Two `bind:` directives. The parent's variables are the source of truth. The picker reads them on render and writes them on change.

### Variations

Binding to a nested property:

```svelte
<ChordPicker bind:root={currentChord.root} bind:quality={currentChord.quality} />
```

Works. Svelte compiles each `bind:` into a getter/setter pair targeting the path. Writes update the nested property in place.

Binding to one prop, leaving the other as a plain default:

```svelte
<ChordPicker bind:root={pickerRoot} quality={someQuality} />
```

`root` is two-way bound; `quality` is just a regular prop, no binding. The child still works because the default value pattern (`= $bindable(QUALITIES[0])`) makes the binding optional. If a parent passes `quality` without `bind:`, the child treats it like a regular prop (changes inside the child still flow to nothing — they update the child's local view of the prop but there's no parent to write back to).

A single bindable object:

```svelte
let { chord = $bindable({ root: 'C', quality: QUALITIES[0] }) } = $props();
```

Then in the child:

```svelte
<select bind:value={chord.root}>...</select>
<select bind:value={chord.quality}>...</select>
```

This is often nicer when the props move together. The parent:

```svelte
<ChordPicker bind:chord={currentChord} />
```

A single binding for two coupled values. The tradeoff is that the parent now has to construct the object even if it only cares about the root.

### Common mistakes

- **Forgetting `$bindable()` and getting a confusing error.** If you write `let { root = 'C' } = $props()` and the parent does `bind:root={...}`, Svelte throws `bindable property root not declared`. The fix is `$bindable('C')`.
- **Using `$bindable` for a prop that the parent doesn't actually bind.** Compiles fine, runs fine. Just unnecessary overhead and a misleading contract — readers think binding is intended.
- **Two-way binding to a derived value.** `bind:value={someDerivedExpression}` doesn't compile — Svelte needs a writable storage location to write back into. You can only bind to a variable or a property path that supports assignment.
- **Treating bindable props as one-way and reading without binding.** A parent that does `<ChordPicker root={pickerRoot} />` (no `bind:`) only passes the initial value. Changes in the child won't flow back. The parent silently misses every user input. Always use `bind:` when you intend two-way.

### TypeScript notes

Typing bindable props uses the same `$props` types you've seen before:

```ts
type Props = {
  root?: string;
  quality?: Quality;
};

let { root = $bindable('C'), quality = $bindable(QUALITIES[0]) }: Props = $props();
```

The `?` on the prop type matches the fact that the parent doesn't have to provide a value (the `$bindable` default kicks in if they don't).

## Concept 3: When NOT to use `$bindable`

### What it is

The temptation, once you know about `$bindable`, is to use it for every prop that the parent might want to read after a change. Resist. Two-way binding has real costs that callback props don't.

The cost of binding: the data-flow direction becomes ambiguous. Looking at the parent, you can't tell which way values are moving — both directions are possible. Looking at the child, you can't tell which writes are "internal updates" and which are "explicit interactions the parent might react to." Debugging gets harder because state changes can originate from anywhere on either side.

The cost of callbacks: the parent has to write more code. The benefit: the contract is explicit. The child says "I'll call your function when something changes; you decide what that means." The parent has total control over the response. Reading the parent code, the data flow is unambiguous (props go in, callbacks fire on events, the parent's reaction is in one place).

The general rule: **use `$bindable` only when the child genuinely owns the update logic for the value, and the parent's only response to a change is to store it.** If the parent wants to do anything besides "store this," use a callback.

### Worked example

A case where `$bindable` is right (the chord picker):

```svelte
<ChordPicker bind:root={pickerRoot} bind:quality={pickerQuality} />
```

The picker owns the dropdowns. The user changes the value. The parent's reaction is "remember this value for when ADD is clicked." Pure storage. Bind it.

A case where a callback is right (a chord editor that validates):

```svelte
<ChordEditor chord={current} oncommit={(newChord) => { if (isValid(newChord)) progression.update(newChord); }} />
```

The editor proposes a new chord; the parent decides whether to accept it. Two-way binding would skip the validation step — every keystroke would write to the parent unconditionally. The callback puts the parent in charge.

A case where you might use both (a form with internal editing state):

```svelte
<ChordPicker bind:root={draft.root} bind:quality={draft.quality} onsubmit={() => save(draft)} />
```

The picker two-way binds the in-progress draft. The form-level submit fires a callback when the user is done. Two-way for the field updates, callback for the commit event.

### The smell: binding + effecting

If you ever find yourself writing this:

```svelte
let value = $state('x');
$effect(() => {
  doSomething(value);  // react to the binding
});

<MyComponent bind:value={value} />
```

…you've picked the wrong abstraction. The `$effect` reacting to the bound value is the parent reacting to a child's event — exactly what a callback prop is for. Replace with:

```svelte
<MyComponent value={x} onchange={(newValue) => { x = newValue; doSomething(newValue); }} />
```

The data flow is now explicit. The reaction is in the right place.

### Common mistakes

- **Using `$bindable` because "what if the parent wants to react someday."** Premature flexibility. Add `$bindable` when a parent actually needs it.
- **Mixing binding and `$effect` in the parent.** See above. The combination almost always means you should be using a callback.
- **Binding to internal child state by name.** If the parent bind:s to a prop the child treats as "internal scratch space," changes from the parent might fight with the child's own logic. Bindable props should be data the child intends to expose.

## Concept 4: How `bind:` compiles

### What it is

For `<input bind:value={x}>`, Svelte's compiler emits code that:

1. Reads `x` on render, sets `input.value = x`.
2. Attaches an `input` event listener that writes `x = input.value` on every change.

For `<MyComponent bind:value={x}>`, the compiler does almost the same thing, just at the component boundary:

1. Passes both a getter (`() => x`) and a setter (`(v) => x = v`) to the child as part of its props.
2. The child uses the getter/setter to read and write the bindable prop.

The runtime mechanism is one unified system; native elements and custom components are treated the same. The same code paths that handle `bind:value` on an `<input>` handle it on a `ChordPicker`.

You almost never need to know this. It's useful to keep in your back pocket for two reasons: (a) it explains why bindable props are restricted to writable locations (the compiler needs to emit a setter), and (b) it makes the cost obvious — every binding is a getter and a setter, called on every relevant change.

### Worked example (compiled output, simplified)

The parent expression:

```svelte
<ChordPicker bind:root={pickerRoot} bind:quality={pickerQuality} />
```

Compiles roughly to:

```js
ChordPicker({
  get root() { return pickerRoot; },
  set root(v) { pickerRoot = v; },
  get quality() { return pickerQuality; },
  set quality(v) { pickerQuality = v; }
});
```

(Not literally — the real codegen uses runtime helpers and proxies — but conceptually that's what's happening.)

The child sees `root` and `quality` as bindable accessors and uses them transparently with `bind:value`.

### Variations and edge cases

You can bind to a function call result if it's also a setter, but it has to be an actual `setter` property of some object — not a function call. In practice this means "bind to a variable or a property path."

You can bind to a getter-only computed value? No. The compiler errors. There has to be a writable target.

A note on naming: pre-Svelte-5 had `export let value` for props. Svelte 5 uses `$props()` destructuring. Bindable props were always implicitly any prop in Svelte 4; Svelte 5 made them opt-in for explicitness.

### Common mistakes

- **Wondering why `bind:` is "slower" than plain props.** It isn't, meaningfully. The cost is one getter call per render and one setter call per change. Indistinguishable in practice from any other reactive read/write.
- **Trying to bind to a non-writable expression.** `bind:value={someObj.computedProperty}` where `computedProperty` is a getter without a setter. Errors at compile time. Provide a setter or restructure.

## Putting it together

The full updated parent, replacing the inline picker with the `ChordPicker` component:

```svelte
<script>
  import * as Tone from 'tone';
  import ChordPicker from '$lib/components/ChordPicker.svelte';

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

  // ... helpers, ensureSynth, playChord, playProgression all unchanged ...

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
</script>

<div class="card">
  <h2>Progression</h2>

  <ol class="chords">
    &lbrace;#each progression as c, i (c.id)&rbrace;
      <li class="chord" class:active={i === currentIndex} onclick={() => playChord(c)}>
        <span class="name">{c.root}{c.quality.label === 'major' ? '' : ' ' + c.quality.label}</span>
        <button class="remove" onclick={(e) => { e.stopPropagation(); removeChord(c.id); }}>×</button>
      </li>
    &lbrace;/each&rbrace;
  </ol>

  <div class="add-row">
    <ChordPicker bind:root={pickerRoot} bind:quality={pickerQuality} />
    <button class="add" onclick={addChord}>+ ADD</button>
  </div>

  <button class="play-all" onclick={playProgression} disabled={progression.length === 0}>
    {isPlaying ? '■ STOP' : '▶ PLAY ALL'}
  </button>
</div>
```

Visually identical to the previous lesson. Architecturally, the picker is now a reusable component and the parent has half as much markup. The hookup is two `bind:` directives.

## Exercises

### Exercise 1: Inline edit existing chords

**Setup:** clicking a chord plays it. There's no way to edit one.

**What to do:** add an "edit" mode where clicking a small ✎ button on a chord row replaces that row's label with a `<ChordPicker bind:root={c.root} bind:quality={c.quality} />`. Clicking ✓ confirms the edit (just exits edit mode — the binding has already updated the chord). Clicking ✗ cancels.

**Verify by:** editing a chord and pressing ✓ updates the chord; PLAY ALL plays the edited version. Editing with ✗ cancels — the original chord is unchanged.

**Stretch:** make ✗ actually revert. (Hint: snapshot the chord before opening edit mode; restore from the snapshot on cancel.)

<details>
<summary>Show solution</summary>

```svelte
<script>
  let editingId = $state(null);
  let snapshot = null;

  function startEdit(c) {
    snapshot = { root: c.root, quality: c.quality };
    editingId = c.id;
  }
  function commitEdit() { editingId = null; snapshot = null; }
  function cancelEdit(c) {
    if (snapshot) { c.root = snapshot.root; c.quality = snapshot.quality; }
    editingId = null;
    snapshot = null;
  }
</script>

&lbrace;#each progression as c (c.id)&rbrace;
  <li>
    &lbrace;#if editingId === c.id&rbrace;
      <ChordPicker bind:root={c.root} bind:quality={c.quality} />
      <button onclick={commitEdit}>✓</button>
      <button onclick={() => cancelEdit(c)}>✗</button>
    &lbrace;:else&rbrace;
      <span>{c.root} {c.quality.label}</span>
      <button onclick={() => startEdit(c)}>✎</button>
    &lbrace;/if&rbrace;
  </li>
&lbrace;/each&rbrace;
```

The picker binds directly to the chord's properties in the array. Because chords in `$state` arrays are themselves proxied, this works without any further plumbing. The snapshot is a plain JS object captured before edit; restoring from it just assigns the saved values back.

</details>

### Exercise 2: Convert to a single-object bindable

**Setup:** the picker has two bindable props (root, quality).

**What to do:** refactor `ChordPicker` to take a single `chord = $bindable({ root: 'C', quality: QUALITIES[0] })` prop. The dropdowns bind to `chord.root` and `chord.quality`. Update the parent to pass a single bound object.

**Verify by:** the picker still works. The parent has one binding instead of two.

**Stretch:** is the result better or worse than two props? Write a short note in a comment explaining when you'd prefer one form over the other.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let { chord = $bindable({ root: 'C', quality: QUALITIES[0] }) } = $props();
</script>

<select bind:value={chord.root}>...</select>
<select bind:value={chord.quality}>...</select>
```

Parent:

```svelte
let picker = $state({ root: 'C', quality: QUALITIES[0] });

<ChordPicker bind:chord={picker} />
```

Better when: the values move together (an "edit a chord" form). The parent gets one cohesive object.

Worse when: the picker is used for unrelated state (root from variable A, quality from variable B). The two-prop version doesn't force the parent to invent a combined object just to satisfy the picker's API.

</details>

### Exercise 3: A read-only display variant

**Setup:** ChordPicker is always editable.

**What to do:** add a `readonly` prop. When true, the dropdowns are replaced with a plain `<span>{root} {quality.label}</span>`. The bindable props still exist; they're just not editable in the UI.

**Verify by:** `<ChordPicker root="D" quality={QUALITIES[1]} readonly />` renders "D minor" as text, no dropdowns. Without `readonly`, the dropdowns appear and work as before.

**Stretch:** add a `disabled` prop that keeps the dropdowns visible but `disabled`. Different from `readonly` in that the user can see the controls but can't interact with them — useful while a save is in flight.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let { root = $bindable('C'), quality = $bindable(QUALITIES[0]), readonly = false, disabled = false } = $props();
</script>

&lbrace;#if readonly&rbrace;
  <span>{root} {quality.label}</span>
&lbrace;:else&rbrace;
  <div class="picker">
    <select bind:value={root} {disabled}>...</select>
    <select bind:value={quality} {disabled}>...</select>
  </div>
&lbrace;/if&rbrace;
```

`disabled` is a plain prop with a boolean default. `{disabled}` on the `<select>` is shorthand for `disabled={disabled}` — the standard HTML disabled attribute.

</details>

### Exercise 4 (stretch): Replace `$bindable` with a callback

**Setup:** the picker uses two bindable props.

**What to do:** revert to the one-way version: regular props for `root` and `quality`, plus a single `onchange` callback that fires with the new chord. The parent's wiring becomes longer; the picker's contract becomes more explicit.

**Verify by:** the picker still works in the parent. Read the parent code and confirm the data flow is more obviously one-directional.

**Stretch:** write a paragraph in a comment explaining which form you'd ship in a real app. There's no right answer; the reasoning is the exercise.

<details>
<summary>Show solution</summary>

See the one-way example at the top of Concept 1. The parent's wiring becomes:

```svelte
<ChordPicker
  root={pickerRoot}
  quality={pickerQuality}
  onchange={(c) => { pickerRoot = c.root; pickerQuality = c.quality; }}
/>
```

Verdict: for this exact case (picker → parent stores) `$bindable` wins on conciseness. For a picker that does something more complex (validation, async commit), the callback wins on clarity. Both forms are legitimate.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/lib/components/ChordPicker.svelte` with two `$bindable` props.
- The parent (`src/routes/+page.svelte`) importing and using ChordPicker with `bind:`.
- No regression — the page behaves the same as it did at the end of L2.

### Verify it works

- The picker still adds chords with ADD.
- Changing the dropdowns updates `pickerRoot` and `pickerQuality` (you can verify by putting a `<p>current: {pickerRoot} {pickerQuality.label}</p>` somewhere in the parent during testing).
- The picker file is reusable — you could drop it into another component and bind to different variables.

### Compare against the reference

`learn-svelte/capstone-reference/chord-player/src/lib/components/ChordPicker.svelte` should match what you wrote.

## Common questions

**Q: Why does `$bindable` need a function call (`$bindable('C')`) instead of just an annotation?**
A: Because it serves two roles at once: it marks the prop as bindable AND it provides a default value. The function call form lets you do both in one expression. Svelte's compiler recognizes the call and emits the bindable boilerplate; the argument becomes the default.

**Q: What if the parent uses `bind:` but the child doesn't declare the prop as `$bindable`?**
A: Compile-time error. The compiler can tell from the child's `$props()` destructure which props are bindable, and it refuses to emit a binding for one that isn't.

**Q: Can I have a bindable prop and a regular prop with the same name in different components?**
A: Yes. Bindability is per-component-per-prop. `<ChordPicker bind:root={x}>` works only if ChordPicker's `root` prop is bindable. A different component's `root` prop might not be.

**Q: Does binding work across more than one level?**
A: Yes, by re-binding at each level. A grandparent binds to the parent, the parent binds to the child, each link uses `bind:`. The grandparent's variable is the source of truth all the way down.

**Q: Is `$bindable` available in `.svelte.ts` modules?**
A: No. Bindable is for component props specifically. Module-level state doesn't have a parent to bind to. The shared-state pattern in the next lesson is the answer for "make state visible across components."

## What's next

The picker is reusable, but `progression` itself still lives in `+page.svelte`. As soon as a sidebar component or a header counter wants to read or modify the progression, prop-drilling becomes the problem. The next lesson moves the progression state into a `.svelte.ts` module — Svelte 5's replacement for the old `writable`/`readable` store API. You'll see how a single instance of a class with `$state` fields gives you shared, reactive, importable state from anywhere in the app.

<SourcesSection lessonKey="04-chord-player/03-bindable" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
