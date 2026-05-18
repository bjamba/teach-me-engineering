<script>
  import OpenTheHood from '$lib/components/OpenTheHood.svelte';
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Spring Physics and Scoped Styles · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-3);">

<LessonHeader
  moduleSlug="03-metronome-studio"
  lessonSlug="05-spring-and-style"
  title="Spring Physics and Scoped Styles"
  blurb="A click indicator with spring motion. Scoped CSS properly explained. CSS custom properties for theming via the cascade."
/>

## Why this lesson exists

The metronome's click indicator after lesson 4 works fine, but it feels mechanical. Each click triggers a CSS keyframe that scales the dot up then fades it out on a fixed timeline. There's no momentum, no overshoot, no sense that the dot is a physical thing being hit. Musicians don't notice this consciously, but they notice the absence of it — the indicator feels like a flashing pixel instead of a struck drum.

A spring-physics indicator fixes that. Set a target value, let physics interpolate toward it, and the motion has weight. The dot pulses with momentum, settles back. Five lines of code, completely different feel. This lesson does that swap and uses it as an excuse to dig into two things you've been writing the whole module without really understanding: scoped CSS, and CSS custom properties for theming.

Both are framework-level concepts you'll lean on every day. Scoped CSS is what makes Svelte's component model practical at scale — without it you'd be writing BEM or Tailwind to avoid global-cascade chaos. Custom properties are what make theming a Svelte component tree clean — you set a variable on a parent, descendants pick it up, no prop drilling. This lesson explains the mechanics of both so the rest of your Svelte career stops being "I just trust that this works."

## Learning objectives

By the end of this lesson you'll be able to:

- Use `Spring` from `svelte/motion` to create a value that interpolates toward a target with damped harmonic motion.
- Tune a spring's `stiffness` and `damping` parameters and predict how the motion will change.
- Choose between `Spring` and `Tween` based on whether you want physics-driven or curve-driven animation.
- Explain how Svelte's compiler scopes a component's `<style>` block by generating a unique class hash and rewriting selectors.
- Use `:global(...)` to opt a specific selector out of scoping, and recognize when you actually need it.
- Use CSS custom properties on a parent element to theme child components via the cascade, without passing color props down the tree.
- Read the metronome's color system and understand how `--c-track` propagates from the lesson `<article>` down into individual components.

## Concept 1: Spring physics, mechanically

### What a spring is

A "spring" in animation is shorthand for a damped harmonic oscillator — the same math that describes a weight on a real spring. You give it a target, and it accelerates toward that target proportional to how far away it is, with a damping force proportional to how fast it's moving. The result is motion that overshoots a bit (if damping is low) or settles smoothly (if damping is high), and that takes longer for bigger distances than smaller ones. Like real physics.

The equation, if you want it, is `a = -k * x - c * v`. `x` is the displacement from target. `v` is the current velocity. `k` is the spring constant (stiffness). `c` is the damping coefficient. The animation library integrates this each frame: compute acceleration, update velocity, update position, render.

You don't need to know the math to use the API. But knowing it's physics — not a fixed timeline — is what tells you when to reach for a spring instead of a Tween. Spring motion is contextual: a small change settles fast, a big change takes longer, the user gets visual feedback that the size of the change is being respected. Tween motion is exact: 600ms is always 600ms, regardless of how far the value moved.

### The Svelte API

`svelte/motion` exports `Spring` and `Tween`. Both are classes you instantiate. Both expose a `current` property (the live interpolated value) and a `target` property (the value being interpolated toward). Reading `current` in a reactive context (a binding, a `$derived`, an effect) tracks it as a dependency, so the binding updates as the value evolves over time — automatically, frame by frame, until the spring settles.

```svelte
<script>
  import { Spring } from 'svelte/motion';

  const intensity = new Spring(0, { stiffness: 0.18, damping: 0.4 });

  function pulse() {
    intensity.target = 1;
    setTimeout(() => intensity.target = 0, 80);
  }
</script>

<button onclick={pulse}>pulse</button>
<div style="transform: scale({1 + intensity.current * 0.3})">o</div>
```

`new Spring(0, ...)` creates a spring at value 0. Click the button: `intensity.target = 1` tells the spring "go to 1." It starts interpolating. The `<div>`'s transform reads `intensity.current` and updates every frame. After 80ms, `intensity.target = 0` tells it to go back. The spring overshoots, comes back, settles.

### Parameters in detail

`stiffness` is a number between 0 and 1. It's the proportion of the gap to target that's converted to force each frame. Higher stiffness = the spring pulls harder = the value gets to target faster. `0.05` is floppy; `0.5` is snappy; `1.0` is essentially instant.

