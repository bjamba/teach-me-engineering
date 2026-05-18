<script>
  import CompileSandbox from '$lib/sandbox/CompileSandbox.svelte';
  import OpenTheHood from '$lib/components/OpenTheHood.svelte';
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';

  const guessSource = `<script>
  let mode = $state('detect'); // 'detect' or 'guess'
  let target = $state(120);
  let taps = $state([]);

  let bpm = $derived.by(() => {
    if (taps.length < 2) return null;
    const recent = taps.slice(-8);
    let total = 0;
    for (let i = 1; i < recent.length; i++) total += recent[i] - recent[i - 1];
    return Math.round(60000 / (total / (recent.length - 1)));
  });

  // In guess mode, derive a verdict object grouping label + class.
  let accuracy = $derived.by(() => {
    if (mode !== 'guess' || bpm === null) return null;
    const diff = Math.abs(bpm - target);
    if (diff <= 1) return { label: 'PERFECT', class: 'perfect', diff };
    if (diff <= 3) return { label: 'GREAT', class: 'great', diff };
    if (diff <= 7) return { label: 'OK', class: 'ok', diff };
    return { label: \`OFF BY \${diff}\`, class: 'off', diff };
  });

  function handleTap() { taps.push(Date.now()); }
  function reset() { taps = []; }

  function newTarget() {
    target = 60 + Math.floor(Math.random() * 120); // 60-180 BPM
    taps = [];
  }
<\/script>

<div class="card">
  <div class="modes">
    <button class:active={mode === 'detect'} onclick={() => mode = 'detect'}>DETECT<\/button>
    <button class:active={mode === 'guess'} onclick={() => mode = 'guess'}>GUESS<\/button>
  <\/div>

  {#if mode === 'guess'}
    <div class="target">
      target: <span class="target-num">{target}<\/span> BPM
      <button class="new" onclick={newTarget}>new target<\/button>
    <\/div>
  {/if}

  <div class="bpm-display">
    {#if bpm}
      <span class="num">{bpm}<\/span><span class="unit">BPM<\/span>
    {:else}
      <span class="prompt">tap to start<\/span>
    {/if}
    {#if accuracy}
      <div class="accuracy {accuracy.class}">{accuracy.label}<\/div>
    {/if}
  <\/div>

  <button class="tap" onclick={handleTap}>TAP<\/button>

  <div class="meta">
    <span>{taps.length} taps<\/span>
    <button class="reset" onclick={reset} disabled={taps.length === 0}>reset<\/button>
  <\/div>
<\/div>

<style>
  .card { max-width: 320px; margin: 0 auto; padding: 24px; background: #1a1d2a;
    border-radius: 16px; font-family: system-ui; color: #ecedf3; }
  .modes { display: flex; gap: 8px; margin-bottom: 16px; }
  .modes button {
    flex: 1; background: #11131a; color: #9ea3b8; border: 1px solid #262a3a;
    padding: 8px; border-radius: 8px; font: inherit; cursor: pointer;
    font-size: 12px; letter-spacing: 0.1em; font-weight: 600;
  }
  .modes button.active { background: #e5468b; color: white; border-color: #e5468b; }
  .target { background: #11131a; padding: 12px; border-radius: 8px;
    text-align: center; margin-bottom: 16px; color: #9ea3b8; font-size: 14px; }
  .target-num { color: #e5468b; font-weight: 700; font-size: 18px; }
  .new { display: block; margin: 8px auto 0; background: transparent;
    color: #9ea3b8; border: 1px solid #262a3a; padding: 4px 10px;
    border-radius: 6px; font-size: 12px; cursor: pointer; }
  .bpm-display { text-align: center; padding: 16px 0;
    border-bottom: 1px solid #262a3a; margin-bottom: 16px; min-height: 100px; }
  .num { font-size: 64px; font-weight: 700; color: #e5468b; line-height: 1; }
  .unit { font-size: 14px; color: #9ea3b8; margin-left: 6px; }
  .prompt { font-size: 18px; color: #5e6378; }
  .accuracy { margin-top: 8px; font-family: monospace; font-size: 14px;
    letter-spacing: 0.1em; font-weight: 700; }
  .accuracy.perfect { color: #5cd991; }
  .accuracy.great { color: #b8d958; }
  .accuracy.ok { color: #f0c050; }
  .accuracy.off { color: #ff6464; }
  .tap { width: 100%; background: #e5468b; color: white; border: 0;
    padding: 24px; font-size: 24px; font-weight: 700; border-radius: 12px;
    letter-spacing: 0.1em; cursor: pointer;
    box-shadow: 0 8px 24px -8px #e5468b; }
  .tap:active { transform: translateY(1px); }
  .meta { display: flex; justify-content: space-between; align-items: center;
    margin-top: 16px; color: #9ea3b8; font-size: 14px; }
  .reset { background: transparent; color: #9ea3b8; border: 1px solid #262a3a;
    padding: 6px 12px; border-radius: 6px; cursor: pointer; font: inherit; }
  .reset:disabled { opacity: 0.4; cursor: not-allowed; }
<\/style>
`;

  const classBindingDemo = `<script>
  let selected = $state('apple');
  const fruits = ['apple', 'banana', 'cherry'];
<\/script>

<div class="row">
  {#each fruits as fruit}
    <button class:active={selected === fruit} onclick={() => selected = fruit}>
      {fruit}
    <\/button>
  {/each}
<\/div>
<p>selected: {selected}<\/p>

<style>
  .row { display: flex; gap: 8px; margin-bottom: 12px; }
  button {
    background: #f0f0f0; border: 2px solid transparent; padding: 8px 16px;
    border-radius: 8px; font: inherit; cursor: pointer;
  }
  button.active {
    background: #e5468b; color: white; border-color: #c93570;
  }
  p { font-family: system-ui; }
<\/style>
`;

  const verdictObjectDemo = `<script>
  let score = $state(0);

  let verdict = $derived.by(() => {
    if (score >= 90) return { grade: 'A', tone: 'great',  message: 'excellent' };
    if (score >= 80) return { grade: 'B', tone: 'good',   message: 'solid' };
    if (score >= 70) return { grade: 'C', tone: 'meh',    message: 'passable' };
    if (score >= 60) return { grade: 'D', tone: 'bad',    message: 'rough' };
    return                 { grade: 'F', tone: 'bad',    message: 'try again' };
  });
<\/script>

<input type="range" min="0" max="100" bind:value={score} />
<div class="card {verdict.tone}">
  <span class="grade">{verdict.grade}<\/span>
  <span>{score} — {verdict.message}<\/span>
<\/div>

<style>
  input { width: 100%; margin-bottom: 12px; }
  .card {
    padding: 16px; border-radius: 12px; font-family: system-ui;
    display: flex; gap: 16px; align-items: center;
  }
  .grade { font-size: 36px; font-weight: 700; }
  .card.great { background: #d4f5dc; color: #1f6b3a; }
  .card.good  { background: #e6f0d4; color: #4a6b1f; }
  .card.meh   { background: #fcf3d4; color: #6b561f; }
  .card.bad   { background: #fcd4d4; color: #6b1f1f; }
<\/style>
`;
</script>

<svelte:head><title>Guess the Tempo Mode · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-2);">

<LessonHeader
  moduleSlug="02-tap-tempo-detective"
  lessonSlug="05-guess-mode"
  title="Guess the Tempo Mode"
  blurb="A small game on top of the detector. A target BPM, your tap, an accuracy verdict. Compose state, derived, and class bindings into a real interactive feature."
/>

## Why this lesson exists

The detector is functional. You can tap a tempo and read a BPM. But "tool" and "interesting tool" are different things — a feature that gives the user a goal and feedback turns the detector into something you might actually open. So we add a layer: GUESS mode. The app picks a random target tempo between 60 and 180 BPM. You tap. The app tells you how close you got — PERFECT, GREAT, OK, or OFF BY N — with a color that matches the verdict.

There are no new runes in this lesson. Everything you need — `$state`, `$derived`, `&lbrace;#if&rbrace;`, event handlers — you have already seen. The lesson is about composition: how those primitives stack into a working feature without you having to learn anything new. It also introduces two small but high-leverage patterns: the `class:` directive (cleaner than ternaries in template strings), and the "verdict object" shape for grouping a label plus a CSS class plus any other ancillary fields a UI needs to render a single state.

By the end you will have shipped a real, tiny app: a tap-tempo detector with a guess-the-tempo game mode, persisted across reloads. The full module, top to bottom.

## Learning objectives

By the end of this lesson you will be able to:

- Compose `$state` and `$derived` to add a new feature without rewriting existing reactive code.
- Use the `class:name=&lbrace;cond&rbrace;` directive to toggle a CSS class based on a reactive boolean.
- Interpolate a value into a class attribute (`class="base &lbrace;dynamic&rbrace;"`) for per-state styling.
- Return a structured "verdict" object from a `$derived` to group a label, a class, and any other related fields used by one UI element.
- Recognize the decomposition pattern (state, derived, action, template) and apply it to a new feature on the spot.

## Concept 1: Composing $state + $derived for a new feature

### What it is

The previous lessons gave you `$state` (mutable reactive values) and `$derived` (cached computations over reactive values). The detector uses both: `taps` is state, `bpm` is derived. To add GUESS mode you do the same thing, one level up. New states (the mode toggle, the target tempo) and new deriveds (the accuracy verdict) plug into the existing wiring without changing any of it.