`damping` is also between 0 and 1. It's the fraction of velocity that's bled off each frame. Higher damping = less overshoot = smoother settle. `0.1` will bounce around forever; `0.9` won't overshoot at all; `0.4` overshoots a bit and settles in a few hundred ms. There's no "critically damped" line where overshoot stops — it depends on stiffness too — but `damping >= sqrt(stiffness) * 2` is roughly the boundary.

The pairing matters. `{ stiffness: 0.4, damping: 0.4 }` is snappy with some overshoot. `{ stiffness: 0.05, damping: 0.9 }` is slow and smooth. `{ stiffness: 0.18, damping: 0.4 }` (the metronome's choice) is in between — fast enough to keep up with sixteenth notes at 200 BPM, springy enough to feel alive.

There's also an optional `precision` parameter that controls when the spring is considered "settled" and the animation loop can stop. The default is fine for most cases. Lower it if a spring is still visibly moving when it's supposed to be at rest.

### Worked example: the pulse spring

In the metronome, we want the indicator to flash up and back on every click. The cleanest model: an "intensity" value that's normally 0, briefly goes to 1 on each pulse, springs back. The CSS reads intensity and scales / glows / fades the dot accordingly.

```js
import { Spring } from 'svelte/motion';

const intensity = new Spring(0, { stiffness: 0.18, damping: 0.4 });

$effect(() => {
  const _ = pulse;          // track dependency on the pulse counter
  intensity.target = 1;
  setTimeout(() => intensity.target = 0, 80);
});
```

The `const _ = pulse` is the same unconditional-read pattern from lesson 2. Reading `pulse` first ensures the effect tracks it, so the effect re-fires every time `pulse` increments. Without this, the spring would only animate once.

The 80ms `setTimeout` is the "release" — it tells the spring to head back to 0 a little after the attack. Without it, the spring goes to 1 and stays there. The combination of "jump to 1, then drop to 0" is what gives the dot a hit-feel.

You could also use `intensity.set(1, { hard: true })` to snap immediately to 1 with no interpolation, then `intensity.target = 0` to spring back down. That gives a slightly different feel — a sharp on, a slow off. Either works.

### Variations

- **Object-valued springs.** A spring's value doesn't have to be a scalar. `new Spring({ x: 0, y: 0 })` interpolates an object. Each property springs independently. Useful for 2D positions, RGB colors.
- **Springs as `$derived` sources.** You can read a spring's current in a `$derived` and chain interpolations. Useful for, say, a position that follows a spring-followed mouse.
- **Multiple springs on the same value.** Two springs interpolating the same DOM property at once is fine — just compose them in CSS via custom properties.

### Common mistakes with Spring

- **Forgetting to track the trigger.** `$effect(() => &lbrace; intensity.target = 1 &rbrace;)` with nothing else in the effect runs once and never re-fires. You have to read the reactive value (`pulse`) that's supposed to trigger the spring.
- **Reading `target` instead of `current`.** `intensity.target` is just the destination — it changes instantly when you set it. The interpolated live value is `intensity.current`. Bindings that use `target` won't animate.
- **Setting `current` directly.** It's read-only. Use `target` to set a destination, or `set(value, &lbrace; hard: true &rbrace;)` to snap.
- **Using a spring for one-shot CSS animations.** If you want a fixed-duration intro animation, use a CSS keyframe or a Tween. Springs are for things that should respond to context, not for choreographed timelines.

### TS notes

The Spring class is generic over its value type. For a number: `new Spring<number>(0)`. For an object: `new Spring<&lbrace; x: number; y: number &rbrace;>(&lbrace; x: 0, y: 0 &rbrace;)`. TypeScript usually infers from the initial value, so explicit annotation is rare.

```ts
import { Spring } from 'svelte/motion';

const pos: Spring<{ x: number; y: number }> = new Spring(
  { x: 0, y: 0 },
  { stiffness: 0.2, damping: 0.5 }
);
```

## Concept 2: Spring vs Tween

### What Tween is

`Tween` is the other interpolator in `svelte/motion`. Same API shape: `new Tween(initial, options)`, set `target`, read `current`. The difference is what's between them: a fixed-duration easing curve instead of physics.

```js
import { Tween } from 'svelte/motion';
import { cubicOut } from 'svelte/easing';

const progress = new Tween(0, { duration: 600, easing: cubicOut });

progress.target = 100;    // animates 0 -> 100 over 600ms, cubic-out
```

The motion is exactly 600ms long, regardless of whether you went from 0 to 100 or from 99 to 100. That predictability is the point.

### When each is right

The rule of thumb I use:

- **Tween for fixed choreography.** Loading bars, page transitions, intro animations, anything where the timing is part of the design. If a UX designer hands you "the panel slides in over 400ms with ease-out-cubic," that's a Tween.
- **Spring for responsive interaction.** Drag-and-drop, hover effects, click feedback, mouse-following indicators. Anything where the user is poking at the UI and you want the motion to feel like a real object reacting.

For the metronome's indicator: spring. A click feels like a hit. A hit has momentum, decay, overshoot. A 200ms fixed Tween would feel sterile.

### What about CSS transitions?

CSS transitions and CSS keyframes can do a lot of this. The original ClickIndicator (lesson 3) used a `@keyframes flash` animation re-triggered by `&lbrace;#key pulse&rbrace;`. That worked. The reason to move to a JS-driven spring is that CSS keyframes are fixed-timeline — they look mechanical, and they can't easily respond to context (e.g., "the bigger the bpm change, the more overshoot").

A spring is a JS value driving CSS via a custom property. The animation curve is computed in JS each frame, the CSS just reads it. You give up a tiny bit of performance (the browser can't pre-compose the animation onto the GPU as efficiently) for a lot of expressiveness.

For something happening 4-16 times per second at a metronome's tempo, the performance hit is invisible. For a 1000-item list animating simultaneously, you'd want CSS transitions.

### Common mistakes choosing

- **Using Tween where a CSS transition would do.** If a CSS `transition: transform 200ms` covers it, that's simpler and faster. Reach for Tween when you need JS control over the value during interpolation (e.g., to derive other values from it).
- **Using Spring for one-shot animations.** Springs don't have a fixed end; they settle when they're close enough. For an intro animation that should be exactly 600ms long, use Tween.
- **Mixing types.** Don't have a Spring AND a Tween updating the same property — they'll fight. Pick one source per property.

## Concept 3: Driving CSS via custom properties

### What a custom property is

A CSS custom property (also called a "CSS variable") is a `--prefixed` property that you can read with `var(--name)`. Unlike preprocessor variables (Sass `$variables`), they live in the cascade — they have a value at every node in the DOM tree, they can be overridden per element, and you can change them at runtime.

```css
.parent { --c-base: #4a8fe7; }
.child  { background: var(--c-base); }     /* picks up #4a8fe7 from parent */

.parent.alternate { --c-base: orange; }    /* descendants see orange */
```

This is the cascade in action: `--c-base` is set on `.parent`, and any descendant that references `var(--c-base)` gets that value. Override `--c-base` on a different parent and that subtree sees the override. No JavaScript involved.

### Driving JS-controlled values into CSS

The spring example uses a custom property as the bridge between a JS-controlled value and the CSS that uses it:

```svelte
<div
  class="indicator"
  style="--i: {intensity.current}"
></div>

<style>
  .indicator {
    --i: 0;
    transform: scale(calc(1 + var(--i) * 0.3));
    box-shadow: 0 0 calc(var(--i) * 32px + 4px) currentColor;
    opacity: calc(0.5 + var(--i) * 0.5);
  }
</style>
```

`--i` is the spring's current value, set via the inline `style` attribute. The CSS uses `--i` inside `calc()` expressions to compute the actual transform, shadow, opacity. As `intensity.current` updates each frame, `--i` updates, and the browser recomputes the styles.

The alternative is to write JavaScript like `el.style.transform = ...; el.style.boxShadow = ...; el.style.opacity = ...` for every animated property. That works but it's more code, harder to read, and forces you to do the math in JS instead of CSS. With a custom property, the JS provides ONE number; the CSS knows how to turn that number into a visual treatment.

This pattern scales nicely. If you decide to add a `filter: blur(calc(var(--i) * 4px))` later, you don't change the JS at all — just add a CSS line. The JS-CSS contract is "the JS provides a normalized intensity; the CSS decides what to do with it."

### Theming via the cascade

The bigger win for custom properties is theming. Set a color variable on a wrapper, every descendant component picks it up. No prop drilling, no theme context, no provider component.

```svelte
<div style="--c-base: #4a8fe7">
  <ClickIndicator pulse={pulse} />
</div>

<div style="--c-base: orange">
  <ClickIndicator pulse={pulse} />
</div>
```

Two ClickIndicators on the same page, two different colors, without any new props on the component. The component just uses `var(--c-base, defaultColor)` internally. The parent owns the theming decision; the component owns the structure.

This is how the curriculum site you're reading does its per-module color theming. Look at the top of every lesson page:

```svelte
<article class="lesson prose" style="--c-track: var(--c-track-3);">
```

The `--c-track` variable is set on the article. Every component below it (badges, links, code blocks, heading underlines) reads `var(--c-track)` and gets the right color for the module. Module 1 lessons set `--c-track-1`; module 3 sets `--c-track-3`. The components don't know which module they're in. They just read the variable.

### Variations

- **Per-instance overrides.** `<ClickIndicator style="--c-base: red" />` works if the parent wants to theme one instance. Inline `style` is just CSS.
- **Conditional themes.** Toggle a class on a parent that resets variables: `.dark &lbrace; --c-base: #1a1a1a; --c-text: #fff &rbrace;`. Light/dark mode is often done this way.
- **Variable fallbacks.** `var(--c-base, #4a8fe7)` is "use `--c-base` if defined; otherwise `#4a8fe7`." Always provide a fallback so the component renders sensibly even without theming.

### Common mistakes with custom properties

- **Defining a property on the component's root and expecting parents to read it.** The cascade goes DOWN, not up. Define on parents; read in children.
- **Forgetting the `--` prefix.** `var(c-base)` doesn't work. CSS variables must start with `--`.
- **Not providing a fallback.** `var(--c-base)` returns "unset" (treated as the initial value of the property) if `--c-base` isn't defined. Components break silently. Always: `var(--c-base, #4a8fe7)`.
- **Animating a custom property without `@property`.** CSS variables aren't typed by default — the browser treats them as strings. To animate `--i` with a CSS `transition`, you need `@property --i &lbrace; syntax: '&lt;number&gt;'; ... &rbrace;`. (For our spring case we don't need this because the JS is updating the value each frame.)

## Concept 4: Scoped CSS, mechanically

### What "scoped" actually means

Every `<style>` block in a `.svelte` component is scoped by default. You write `button &lbrace; color: red &rbrace;` and it only affects buttons rendered by that component. Buttons in other components stay unaffected. You've been relying on this since lesson 1 of module 1; this concept explains how it actually works.

The Svelte compiler does two things when it sees a `<style>` block:

1. **Generates a unique hash for the component.** Looks like `s-AbCd1234`. The hash is stable across builds for the same component file, but unique across components.
2. **Rewrites every selector AND every element.** Each selector becomes `selector.s-AbCd1234`, and each rendered element gets the `s-AbCd1234` class added.

So your source:

```svelte
<button>click</button>
<style>
  button { color: red; }
</style>
```

becomes, in the compiled output, roughly:

```html
<button class="s-AbCd1234">click</button>
<style>
  button.s-AbCd1234 { color: red; }
</style>
```

The selector now requires both `button` AND the hash class. Only elements rendered by THIS component get the hash class, so only those buttons match.

### Why class-based, not shadow DOM?

There are other ways to scope CSS — Shadow DOM, CSS Modules' generated class names, BEM conventions, CSS-in-JS. Svelte's choice is generated classes for a few practical reasons:

- **Shadow DOM** isolates too aggressively. You can't easily style children of a shadow-DOM component from the outside. Theming becomes painful.
- **CSS Modules** require importing the generated class names from JS. Svelte wanted the developer-facing syntax to be plain CSS.
- **BEM** depends on developer discipline. Svelte wanted scoping to be automatic.

The class-based approach is a middle ground: automatic, doesn't isolate too much, doesn't require new syntax. Selector specificity goes up slightly (one extra class), which can occasionally surprise you when fighting `!important` rules, but in practice it's invisible.

### `:global(...)` for opting out

When you DO want a selector to apply globally — a typography reset, a body background, a class on an element you don't render but a third-party library does — wrap it in `:global(...)`:

```css
:global(body) { margin: 0; }
:global(.prose code) { background: #f0f0f0; padding: 2px 4px; }
.container :global(.third-party-class) { color: blue; }
```

The third example is the most useful: the `.container` part IS scoped (so it only matches containers this component renders), but inside the container, the `:global(.third-party-class)` matches any element with that class — including ones rendered by libraries or child components that don't know about scoping.

For the metronome, you don't need any `:global()` rules. Every style is component-internal.

### Why some rules silently don't apply

Svelte's compiler tries to be smart about unused CSS. If your `<style>` has a rule for `.foo` but your component's markup never produces a `.foo` element, the compiler warns ("Unused CSS selector") and may drop the rule from the compiled output.

This is usually correct behavior, but it can bite you if you're trying to style a child-component-rendered element from the parent. The parent doesn't render that element, so the rule looks unused, so it gets dropped or warned about. The fix is `:global()` on the descendant part.

```css
/* doesn't work - .child-thing isn't rendered by this component */
.wrapper .child-thing { color: red; }

/* works - :global() tells the compiler "trust me, this matches in subtrees" */
.wrapper :global(.child-thing) { color: red; }
```

### Specificity quirks

Adding the scope class to every selector increases specificity by one class. Usually invisible. But:

- **A global `body &lbrace; margin: 0 &rbrace;` rule loses to a scoped `body &lbrace; margin: 8px &rbrace;` rule** (the scoped one has one more class). This is rarely a problem because scoped selectors that match `body` are rare.
- **`!important` overrides work as expected**, but a scoped `!important` can beat a global `!important` because of the extra class. Fight-with-fire CSS gets weird; try to avoid it.

The browser dev tools' "Computed" panel shows what actually applied, with the full selector chain. When confused about why a rule didn't take effect, look there.

### Common mistakes with scoped styles

- **"My CSS isn't applying!" when targeting a child component's element.** The selector matches an element the parent doesn't render directly. Use `:global()` on the descendant part.
- **Trying to style by CSS variable from outside without setting it on a parent.** Custom properties cascade; if you set `--c-base` on `<ChildComponent>` itself, the variable is set on the component's wrapper, which works — but if you set it on a sibling, it won't reach the child.
- **Putting `<style>` inside a conditional `&lbrace;#if&rbrace;`.** Doesn't work; `<style>` is processed at compile time, not render time. Toggle a class instead and let CSS handle the conditional.
- **Forgetting that `:global()` selectors persist forever.** A `:global(body) &lbrace; background: #f0f0f0 &rbrace;` in any one component sets the global body background. If the component unmounts, the rule stays (it was compiled into the stylesheet, not added/removed dynamically). For genuinely transient global rules, use JS to add and remove a class on `document.body`.

### TS notes

There's nothing to type about CSS itself, but if you're driving custom properties from JS and want type safety, you can:

```ts
type ThemeVars = '--c-base' | '--c-accent' | '--c-bg';
function setTheme(vars: Record<ThemeVars, string>, el: HTMLElement) {
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
}
```

Manual but readable. There's no built-in way to type CSS custom properties; Svelte's compiler doesn't introspect your `<style>` to find them.

## Concept 5: Putting it all together in the indicator

### The updated component

Replace `src/lib/components/ClickIndicator.svelte` with:

```svelte
<script>
  import { Spring } from 'svelte/motion';

  let { pulse = 0, accent = false } = $props();

  const intensity = new Spring(0, { stiffness: 0.18, damping: 0.4 });

  $effect(() => {
    const _ = pulse;
    intensity.target = 1;
    setTimeout(() => intensity.target = 0, 80);
  });
</script>

<div
  class="indicator"
  class:accent
  style="--i: {intensity.current}"
></div>

<style>
  .indicator {
    --i: 0;
    --c-base: #4a8fe7;
    width: 60px; height: 60px; border-radius: 50%;
    background: var(--c-base);
    margin: 0 auto;
    transform: scale(calc(1 + var(--i) * 0.3));
    box-shadow: 0 0 calc(var(--i) * 32px + 4px) var(--c-base);
    opacity: calc(0.5 + var(--i) * 0.5);
    transition: background-color 200ms, box-shadow 200ms;
  }
  .indicator.accent {
    --c-base: #f0c050;
  }
</style>
```

What changed from the lesson 3 version:

- **No more `&lbrace;#key pulse&rbrace;` re-mount.** The spring handles the animation now; we don't need to thrash the DOM.
- **No more `@keyframes`.** The spring drives `--i`, and CSS `calc()` computes the visual properties.
- **Color via custom property.** `--c-base` is the dot's color, with a default. The `.accent` class overrides it. A parent could also override it from outside without touching the component.
- **`transition` on `background-color`.** When `--c-base` changes (accent toggling), the background smoothly transitions instead of jumping. Cheap polish.

### How the parent uses it

The parent doesn't change. Same `<ClickIndicator pulse={pulse} accent={...} />` as in lessons 3 and 4. The spring is an internal implementation detail.

### Putting it together with the page

The full metronome page from lesson 4 still works without modification. The whole module is:

```svelte
<div class="metronome">
  <ClickIndicator pulse={pulse} accent={beat % subdivision.ticksPerBeat === 1} />
  <BpmDial bind:bpm />
  <SubdivisionPicker options={SUBDIVISIONS} bind:value={subdivision} />
  <TransportButton playing={isPlaying} onstart={start} onstop={stop} />
</div>
```

Run it. Click START. The dot pulses with momentum instead of a flat keyframe — sharp attack, organic decay. Bump BPM up to 200 and switch to sixteenth notes. The spring keeps up: it doesn't fully settle between clicks at that rate, so the dot stays visibly active. Drop BPM to 40 and switch to quarters. Now the spring fully settles between clicks; you see the full pulse-and-settle cycle.

<TryThis label="Try this" title="Tune the spring">

Edit the `stiffness` and `damping` in `new Spring(0, { ... })` and refresh. A few presets worth trying:

- `{ stiffness: 0.05, damping: 0.2 }` — floppy and bouncy; clearly visible overshoot.
- `{ stiffness: 0.4, damping: 0.9 }` — snappy and tight; no overshoot at all.
- `{ stiffness: 0.15, damping: 0.5 }` — middle ground; subtle overshoot.

There's no right answer for what a metronome should feel like. Pick what you like. Different tempos may want different feels — you could even bind stiffness to BPM (higher BPM = stiffer spring so the dot keeps up).

</TryThis>

## Putting it together

Five concepts in one component: Spring physics, parameter tuning, the Spring/Tween choice, custom-property bridging from JS to CSS, and scoped styles. The component file is 25 lines. It does more than the original keyframe version, more reactively, with less code.

The bigger lesson: framework features compose. Spring + custom properties + scoped styles all work together — the Spring gives you a reactive value, the custom property gets it into CSS without imperative DOM mutation, scoped styles keep the component self-contained, the cascade lets parents theme it without props. Each feature is small; the combination is powerful.

## Exercises

### Exercise 1: Swap the keyframe for a spring

**Setup:** the lesson 4 metronome with the keyframe-based ClickIndicator.

**What to do:** replace ClickIndicator with the spring version above. Import `Spring` from `svelte/motion`, instantiate it, drive `--i` from `intensity.current`, rewrite the CSS to use `calc()` with `--i`. Remove the old `&lbrace;#key pulse&rbrace;` wrapper and the `@keyframes flash` block.

**Verify by:** clicking START makes the dot pulse with visible momentum on each click. The pulse feels different from a fixed-duration keyframe — sharper attack, organic decay. There's no more re-mount flicker (the DOM node persists across pulses).

**Stretch:** Add a second spring `glow = new Spring(0, { stiffness: 0.08, damping: 0.6 })` that responds slower than `intensity`. Drive the `box-shadow` blur off `glow` instead of `intensity`. The result: the core scales fast, the glow trails behind. Layered motion.

<details>
<summary>Show solution</summary>

The single-spring version is the worked example above. For the two-spring variant:

```svelte
<script>
  import { Spring } from 'svelte/motion';
  let { pulse = 0, accent = false } = $props();
  const intensity = new Spring(0, { stiffness: 0.18, damping: 0.4 });
  const glow = new Spring(0, { stiffness: 0.08, damping: 0.6 });

  $effect(() => {
    const _ = pulse;
    intensity.target = 1;
    glow.target = 1;
    setTimeout(() => {
      intensity.target = 0;
      glow.target = 0;
    }, 80);
  });
</script>

<div
  class="indicator"
  class:accent
  style="--i: {intensity.current}; --g: {glow.current}"
></div>

<style>
  .indicator {
    --i: 0; --g: 0; --c-base: #4a8fe7;
    width: 60px; height: 60px; border-radius: 50%;
    background: var(--c-base); margin: 0 auto;
    transform: scale(calc(1 + var(--i) * 0.3));
    box-shadow: 0 0 calc(var(--g) * 32px + 4px) var(--c-base);
    opacity: calc(0.5 + var(--i) * 0.5);
  }
  .indicator.accent { --c-base: #f0c050; }
</style>
```

The glow's lower stiffness and higher damping make it lag behind the core, giving a layered "shockwave" feel.

</details>

### Exercise 2: Compare Spring with Tween

**Setup:** the spring-driven ClickIndicator.

**What to do:** create a SECOND copy of the component (call it `TweenIndicator.svelte`) that uses `Tween` instead of `Spring`. Use `import &lbrace; Tween &rbrace; from 'svelte/motion'` and `import &lbrace; cubicOut &rbrace; from 'svelte/easing'`. Set `duration: 200`. Render both indicators side by side in `+page.svelte`.

**Verify by:** both dots pulse on every click. The spring one has overshoot and organic decay; the tween one has a fixed 200ms curve. You can see the difference clearly when you change BPMs — the spring adapts; the tween is the same every time.

**Stretch:** at high BPMs (sixteenths at 200), the spring might not settle between clicks (good — feels active). What does the tween do? Often: it gets re-triggered before completing, restarting the curve from wherever it was. This can look jittery. The fact that the spring handles this more gracefully is part of why it's the right choice here.

<details>
<summary>Show solution</summary>

```svelte
<script>
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  let { pulse = 0, accent = false } = $props();
  const intensity = new Tween(0, { duration: 200, easing: cubicOut });

  $effect(() => {
    const _ = pulse;
    intensity.target = 1;
    setTimeout(() => intensity.target = 0, 80);
  });
</script>

<div class="indicator" class:accent style="--i: {intensity.current}"></div>

<!-- same CSS as the spring version -->
```

Side by side, the tween feels like a fixed video clip; the spring feels like a physical object. At extreme tempos the difference gets larger.

</details>

### Exercise 3: Theme via the cascade

**Setup:** the spring ClickIndicator with `--c-base` as a CSS variable.

**What to do:** in `+page.svelte`, wrap the metronome panel in a div that sets `--c-base: #e74a4a` (red). Reload. The non-accent indicator should now be red instead of blue. The accent indicator should still be gold (because `.accent` overrides `--c-base` inside the component).

**Verify by:** the dot is red when not on the accent beat, gold on the accent beat. You didn't touch the ClickIndicator file. The theming came entirely from a parent-set CSS variable cascading down.

**Stretch:** add a "theme" picker to the page (4 buttons: blue, red, green, purple). Clicking a button updates a `theme` state variable, which sets a different `--c-base` on the wrapper. Watch the indicator color change live.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let theme = $state('#4a8fe7');
  const THEMES = ['#4a8fe7', '#e74a4a', '#4ae766', '#9b4ae7'];
</script>

<div class="metronome" style="--c-base: {theme}">
  <div class="theme-picker">
    {#each THEMES as t}
      <button style="background: {t}" onclick={() => theme = t}></button>
    {/each}
  </div>
  <ClickIndicator pulse={pulse} accent={beat % subdivision.ticksPerBeat === 1} />
  <!-- ... rest -->
</div>
```

The component doesn't have a "color" prop. The cascade does the work.

</details>

### Exercise 4: Demonstrate scoped style isolation

**Setup:** the metronome with all four components.

**What to do:** add a `<style>` block to `+page.svelte` with `button &lbrace; background: red; color: yellow; &rbrace;`. Reload.

**Verify by:** the buttons in `+page.svelte` itself (if any are present at the page level) turn red. But the buttons inside `<TransportButton>`, `<SubdivisionPicker>` do NOT turn red — they keep their original styling. This is scoped CSS isolating the page's style from the components'.

**Stretch:** change the rule to `:global(button) &lbrace; background: red; color: yellow; &rbrace;`. Reload. Now ALL buttons on the page turn red, including the ones inside child components. This is `:global()` opting out of scoping.

<details>
<summary>Show solution</summary>

The scoped version:

```svelte
<style>
  /* This only matches buttons directly rendered by +page.svelte's template.
     The TransportButton's <button> is rendered by a different component,
     so it has a different scope hash, and this selector doesn't match. */
  button { background: red; color: yellow; }
</style>
```

The global version:

```svelte
<style>
  /* This matches ANY button in the document, regardless of which
     component rendered it. Useful for resets and third-party-library styling;
     dangerous because it bypasses Svelte's normal isolation. */
  :global(button) { background: red; color: yellow; }
</style>
```

The dev tools' "Elements" panel makes the difference obvious — inspect a TransportButton's button and look at the applied styles. With scoping, the page's rule isn't listed. With `:global()`, it is.

</details>

### Exercise 5 (stretch): Bind spring stiffness to BPM

**Setup:** the spring indicator working.

**What to do:** make the spring's stiffness depend on the current BPM. Higher BPM = stiffer spring = the dot keeps up better. Lower BPM = softer spring = the dot has more visible momentum on each click.

The hint: you can't change stiffness on an existing Spring instance via the public API. You'd recreate the spring when BPM crosses thresholds, or use `intensity.set(value, &lbrace; hard: true &rbrace;)` differently for fast vs slow tempos, or accept a less elegant solution like adjusting the `setTimeout` delay based on BPM.

**Verify by:** at 60 BPM the dot has clear visible overshoot. At 200 BPM the dot snaps quickly without overshoot. The transition between feels natural.

**Stretch on the stretch:** instead of stiffness, modulate the `setTimeout(..., 80)` release timing based on BPM. At fast tempos, release earlier so the spring doesn't pile up. At slow tempos, release later for more visible attack.

<details>
<summary>Show solution</summary>

The cleanest version uses dynamic release timing:

```svelte
<script>
  import { Spring } from 'svelte/motion';
  let { pulse = 0, accent = false, bpm = 120 } = $props();
  const intensity = new Spring(0, { stiffness: 0.18, damping: 0.4 });

  $effect(() => {
    const _ = pulse;
    // shorter release at faster tempos so the spring doesn't pile up
    const releaseMs = Math.max(30, Math.min(120, 12000 / bpm));
    intensity.target = 1;
    setTimeout(() => intensity.target = 0, releaseMs);
  });
</script>
```

Parent passes `bpm`:

```svelte
<ClickIndicator pulse={pulse} accent={...} {bpm} />
```

This is simpler than recreating the spring and gets you most of the same feel improvement.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/lib/components/ClickIndicator.svelte` updated to use `Spring` from `svelte/motion` instead of CSS keyframes.
- Custom properties (`--i`, `--c-base`) driving the indicator's visual treatment via `calc()` expressions.
- An understanding of how scoped styles get the scope hash class added at compile time.
- An understanding of how CSS custom properties cascade and enable theming without prop drilling.

### Verify it works

- The dot pulses with momentum on each click. It feels like a hit, not a flash.
- At 60 BPM in quarter notes the dot fully settles between clicks (you can see the full attack-and-release cycle).
- At 200 BPM in sixteenths the dot stays visibly active (the spring doesn't fully settle).
- The accent (every 4th beat at quarters) changes color smoothly via `transition: background-color`, no abrupt swap.
- Scoping a `button &lbrace; ... &rbrace;` rule in `+page.svelte` does NOT affect buttons inside child components.

### Compare against the reference

Your ClickIndicator should be ~25 lines (script + markup + CSS combined). Most of the lesson's lines are CSS, not JS — the spring itself is 5 lines including the import.

## Common questions

**Q: When should I use `Spring` vs `Tween` vs plain CSS transitions?**
A: CSS transitions for "this property changes; ease it" — simplest, fastest, GPU-friendly. Tween for "I want a JS-controlled value to interpolate over a fixed duration with a specific easing curve." Spring for "I want a JS-controlled value to respond like a physical object." Roughly: CSS for declarative state changes, Tween for choreographed timelines, Spring for interactive feedback.

**Q: Why does Svelte scope styles by adding a class instead of using Shadow DOM?**
A: Shadow DOM isolates too aggressively — global styles, design-system tokens, and parent-set CSS variables don't penetrate the shadow boundary by default. The class-based scope keeps the global cascade working, which is exactly what you want for theming and design systems. The trade-off is that selector specificity goes up slightly, but in practice it's invisible.

**Q: How do I set a CSS custom property on a Svelte component from outside?**
A: Two ways. The `style` attribute: `<ClickIndicator style="--c-base: red" />` — sets the variable on the component's root element. Or set it on a parent: `<div style="--c-base: red"><ClickIndicator /></div>` — and the cascade carries it in. The parent-set version is more flexible because the variable is set on multiple descendants automatically.

**Q: My spring's `current` value isn't updating. What's wrong?**
A: Most likely you're not reading it in a reactive context. `intensity.current` only triggers re-rendering when it's accessed during template rendering or inside a `$derived` / `$effect`. If you're storing the value in a local variable in a function, the binding to the variable is dead — read `intensity.current` directly in the template each time.

**Q: Can I animate a CSS custom property with CSS `transition` instead of using JS?**
A: Yes, if you register it with `@property`. By default CSS variables are untyped (treated as strings) and can't be smoothly interpolated. `@property --i &lbrace; syntax: '&lt;number&gt;'; inherits: true; initial-value: 0 &rbrace;` tells the browser `--i` is a number, and then `transition: --i 200ms` works. Useful for pure-CSS animations of custom properties. For our spring case we don't need it because the JS provides the interpolated value already.

## What's next

You shipped a metronome. Five lessons, five concepts, one working tool. Quick recap of what you built:

- **L1:** A ticking sound at a fixed BPM via Tone.js. Audio scheduling on the audio thread, not setInterval.
- **L2:** A BPM slider, a visual indicator, the dependency-tracking pattern for `$effect`.
- **L3:** Split into ClickIndicator, BpmDial, TransportButton. Props, `$bindable`, callback props.
- **L4:** Subdivisions (quarter / eighth / triplet / sixteenth). Snippets for parameterized child markup.
- **L5:** Spring physics on the indicator. Scoped CSS internals. Custom properties for theming via the cascade.

Open your metronome at `localhost:5173`. It's a configurable, smooth-feeling metronome in about 200 lines of code across 5 files. You can practice with it. People could ship this as a free web app and it'd be useful.

You've now used the core Svelte 5 feature set: components, props, `$state`, `$derived`, `$effect`, `$bindable`, snippets, `Spring`, scoped styles, custom properties. The next module builds a chord progression player — `bind:value` patterns at scale, shared state across components via `.svelte.ts` modules, and the localStorage + URL-share pattern from M2 applied to a richer data model. The framework features won't get much more advanced; the application complexity will.

<OpenTheHood title="When Spring vs Tween (deeper dive)">

Both `Spring` and `Tween` from `svelte/motion` are reactive interpolators. They differ in the math underneath:

- **Tween** computes `value = lerp(start, target, easing(t / duration))` each frame, where `t` is elapsed time. The animation runs for exactly `duration` ms, then stops. The trajectory is fully determined at the start.
- **Spring** integrates the differential equation `a = -k * (current - target) - c * velocity` each frame. The animation runs until `current` is close enough to `target` and `velocity` is close enough to zero. The trajectory depends on the spring parameters and the distance to target.

Use Tween for: progress bars, predictable slide-ins, exit animations, anything where timing is part of the design specification.

Use Spring for: drag interactions, mouse-followers, hover effects, click feedback, scroll positions, anything where the user is poking at the UI and expects organic feedback.

The metronome's pulse: Spring. A click feels like a strike. A strike has momentum, decay, overshoot. A 200ms Tween would feel like clip art.

</OpenTheHood>

<SourcesSection lessonKey="03-metronome-studio/05-spring-and-style" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