That is the test of well-decomposed reactive code: a feature addition is purely additive. You do not have to rewrite `bpm`, you do not have to refactor `handleTap`, you do not have to change the layout of the existing display. You add a state for `mode`, a state for `target`, a derived for `accuracy`, and the template gains a few new `&lbrace;#if&rbrace;` branches. That is the whole change.

This style is enabled by the reactivity model. Because every read is automatically tracked, you can read `bpm` from inside the new `accuracy` derived without registering the dependency by hand. Because writes propagate through the entire graph automatically, a tap continues to update `bpm`, and now also flows through to `accuracy`, which flows through to the new UI. There is no glue code.

### Worked example

The two new states:

```svelte
let mode = $state('detect'); // 'detect' or 'guess'
let target = $state(120);
```

`mode` is a string with two valid values. `target` is the current BPM goal in GUESS mode. Neither depends on anything; they are user-controllable inputs.

The new derived:

```svelte
let accuracy = $derived.by(() => {
  if (mode !== 'guess' || bpm === null) return null;
  const diff = Math.abs(bpm - target);
  if (diff <= 1) return { label: 'PERFECT', class: 'perfect', diff };
  if (diff <= 3) return { label: 'GREAT',   class: 'great',   diff };
  if (diff <= 7) return { label: 'OK',      class: 'ok',      diff };
  return            { label: `OFF BY ${diff}`, class: 'off', diff };
});
```

This derived reads `mode`, `bpm`, and `target`. The dependency set is dynamic: when `mode === 'detect'`, only `mode` is tracked (the function returns null without reading anything else); when `mode === 'guess'`, all three are tracked. As soon as `mode` flips to `'guess'`, the next evaluation reads `bpm` and `target` for the first time and registers them.

The new event handler:

```svelte
function newTarget() {
  target = 60 + Math.floor(Math.random() * 120); // 60-180
  taps = [];
}
```

Rolls a new target in the 60-180 range and clears the taps so the user starts fresh. The reset of `taps` triggers `bpm` to invalidate (back to null), which triggers `accuracy` to invalidate (also back to null), which causes the verdict UI to disappear. One state write, three reactive consequences, zero manual wiring.

The existing `handleTap`, `reset`, `bpm` — all unchanged. The detector logic does not know GUESS mode exists.

### Variation: the decomposition cheat sheet

When adding a feature to a Svelte component, ask four questions in order:

1. **What new state does this need?** (Things the user can change, or that change over time, that are not derivable from existing state.) Declare them with `$state`.
2. **What new derived values does this need?** (Things that are functions of existing or new state.) Declare them with `$derived` or `$derived.by`.
3. **What new actions does this need?** (Things the user can DO.) Declare them as plain functions, called from event handlers.
4. **What new template needs to render?** (UI for the new state and derived values.) Add markup with `&lbrace;#if&rbrace;`, class bindings, and bindings as needed.

For GUESS mode the answers were: two states (`mode`, `target`), one derived (`accuracy`), one action (`newTarget`), and three small template additions (the mode buttons, the target display, the accuracy badge). That is roughly 30 lines of code for a complete game mode.

### Variation: when to add a new derived vs. inline the expression

You could have written `&lbrace;Math.abs(bpm - target)&rbrace;` directly in the template and skipped the derived. For a single read used in one place, that is fine. The case for a derived gets stronger as:

- The expression is used in multiple places.
- The expression is non-trivial (more than one operation or a multi-line computation).
- The expression has a name worth giving (the name documents intent).

`accuracy` qualifies on all three. It is read by the badge label, the badge class, and could be read by a future "best score" tracker. The branching logic deserves the name. The class lookup wants to be cached.

### Common mistakes

- **Adding state for things that should be derived.** "I'll store the accuracy and update it on every tap." No — `accuracy` is a function of `bpm`, `mode`, and `target`. Make it a `$derived`. Storing it as state means you have to remember to update it from three different places.
- **Putting the random-target generation in a `$derived`.** A derived must be pure; `Math.random()` is not. `target` is state that you write to from an event handler.
- **Reading `bpm` inside the template instead of from `accuracy`.** The accuracy badge currently reads `&lbrace;accuracy.label&rbrace;`, which is correct. If you wrote `&lbrace;bpm - target&rbrace;` inline, the template would compute it on every render and you would have lost the named abstraction.

### TypeScript notes

The verdict object's shape is inferred from the function's return type. If you want to lock it down (so you cannot accidentally typo the class name in one branch and not others):

```ts
type Verdict = { label: string; class: 'perfect' | 'great' | 'ok' | 'off'; diff: number };

let accuracy = $derived<Verdict | null>(/* ... */);
```

The string-literal union catches typos at compile time. Worth doing as the verdict's class options grow.

## Concept 2: The `class:name=&lbrace;cond&rbrace;` directive

### What it is

The most common dynamic-class case in any UI is "add this class when this condition is true." Svelte ships a directive specifically for that: `class:name=&lbrace;cond&rbrace;` adds the class `name` to the element when `cond` is truthy, and removes it when `cond` is falsy. The runtime watches the condition and updates the element's class list in place.

You can write the same thing manually with `class=&lbrace;cond ? 'name' : ''&rbrace;`, and many React-ish developers will. The directive is cleaner for three reasons. First, it composes — you can stack multiple `class:` directives on one element without having to interleave them with ternaries inside a single string. Second, it integrates with a static `class="..."` attribute, so the static classes stay readable. Third, it only changes the targeted class — other classes added by the static attribute or by other `class:` directives are untouched.

Behaviorally it is sugar for `element.classList.toggle(name, !!cond)` run reactively. No magic.

### Worked example

The mode toggle uses it on both buttons:

```svelte
<button class:active={mode === 'detect'} onclick={() => mode = 'detect'}>DETECT</button>
<button class:active={mode === 'guess'}  onclick={() => mode = 'guess'}>GUESS</button>
```

Each button gets the `active` class when its corresponding mode is selected, and loses it when not. The CSS:

```css
.modes button { background: #11131a; color: #9ea3b8; /* ... */ }
.modes button.active { background: #e5468b; color: white; }
```

Two rules, one base and one for the active state. The button transitions smoothly between them.

The same pattern in a list:

<CompileSandbox initialSource={classBindingDemo} height="240px" />

```svelte
{#each fruits as fruit}
  <button class:active={selected === fruit} onclick={() => selected = fruit}>
    {fruit}
  </button>
{/each}
```

Three buttons, one active at a time. The directive evaluates once per iteration; the active button gets the class, the others do not.

### Variation: shorthand for matching names

If the boolean variable's name matches the class name you want, you can drop the right-hand side:

```svelte
<div class:disabled>...</div>
<!-- equivalent to: -->
<div class:disabled={disabled}>...</div>
```

Useful when a component has a `disabled` prop and you want a `disabled` class on the root. Small saving, idiomatic.

### Variation: stacking multiple directives

You can apply several `class:` directives to one element, plus a static `class="..."` attribute, and they all compose:

```svelte
<div
  class="card"
  class:open={isOpen}
  class:loading={isLoading}
  class:error={hasError}
>
  ...
</div>
```

The element always has `card`. It gets `open` when `isOpen`, `loading` when `isLoading`, `error` when `hasError`, independently. Versus writing `class="card &lbrace;isOpen ? 'open' : ''&rbrace; &lbrace;isLoading ? 'loading' : ''&rbrace; &lbrace;hasError ? 'error' : ''&rbrace;"` — which works but is harder to read and easy to mess up the spacing on.

### Variation: interpolating a value into a class string

When the class name itself is a computed value (not a boolean), use plain template interpolation:

```svelte
<div class="accuracy {accuracy.class}">{accuracy.label}</div>
```

The accuracy badge always has the `accuracy` class plus one of `perfect` / `great` / `ok` / `off` depending on the verdict. There is no Svelte directive for "set this class to this string" because the plain interpolation already handles it.

The CSS keys off the second class:

```css
.accuracy.perfect { color: #5cd991; }
.accuracy.great   { color: #b8d958; }
.accuracy.ok      { color: #f0c050; }
.accuracy.off     { color: #ff6464; }
```

Using both classes in the selector (`.accuracy.perfect`) makes the CSS precise — these rules only apply to `.accuracy` elements that ALSO have the per-state class.

### Common mistakes

- **Writing `class:isActive`** when you mean `class:active=&lbrace;isActive&rbrace;`. The class added is the literal string after `class:` — `isActive`, in that case. The shorthand works only when the class name MATCHES the variable name. Fix: be explicit if they differ.
- **Mixing `class:` directives with a class attribute that also sets the same class.** Writing `class="active" class:active=&lbrace;cond&rbrace;` is contradictory. The directive will fight the static attribute. Fix: pick one or the other; usually drop the static.
- **Forgetting that `class:foo` evaluates a boolean.** Writing `class:foo=&lbrace;someString&rbrace;` adds the class when `someString` is truthy (non-empty). That happens to work in many cases but obscures intent — write `class:foo=&lbrace;someString.length > 0&rbrace;` if that is what you mean.
- **Trying to use `class:` with a dynamic class name** like `class:&lbrace;myClass&rbrace;=&lbrace;cond&rbrace;`. Not supported. The class name to the left of `=` must be a literal. Use plain interpolation instead.

### TypeScript notes

The expression on the right of `class:name=` is typed as boolean-ish; anything truthy/falsy works. There is no per-class type validation — if you typo the class name, you get a stale class added to the DOM and the corresponding CSS rule never fires. The Svelte language server warns when a `class:` name has no matching selector in the same component's `<style>`, which catches most typos.

## Concept 3: Verdict objects from $derived

### What it is

When a single piece of UI needs several related values that share input handling — a label, a CSS class, an emoji, a numerical score, whatever — you have two choices. You can write one `$derived` per value, each branching independently on the same inputs. Or you can write one `$derived` that returns an object grouping all the values, branched once.

The grouped-object pattern is usually better. It computes the branches once, keeps the branches synchronized (you cannot have `label = 'PERFECT'` while `class = 'off'`), and reads cleanly in the template (`accuracy.label`, `accuracy.class`). The runtime cost is one allocation per evaluation — negligible. The maintenance cost is much lower than keeping three or four parallel deriveds in sync.

The shape: return an object literal with the named fields. Return `null` (or `undefined`) when the verdict is not yet meaningful. Read in the template as `obj.field`, and guard with `&lbrace;#if obj&rbrace;` so the read is safe.

### Worked example

The accuracy verdict from the guess game:

```svelte
let accuracy = $derived.by(() => {
  if (mode !== 'guess' || bpm === null) return null;
  const diff = Math.abs(bpm - target);
  if (diff <= 1) return { label: 'PERFECT', class: 'perfect', diff };
  if (diff <= 3) return { label: 'GREAT',   class: 'great',   diff };
  if (diff <= 7) return { label: 'OK',      class: 'ok',      diff };
  return            { label: `OFF BY ${diff}`, class: 'off', diff };
});
```

Three fields: `label` for the visible text, `class` for the CSS color, `diff` for any later use (a best-score tracker, a debug display, a sound trigger). The branches are exhaustive; the function always returns a complete object or null.

The template reads all three at once:

```svelte
{#if accuracy}
  <div class="accuracy {accuracy.class}">{accuracy.label} ({accuracy.diff} off)</div>
{/if}
```

The `&lbrace;#if accuracy&rbrace;` guards against null. Inside the block, all property reads are safe. The runtime tracks `accuracy` as a dependency; when `accuracy` changes (because `bpm` changed, because the user tapped), the new object replaces the old in the cache and the template re-reads.

### Variation: deriving an object that gets passed to another component

```svelte
let chartConfig = $derived.by(() => {
  return {
    type: bpm > 140 ? 'fast' : 'slow',
    color: tempo === 'guess' ? '#5cd991' : '#e5468b',
    bars: taps.length,
    bpm
  };
});
```

```svelte
<TempoChart config={chartConfig} />
```

`TempoChart` receives the whole config as one prop. As `taps` or `tempo` change, the config rederives, the prop updates, the chart re-renders with the new values. Cleaner than passing four separate props that all change together.

### Variation: when one derived per field is correct

If the fields have genuinely independent inputs, separate them:

```svelte
// These have nothing to do with each other; one derived each.
let isLoading = $derived(state.status === 'loading');
let canSubmit = $derived(form.dirty && form.valid);
let totalCost = $derived(items.reduce((s, i) => s + i.price, 0));
```

Wrapping these into one mega-object would obscure intent. The rule of thumb: group values that share input handling, separate values that have distinct inputs.

### Variation: extending the verdict

Suppose you want to add an emoji to each accuracy band:

```svelte
let accuracy = $derived.by(() => {
  if (mode !== 'guess' || bpm === null) return null;
  const diff = Math.abs(bpm - target);
  if (diff <= 1) return { label: 'PERFECT', class: 'perfect', emoji: '🎯', diff };
  if (diff <= 3) return { label: 'GREAT',   class: 'great',   emoji: '👍', diff };
  if (diff <= 7) return { label: 'OK',      class: 'ok',      emoji: '🤔', diff };
  return            { label: `OFF BY ${diff}`, class: 'off', emoji: '💀', diff };
});
```

One field added in one place. No template changes (until you decide to render the emoji). No second derived to keep in sync. The verdict-object pattern absorbs growth gracefully.

The grouped-object pattern in a more general example:

<CompileSandbox initialSource={verdictObjectDemo} height="280px" />

The `verdict` derived returns `&lbrace; grade, tone, message &rbrace;`. The template uses all three: `&lbrace;verdict.grade&rbrace;` for the big letter, `&lbrace;verdict.tone&rbrace;` interpolated into a class, `&lbrace;verdict.message&rbrace;` for the descriptive text. Slide the range; all three update in lockstep.

### Common mistakes

- **Forgetting to guard with `&lbrace;#if obj&rbrace;`.** Reading `obj.field` when `obj` is null throws. Symptom: TypeError in the template. Fix: `&lbrace;#if accuracy&rbrace; ... &lbrace;/if&rbrace;` wrap.
- **Mutating the verdict object outside the derived.** It will not work — the next read recomputes and replaces the object. Symptom: changes vanish on next dep change. Fix: derive the new value from inputs; do not mutate derived results.
- **Returning differently shaped objects in different branches.** Symptom: `accuracy.diff` is sometimes a number and sometimes undefined; consumers crash. Fix: every branch should return the same shape. If a field is sometimes absent, return null for it explicitly.
- **Computing the same thing in the derived and in the template.** If you write `&lbrace;accuracy.label&rbrace; (&lbrace;Math.abs(bpm - target)&rbrace; off)`, you have computed the diff twice. Move the diff into the verdict object so the template just reads it.

### TypeScript notes

The verdict object's type is inferred. To be explicit and lock down the union of possible shapes:

```ts
type Verdict =
  | { label: string; class: 'perfect' | 'great' | 'ok' | 'off'; diff: number }
  | null;

let accuracy = $derived<Verdict>(/* ... */);
```

When all branches return the same shape, the inferred type is correct without annotation. When branches diverge (rare for this pattern), the annotation forces them into a union.

## Putting it together

The whole guess-mode component:

<CompileSandbox initialSource={guessSource} height="700px" />

Two modes via the toggle. DETECT works exactly as before. GUESS shows a target BPM and an accuracy verdict. "New target" rolls a fresh tempo. Tap along; watch the color shift from red to yellow to green as you home in.

The script in full:

```svelte
<script>
  let mode = $state('detect');
  let target = $state(120);
  let taps = $state([]);

  let bpm = $derived.by(() => {
    if (taps.length < 2) return null;
    const recent = taps.slice(-8);
    let total = 0;
    for (let i = 1; i < recent.length; i++) total += recent[i] - recent[i - 1];
    return Math.round(60000 / (total / (recent.length - 1)));
  });

  let accuracy = $derived.by(() => {
    if (mode !== 'guess' || bpm === null) return null;
    const diff = Math.abs(bpm - target);
    if (diff <= 1) return { label: 'PERFECT', class: 'perfect', diff };
    if (diff <= 3) return { label: 'GREAT',   class: 'great',   diff };
    if (diff <= 7) return { label: 'OK',      class: 'ok',      diff };
    return            { label: `OFF BY ${diff}`, class: 'off', diff };
  });

  function handleTap()  { taps.push(Date.now()); }
  function reset()      { taps = []; }
  function newTarget()  { target = 60 + Math.floor(Math.random() * 120); taps = []; }
</script>
```

Three pieces of state, two deriveds, three functions. The dependency graph: `taps -> bpm -> accuracy`, plus `mode` and `target` flowing into `accuracy`. Every UI update is the consequence of one of these writes propagating through that graph.

## Module recap: what you shipped

Across this module you built a complete small app, one lesson at a time:

- **Lesson 1** — set up the basic component skeleton, added a button that records a timestamp on every click.
- **Lesson 2** — moved from a single timestamp to a `$state` array of taps, with a reset button that clears the array. Saw how proxy-backed arrays let you push without losing reactivity.
- **Lesson 3** — derived the BPM from the interval averages with `$derived` and `$derived.by`. Saw how the runtime tracks the dependency graph without any annotations.
- **Lesson 4** — persisted the latest BPM to localStorage with `$effect`. Learned the read-all-deps-up-front pattern and the test for when `$effect` is the wrong tool. Guarded the browser-only code with `browser` from `$app/environment`.
- **Lesson 5** — added GUESS mode. Composed state, deriveds, class bindings, and a verdict object into a complete game feature without changing any of the detector code.

The final app is about 100 lines of code. It detects tempo, remembers the last reading across reloads, lets you switch into a guess-the-tempo game with color-coded feedback. You would not be ashamed to bookmark it.

You used: `$state` (in many forms, including arrays), `$derived` (with both syntactic forms, including derived objects), `$effect` (for the localStorage write, with cleanup discipline), the `class:active` directive, interpolated class strings, `&lbrace;#if&rbrace;` for conditional rendering, event handlers (`onclick=&lbrace;handler&rbrace;`), the `disabled=&lbrace;...&rbrace;` boolean attribute pattern, scoped CSS, the `browser` constant for SSR safety. Most of what you will reach for day-to-day in Svelte is now in your hands.

<OpenTheHood title="Why composition is the whole game">

If you have followed along, you have noticed something: there is no special "framework knowledge" that makes GUESS mode work. It is the same `$state`, `$derived`, `&lbrace;#if&rbrace;` you already knew. The new feature is built by composing primitives you already had.

This is the test of a good framework. Every new feature should not require learning new framework features. The primitives should compose, and most of the work should live in the domain (BPM detection, accuracy comparison) rather than in fighting the framework.

Svelte's surface area is small enough that you have now seen most of what you will use day-to-day. The remaining modules add: components and props (M3), snippets and bindings (M3-M4), `.svelte.ts` modules for shared state (M4), the SvelteKit application framework (M5), and the audio APIs (M3 onward). After those, you have seen everything except the very-edge-case escape hatches like `untrack`, `flushSync`, `$effect.root`, custom elements, and actions.

The thing that takes the longest to learn is not syntax — it is the taste for which primitive to reach for. Whether something should be a `$derived` or a function. Whether to extract a component or inline. Whether to use shared state or props. Whether an effect is justified or whether you have just been infected by React habits. That taste comes from building, not from reading. The next six modules give you a lot of building.

</OpenTheHood>

## Exercises

### Exercise 1: Wire it into your project

**Setup:** the SvelteKit project with the persisted detector from the previous lesson.

**What to do:** add the GUESS mode code: the `mode` and `target` states, the `accuracy` derived, the `newTarget` function, and the template additions (mode toggle, target display, accuracy badge).

**Verify by:** clicking GUESS shows the target. Tapping to that tempo eventually produces a PERFECT or GREAT verdict in green. Clicking DETECT hides the target and accuracy display; the detector works as before.

**Stretch:** make the accuracy bands user-configurable via three input fields (perfect threshold, great threshold, ok threshold). Use three new `$state` declarations and read them inside the `accuracy` derived. Verify that loosening the thresholds makes PERFECT easier to hit.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let perfectThreshold = $state(1);
  let greatThreshold = $state(3);
  let okThreshold = $state(7);

  let accuracy = $derived.by(() => {
    if (mode !== 'guess' || bpm === null) return null;
    const diff = Math.abs(bpm - target);
    if (diff <= perfectThreshold) return { label: 'PERFECT', class: 'perfect', diff };
    if (diff <= greatThreshold)   return { label: 'GREAT',   class: 'great',   diff };
    if (diff <= okThreshold)      return { label: 'OK',      class: 'ok',      diff };
    return                          { label: `OFF BY ${diff}`, class: 'off', diff };
  });
</script>

<label>perfect ≤ <input type="number" bind:value={perfectThreshold} /></label>
<label>great ≤ <input type="number" bind:value={greatThreshold} /></label>
<label>ok ≤ <input type="number" bind:value={okThreshold} /></label>
```

The `accuracy` derived now depends on six values; the runtime tracks all of them automatically.

</details>

### Exercise 2: Add a best-score tracker

**Setup:** the working GUESS mode.

**What to do:** track the user's best score (the lowest `diff`) per target. Display it under the target as "best so far: ±N." Reset the best when a new target is rolled.

**Verify by:** the best updates only when you do better than the previous best. New target clears it. Reading the best from the template is one binding.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let bestDiff = $state(null);

  $effect(() => {
    const a = accuracy;
    if (a === null) return;
    if (bestDiff === null || a.diff < bestDiff) bestDiff = a.diff;
  });

  function newTarget() {
    target = 60 + Math.floor(Math.random() * 120);
    taps = [];
    bestDiff = null;
  }
</script>

{#if mode === 'guess' && bestDiff !== null}
  <div class="best">best so far: ±{bestDiff}</div>
{/if}
```

The `$effect` watches `accuracy` and updates `bestDiff` only when it improves. The dependency on `bestDiff` for the comparison creates a self-read; this is fine because the conditional gates the write so the effect does not loop. Note the read-up-front pattern (`const a = accuracy`) for safety.

</details>

### Exercise 3: Toggle classes from a derived

**Setup:** the working GUESS mode.

**What to do:** add a `class:close` directive to the BPM display that highlights it when the user is within 5 BPM of the target (in guess mode only). Style `.close` with a glow effect.

**Verify by:** the display gains the glow as you tap close to the target, loses it when you drift. Switching to DETECT removes the glow regardless of BPM.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let isClose = $derived(
    mode === 'guess' && bpm !== null && Math.abs(bpm - target) <= 5
  );
</script>

<div class="bpm-display" class:close={isClose}>
  <!-- ... -->
</div>

<style>
  .bpm-display.close { box-shadow: 0 0 24px #5cd991; }
</style>
```

The `isClose` derived is a clean boolean. The `class:close=&lbrace;isClose&rbrace;` directive toggles the class. The CSS rule scopes the glow to the close state.

</details>

### Exercise 4: Refactor the verdict object to include the message and emoji

**Setup:** the working GUESS mode.

**What to do:** extend the `accuracy` verdict object with two more fields: `emoji` (an emoji per band) and `message` (a short phrase per band, like "spot on!" / "very close" / "close enough" / "way off"). Display all four fields in the accuracy area.

**Verify by:** every band has its own emoji and message. Switching bands updates all four fields atomically (you never see the PERFECT label with the GREAT emoji).

<details>
<summary>Show solution</summary>

```svelte
let accuracy = $derived.by(() => {
  if (mode !== 'guess' || bpm === null) return null;
  const diff = Math.abs(bpm - target);
  if (diff <= 1) return { label: 'PERFECT', class: 'perfect', emoji: '🎯', message: 'spot on!',     diff };
  if (diff <= 3) return { label: 'GREAT',   class: 'great',   emoji: '👍', message: 'very close',   diff };
  if (diff <= 7) return { label: 'OK',      class: 'ok',      emoji: '🤔', message: 'close enough', diff };
  return            { label: `OFF BY ${diff}`, class: 'off',  emoji: '💀', message: 'way off',      diff };
});
```

```svelte
{#if accuracy}
  <div class="accuracy {accuracy.class}">
    <span class="emoji">{accuracy.emoji}</span>
    <span class="label">{accuracy.label}</span>
    <span class="message">{accuracy.message}</span>
  </div>
{/if}
```

One derived, four fields, atomic updates. The verdict-object pattern scales gracefully.

</details>

### Exercise 5 (stretch): Persist the best score across reloads

**Setup:** the working GUESS mode with the best-score tracker from Exercise 2 and the localStorage persistence from Lesson 4.

**What to do:** save the best-ever score (across all sessions and all targets) to localStorage. Display it as "all-time best: ±N" below the per-target best. It should only update when the user does better than the all-time best.

**Verify by:** play a session, get a best of ±2. Refresh. Play again. The all-time best should still be ±2 until you beat it. Beating it persists. Closing the tab and reopening shows the persisted all-time best.

<details>
<summary>Show solution</summary>

```svelte
<script>
  import { browser } from '$app/environment';

  let allTimeBest = $state(
    browser ? Number(localStorage.getItem('tapTempo_allTimeBest')) || null : null
  );

  $effect(() => {
    const a = accuracy;
    if (a === null || !browser) return;
    if (allTimeBest === null || a.diff < allTimeBest) {
      allTimeBest = a.diff;
      localStorage.setItem('tapTempo_allTimeBest', String(a.diff));
    }
  });
</script>

{#if mode === 'guess' && allTimeBest !== null}
  <div class="all-time-best">all-time best: ±{allTimeBest}</div>
{/if}
```

This combines everything from the module: derived dependency chain (`taps -> bpm -> accuracy`), effect with the read-up-front pattern, `browser` guard for SSR safety, localStorage persistence, and conditional rendering. Five lessons worth of patterns in one feature.

</details>

## Checkpoint

By the end of this lesson and this module, your project should have:

- `src/routes/+page.svelte` containing the full guess-mode component (mode toggle, target, accuracy verdict, persisted BPM).
- The four lessons' worth of features composed into one working app.

### Verify it works

- DETECT mode shows the BPM as you tap.
- GUESS mode shows a random target and an accuracy verdict.
- The verdict color matches the band (green / yellow-green / yellow / red).
- "New target" rolls a fresh target and clears the taps.
- The "last: X BPM" prompt from Lesson 4 still appears in DETECT mode after a reload.
- Resetting works in both modes.

You can point to the lines in your code that implement: a class directive, a string-interpolated class, a verdict object, a derived chain, a side effect with cleanup, an SSR-safe browser check.

## Common questions

**Q: Why did the accuracy derived not need a `$state` for the `diff`?**
A: Because `diff` is a function of `bpm` and `target`. Anything that is a function of other reactive values belongs in a `$derived` (here, computed inside the verdict object), not in its own `$state`. The rule from Lesson 3: state for inputs, derived for outputs.

**Q: Could I have used `class=&lbrace;cond ? 'active' : ''&rbrace;` instead of `class:active`?**
A: Yes; it produces the same DOM. The directive is preferred because it composes with other directives and a static `class` attribute without you having to interleave strings. As the number of dynamic classes on one element grows, the directive saves real complexity.

**Q: Why does `mode` switching not require an effect to "reset" things?**
A: Because the dependent values (`accuracy`, the conditional `&lbrace;#if mode === 'guess'&rbrace;` block) are derived/computed from `mode`. Writing `mode = 'detect'` propagates automatically — `accuracy` re-evaluates to null, the conditional block unmounts. No effect needed because there is no side effect: the UI is a pure function of state.

**Q: When should I extract this into separate components?**
A: When the script gets hard to navigate, when the same UI element appears in multiple places, or when you want to give a piece of UI a name. For this app, the whole thing comfortably fits in one component; M3 introduces component decomposition with a metronome that genuinely benefits from being split.

**Q: Is `&lbrace; label, class, diff &rbrace;` actually faster than three separate deriveds?**
A: Marginally cheaper — one object allocation per evaluation instead of three derived cache slots — but the real win is correctness and readability. The cost difference is invisible at human-perceptible scales. The maintenance difference is enormous.

## What's next

Module 3 starts a new small app: a metronome. It introduces components and props (you will build a `BeatDot` component used four times by a parent), snippets (Svelte 5's better answer to slots), transitions and animations, and your first taste of audio with Tone.js. The composition skills from this module carry forward — you will keep using `$state`, `$derived`, `$effect`, and the verdict-object pattern — and the new lessons add the framework features for splitting an app into reusable pieces.

<SourcesSection lessonKey="02-tap-tempo-detective/05-guess-mode" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
