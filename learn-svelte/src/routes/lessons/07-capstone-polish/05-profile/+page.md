<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Profile and Optimize · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-7);">

<LessonHeader
  moduleSlug="07-capstone-polish"
  lessonSlug="05-profile"
  title="Profile and Optimize"
  blurb="DevTools. Svelte inspector. Find a real bottleneck. Ignore the non-issues."
/>

## Why this lesson exists

The DAW is done. Effects chain, mixer, FFT visualizer, persistence, recording, share URLs — everything you set out to build. By default it'll be fast enough. Svelte's runtime is light, the audio scheduling runs on its own thread, the per-cell reactivity means UI updates are proportional to changes rather than to the total UI. Most apps written this way ship without profiling and work fine. Your DAW is one of them.

This lesson exists for the case where something IS slow. Not now — later, when you've extended the DAW or built another app and you're staring at a Performance trace wondering what the long red bar means. The skills are diagnostic: how to read a Performance recording, what to look for in a Svelte-specific timeline, how to recognize the common bottleneck patterns (60fps state updates, broad effect dependencies, heavy DOM in hot loops) before you start guessing. It also covers the equally important inverse skill: knowing when NOT to optimize, so you don't spend a weekend shaving milliseconds off something the user can't perceive.

## Learning objectives

By the end of this lesson you'll be able to:

- Record a Performance trace in Chrome DevTools and identify the main thread, the audio thread, and the frame chart.
- Read flame graph output to find the longest synchronous JS execution, the longest layout/style work, and the gaps between scheduled audio events.
- Install and use the Svelte DevTools browser extension to inspect the component tree, reactive state, and effect timeline.
- Recognize the three most common Svelte performance smells: 60fps state updates, broad effect dependencies, and heavy DOM in hot render loops.
- Distinguish "the user can perceive this" from "I can measure this" and prioritize accordingly.
- Articulate when NOT to optimize — bundle size for personal apps, first-paint for client-side-only apps, reactivity overhead in cold paths.

## Concept 1: The DevTools Performance tab

### Recording a session

In Chrome (or any Chromium browser), open DevTools (Cmd-Opt-I or F12). Click the "Performance" tab. The page is dominated by an empty timeline with a record button.

Click the circle to start recording. Interact with your app — for the DAW, press PLAY, let it loop a few times, drag a slider, click some cells. Click the circle again (now red, "stop recording") to end.

DevTools spends a moment processing the trace and then displays the results: a stack of horizontal tracks at the top showing CPU usage and frame rate, a timeline of activity in the middle, and a flame graph at the bottom showing the call stack at any moment in the trace.

### The four tracks that matter

Out of the dozens of rows DevTools shows, four are most useful for a typical Svelte app:

1. **Main thread.** The JavaScript and DOM thread. Long bars here = expensive synchronous work blocking user interaction.
2. **Frames.** A row of small rectangles, one per frame the browser rendered. Green = on-time (under 16ms at 60Hz). Yellow = late. Red = dropped (over 33ms — the browser couldn't keep up). A trail of red is what "janky" looks like in the trace.
3. **Network.** Requests and responses with timing. Useful for cold-start issues, not for the DAW's hot path.
4. **Audio Worklet** or similar (varies by browser version). If the audio thread is glitching, gaps appear here. For Tone.js, you'll see the underlying AudioContext activity if you've enabled the relevant flag in Chrome.

The bottom flame graph: click any moment in the trace and the flame graph shows what was running at that moment. Bars stacked downward represent the call stack at that microsecond. Wide bars = expensive functions. The width is time, not size.

### Reading the main thread

A few characteristic shapes you'll see:

- **A wide purple block labeled "Recalculate Style" or "Layout".** The browser is recomputing CSS / layout. Triggered by DOM changes — adding elements, changing classes, modifying styles. Long bars (>10ms) mean you triggered expensive layout work — probably affected many elements at once.
- **A wide yellow block labeled "Compile Script" or "Evaluate Script."** Initial page-load work parsing and running JS. Mostly happens once on cold start.
- **A wide blue block labeled "Paint" or "Composite."** GPU work to render pixels. Long bars usually mean a lot of pixels changed at once (a full-canvas redraw, a giant scroll, etc.).
- **Many small purple bars labeled "RunMicrotasks" or "Microtask Loop."** This is reactive flushing — `$effect`s firing, derived values recomputing, template bindings updating. A solid band of small microtasks is the "effect storm" from Lesson 4.

For the DAW, a typical "everything is fine" trace looks like: green frames throughout, occasional small main-thread blocks for click handlers, the audio thread running uninterrupted, frame durations consistently under 16ms.

A typical "something is wrong" trace shows: yellow or red frames during interaction, long synchronous JS bars, or a continuous main-thread band when nothing should be happening.

### Common patterns and their causes

- **Long "Recalculate Style" during slider drags.** A drag is firing too many style changes that affect too many elements. Often: a global `style="--var: &lbrace;value&rbrace;"` on an ancestor that cascades to thousands of descendants. Fix: scope the change to the element that actually needs it.
- **Long script execution during clicks.** A click handler is doing too much synchronous work. Common causes: large `structuredClone`, big array iterations, parsing large JSON. Fix: defer the work (e.g., `await tick()` to yield to the browser between phases) or move it to a Web Worker.
- **Continuous microtask bands during animation.** The effect storm. Fix: take the high-frequency data out of `$state`. See Lesson 4.
- **Audio thread gaps.** Audio events not arriving on time. Usually caused by the main thread being too busy to keep `Tone.Transport` scheduling ahead. Fix: reduce main-thread work during playback, or increase Tone's lookahead.

## Concept 2: The Svelte DevTools extension

### Installing

Search "Svelte DevTools" in the Chrome Web Store (or Firefox Add-ons). The official extension is maintained by the Svelte team. Install. Reload your dev server.

Open DevTools on your DAW. A new "Svelte" tab appears alongside Elements, Console, Sources, etc. Click it.

### What the extension shows

Three main panels:

1. **Component tree.** A nested view of every mounted Svelte component, from the root down. Click a component to see its current state.
2. **State inspector.** For the selected component, the values of every rune (`$state`, `$derived`, props). Updates live as state changes — you can watch your runes mutate in real time.
3. **Effect timeline.** A chronological log of `$effect` fires: when each effect ran, what triggered it (which dependency changed), how long it took. This is the killer feature for Svelte profiling.

The timeline is where you'll spend the most time when investigating reactivity issues. It answers questions Performance tab can't: "which effect ran when," "why did it run," "how often does it run during normal interaction."

### A diagnostic workflow

When you suspect a Svelte reactivity issue:

1. **Open the Svelte tab.**
2. **Clear the effect timeline.**
3. **Perform the suspected slow interaction** (drag a slider, click a button, etc.).
4. **Look at the timeline.** How many effects fired? Are any unexpected? Does one effect fire many times when you'd expect once?
5. **Click an effect** to see what triggered it. The "triggered by" field shows the rune (or chain of runes) whose change caused this effect to run.

The most actionable finding: an effect firing more often than you expect, triggered by a rune you didn't realize it depended on. Usually this is a too-broad read — e.g., reading `audio.channels` (the whole record) when you only meant to read `audio.channels.kick.gain`. Fix: read only what you need.

### The "triggered by" hierarchy

A useful clarification on what the timeline shows. When you click a cell:

1. The onclick handler runs. It calls `audio.toggleCell('kick', 3)`.
2. The method writes `audio.pattern.kick[3] = 1`. The proxy notifies subscribers.
3. Several effects fire: the auto-save effect (because it reads `pattern`), the cell's `class:active` binding (because it reads `pattern.kick[3]`).
4. The auto-save effect serializes the pattern and writes to localStorage.

The Svelte DevTools timeline shows all four effect fires, in order, with their durations. You can see the cascade. If something fires that shouldn't, you can see exactly what triggered it.

## Concept 3: The three common Svelte bottlenecks

### Bottleneck 1: 60fps state updates

The full case is Lesson 4. Symptom: a continuous microtask band in Performance, dozens-to-hundreds of effects per second in the Svelte timeline, sluggish input response.

Diagnosis: look for `$state` declarations whose values change at frame rate. The Svelte DevTools state inspector will show the rune value changing continuously if you watch it during animation.

Fix: take the high-frequency data out of `$state`. Use plain `let` or no storage at all. See Lesson 4 for the full pattern catalog.

### Bottleneck 2: too-broad effect dependencies

An effect that reads too much and fires too often.

```ts
// SMELL: reads entire channels record, fires on any channel change
$effect(() => {
  const channels = audio.channels;
  const kickMuted = channels.kick.muted;
  if (kickMuted) console.log('kick muted');
});
```

This effect fires when ANY channel changes — kick muted/unmuted, snare gain dragged, hat soloed, perc panned. Because the first line reads `audio.channels` (the parent record), the proxy registers a dependency on the whole record. Any nested change triggers the effect.

Fix: read only the leaf you care about.

```ts
$effect(() => {
  if (audio.channels.kick.muted) console.log('kick muted');
});
```

Now the effect subscribes only to `audio.channels.kick.muted`. Other channel changes don't fire it.

Diagnosis: in Svelte DevTools' effect timeline, find effects with high fire counts. Click them. The "dependencies" or "triggered by" view shows what each one subscribed to. If the dependency list is wider than you expected (e.g., the whole `channels` record instead of one leaf), the read pattern is too broad.

### Bottleneck 3: heavy DOM in render loops

This is less of a Svelte issue and more of a DOM issue. A render loop (animation frame, scroll handler) that does too much DOM work per iteration.

```ts
function tick() {
  raf = requestAnimationFrame(tick);
  // BAD: reads and writes layout-affecting properties in a loop
  for (const el of document.querySelectorAll('.cell')) {
    el.style.width = el.offsetWidth + 1 + 'px'; // forces layout each iteration
  }
}
```

The `el.offsetWidth` read forces the browser to flush pending layout to compute the value. Then the write invalidates layout. Reading after a write forces another layout. Doing this in a 60Hz loop creates 60+ layout flushes per second.

Fix: batch reads and writes ("read all, then write all"), or avoid layout-affecting properties in hot loops, or use transforms (which the GPU handles and don't trigger layout) instead.

For the DAW, the canvas-based FFT visualizer sidesteps this entirely — canvas drawing doesn't touch the DOM beyond the canvas itself, which is a single element. DOM-based animations (CSS transitions on the cell glow) are GPU-composited and don't touch layout.

Diagnosis: in Performance, look for "Layout" bars that recur frequently during animation. If they correlate with rAF callbacks, the callback is forcing layout.

### Bottleneck 4 (DAW-specific): audio thread starvation

The audio thread is independent of the main thread but depends on the main thread to schedule events ahead. `Tone.Transport`'s default 100ms lookahead means the main thread should populate the audio thread's event queue with the next 100ms of events. If the main thread is too busy for ~100ms continuously, the audio thread runs out and you hear glitches.

Symptoms: audible clicks, dropouts, hiccups in the audio during heavy interaction (rapid slider drags, opening dev tools, etc.).

Diagnosis: Performance tab, audio thread row shows gaps during the main-thread busy periods. Or: just listen — audio glitches that correlate with UI interactions are usually this.

Fix options:

- Reduce main-thread work during playback. Heavy DOM operations during playback are the most common culprit.
- Increase Tone's lookahead: `Tone.context.lookAhead = 0.2` (200ms instead of 100ms). More cushion for main-thread hiccups, at the cost of slightly less responsive parameter changes (since changes scheduled "now" are 100ms further from playback).
- Move heavy work off the main thread. Web Workers for serialization, computation. Doesn't help with DOM updates (those have to be on the main thread).

For the DAW we ship the default 100ms lookahead. If you ever add heavy features (e.g., real-time waveform analysis with thousands of samples) and hear glitches, bumping the lookahead is the first thing to try.

## Concept 4: When NOT to optimize

### Bundle size for personal apps

The DAW's production bundle is probably ~250KB gzipped (Svelte runtime + Tone.js + your code). For a desktop app on a stable connection, this loads in tens of milliseconds. For a mobile user on slow connection, maybe a second.

Could you shave bundle size? Yes — code-split Tone.js to load only the synths you use, tree-shake harder, lazy-load the recording UI. Each optimization saves tens of KB. Total possible savings: maybe 100KB.

Is it worth it? For a personal DAW, almost certainly not. The user loads the app once per session and uses it for hours. The 100KB savings would amortize over a minutes-of-use threshold that's basically never reached. The development time would be better spent on features.

For a public-facing app where every user pays the cold-start cost on every visit: the calculus changes. Optimize then. Otherwise: ship.

### First-paint speed for client-side-only apps

SvelteKit can server-render the DAW, sending HTML on first request so the user sees something before JS loads. For an app that needs JS to do anything (and the DAW does — without JS, the UI is dead), this saves ~50ms of "white screen" time at the cost of doubled rendering work on the server.

For most personal projects, the trade isn't worth it. The user gets to "interactive" at the same moment either way (when JS finishes). The HTML-only intermediate state is a brief uncanny-valley where the UI looks ready but isn't.

For content-heavy apps (blogs, docs sites, e-commerce), SSR is great because the HTML alone is useful. For app-shaped apps where JS is essential, the trade-off mostly isn't.

### Reactivity overhead in cold paths

You might be tempted to refactor a working component because "it could be slightly faster." A few proxy lookups per click, a derived that could be a plain function, a `$state` that could be `$state.raw`. Each tweak might save microseconds.

Don't. The cold-path cost is invisible. The refactor introduces bug risk. The improvement isn't measurable in any meaningful sense. Time spent refactoring working code is time not spent on features that make the app more useful.

The rule: optimize what's measurably slow. Measure first.

### When users actually notice

A useful threshold framework, roughly:

- **Under 100ms latency on input:** feels instant. Don't worry about this.
- **100-300ms latency:** feels responsive. Acceptable for most interactions.
- **300ms-1s latency:** feels sluggish. Noticeable but tolerable for non-critical paths.
- **Over 1s latency:** feels broken. Users will notice and complain.
- **Over 5s without feedback:** users assume the app crashed.

For animation:
- **60fps (16.6ms per frame):** smooth. The default target.
- **30fps (33ms per frame):** noticeably choppy but acceptable for non-critical animation.
- **Under 30fps:** janky. Users perceive degradation.

Optimization work is worth it when it moves the user across one of these thresholds. Shaving 5ms off an already-instant operation isn't worth it. Shaving 50ms off a 250ms operation (bringing it down to 200ms) starts to matter. Shaving 200ms off a 700ms operation matters a lot.

Measure where you are. Decide if crossing a threshold is achievable. Optimize for that.

## Concept 5: A profiling walkthrough on the DAW

### The setup

1. Open the DAW in Chrome.
2. Open DevTools → Performance tab.
3. Click the record button (gray circle, top left).
4. Wait a moment.

### The interactions

5. Press PLAY in the DAW. Let it loop twice (~8 seconds at 120 BPM).
6. Drag the BPM slider rapidly back and forth, from 80 to 180 and back, over ~3 seconds.
7. Toggle five or six grid cells while it plays.
8. Drag the kick channel's gain fader up and down for 2 seconds.
9. Open the effect panels and drag the filter cutoff slowly across its full range.
10. Click STOP.
11. Click the record button in DevTools to stop the trace.

### What to expect

If everything's healthy, you should see:

- **Frames track:** mostly green, occasional yellow during heavy interaction. No red.
- **Main thread:** short purple bands during interactions, idle between them.
- **Audio thread:** continuous activity during the play period, no gaps.
- **No long Recalculate Style bars** during slider drags. The mixer and effect panels use scoped per-element styles, not cascading global styles, so drags don't trigger global layout.

### What to look for if something seems wrong

If the trace shows red frames or visible jank:

- Find the longest main-thread bar in the trace.
- Click it. The flame graph at the bottom shows the call stack at that moment.
- The top of the flame graph is what was actually running. Common culprits:
  - `set` on a rune followed by long microtask flushes → effect storm.
  - `addEventListener` callbacks deep in a Tone.js stack → audio scheduling work, normal.
  - Long `localStorage.setItem` calls → save operation blocking; consider debouncing.
  - Repeated `getBoundingClientRect` or `offsetWidth` reads → layout thrashing.

Form a hypothesis ("this is taking too long because X"). Make ONE change. Re-record. See if the bar shrunk. Repeat.

The discipline: change one thing at a time, measure each change. Don't make a sweep of "let me optimize everything" without re-measuring; you'll have no way to attribute improvements (or regressions) to specific changes.

## Concept 6: Synthesis of M7

### What you built

M7 in five lessons added:

- **L1:** A filter/delay/reverb effect chain with smooth parameter ramping. The "one $effect per parameter, unconditional read, rampTo" pattern.
- **L2:** A per-channel mixer with gain, pan, mute, solo. Sixteen independent reactive cells. Industry-standard solo logic.
- **L3:** A live FFT visualizer with canvas rendering, 60fps rAF loop, DPI scaling. The first example of "don't put per-frame data in `$state`."
- **L4:** The formalization of that rule, plus `untrack` and `flushSync` as escape hatches.
- **L5:** Profiling tools and discipline. When to optimize, when not to.

Combined with M6, you have a working DAW with:

- Four drum tracks on a 16-step grid.
- Sample-accurate Tone.js scheduling.
- Per-track mixer (gain, pan, mute, solo, master).
- Filter, delay, reverb effect chain.
- Live FFT visualizer.
- Pattern persistence (localStorage auto-save + named slots).
- Audio recording (MediaRecorder + IndexedDB blob storage).
- BPM control, downbeat indicators, share URLs.

Roughly 800 lines of code across ~10 files. A real audio tool, not a toy. The architecture scales: doubling the track count means changing one constant; doubling the effect parameters means adding more `$effect`s in the same pattern; the mixer would handle 64 channels with the same code.

### The patterns that matter

If you take three things from M7 into future work:

1. **Read state unconditionally before any branching in an effect.** The dependency tracker subscribes to whatever was read on the most recent run. Conditional reads = conditional subscriptions = bugs.
2. **Match reactivity granularity to data rate.** User-interaction-rate data in `$state`. Frame-rate data in plain variables. Source-owned data not stored at all.
3. **Profile before optimizing.** Build features; let them be a little slow; only refactor when measurement shows a real problem. Premature optimization is wasted weekends.

These aren't Svelte-specific in spirit, only in detail. They're transferable to any reactive system, any animation system, any responsive UI work.

### When the DAW falls short

A few honest gaps in what we built:

- **No undo/redo.** The pattern can be edited but mistakes can't be reverted. Adding undo means an event-sourced architecture or snapshot history; significant complexity.
- **No MIDI input.** Drum patterns are constructed visually; you can't tap them in via a hardware controller. Web MIDI API + an input handler would add this.
- **No per-track effects.** The filter/delay/reverb is global. Per-track effects (the kick gets its own filter; the snare gets a tight reverb; the hat is dry) is what a real DAW does. The pattern from L1 applied 4x (one effect chain per track) is the structure; the wiring is the work.
- **Limited synthesis variety.** Four built-in synths, no oscillator design, no envelope shaping. A "synth lab" feature would let users design their own track sounds.
- **No tempo automation.** BPM is constant per pattern. Real songs accelerate, slow down, ritardando into endings. Tempo automation = a per-step BPM array.

Any of these would be a substantial follow-up project. None are required to call the DAW finished.

## Exercises

### Exercise 1: Record a clean trace

**Setup:** The DAW is running locally.

**What to do:** Run the profiling walkthrough above. Save the resulting trace (right-click on the timeline → "Save profile") so you have a baseline to compare against later.

**Verify by:** The trace file is on your disk. You can re-load it any time and compare future traces against it. Frame durations during play are mostly under 16ms.

**Stretch:** Take a trace BEFORE adding M7's features (you can `git stash` your M7 changes, take a trace of just M6, then unstash). Compare. The M7 additions should add measurable but small main-thread work.

<details>
<summary>Show solution</summary>

No code — this is a tooling exercise. The point is to have profiling become a routine, not a one-time chore. The first time you record a trace, it takes ten minutes to figure out the UI. The fifth time, you know which tracks matter and where to look. Build the muscle.

</details>

### Exercise 2: Introduce a bottleneck and find it

**Setup:** A clean DAW.

**What to do:** Intentionally add a performance smell. Pick one:

- Put `audio.currentStep` reads in a way that breaks (e.g., a `$derived` that reads the whole pattern and recomputes a hash on every step).
- Add a `$state` rune that updates 60 times per second from a rAF loop in some new component.
- Add a `$effect` in the engine that reads `audio.channels` (the whole record) and does something on every channel change.

Record a Performance trace AND check the Svelte DevTools effect timeline. Identify the smell in both traces.

**Verify by:** You can point to the specific bar in Performance and the specific effect fire in Svelte DevTools and articulate "this is the cost of the change I made."

**Then:** Remove the bottleneck. Re-record. The corresponding bars/fires are gone.

**Stretch:** Try to make a "subtle" bottleneck — one that the user wouldn't perceive immediately but that shows up in the trace. The difference between "the user can't tell" and "the tools say it's there" is exactly the boundary between "ship it" and "fix it."

<details>
<summary>Show solution</summary>

A textbook smell:

```ts
// In FftVisualizer or any frequently-updating component
let fakeData = $state(new Float32Array(64));

$effect(() => {
  let raf;
  function tick() {
    fakeData = new Float32Array(64).map(() => Math.random()); // 60Hz state write
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
});
```

Bind `fakeData` to a template (`<p>peak: &lbrace;Math.max(...fakeData)&rbrace;</p>`). In Performance, you'll see continuous microtask work. In Svelte DevTools, you'll see the effect firing 60 times per second.

Remove. Re-profile. Quiet.

</details>

### Exercise 3: Verify the DAW's per-cell reactivity claim

**Setup:** The DAW with the mixer and sequencer.

**What to do:** Open Chrome DevTools → Rendering pane → enable "Paint flashing." Drag one channel's gain fader. Observe which regions of the page flash (indicating a repaint).

**Verify by:** Only the dragged channel's strip flashes. The other three channel strips don't repaint. The sequencer doesn't repaint. The effect panels don't repaint.

**Then:** Disable paint flashing. Enable "Layer borders" or "FPS meter" for additional perspectives.

**Why this matters:** This is the per-cell reactivity claim made visible. In a re-render-on-state-change framework, you'd see widespread paint flashing on every drag. Svelte's per-element subscription model means visual updates are localized to subscribers.

<details>
<summary>Show solution</summary>

No code — observation exercise. If you see widespread flashing, look for an ancestor element whose style or class is bound to a frequently-changing rune (which would invalidate the ancestor's paint and cascade to children). The fix is to push the binding down to the leaf that actually needs to react.

</details>

### Exercise 4: Decide what to optimize and what to leave

**Setup:** The DAW is feature-complete. You have a Performance trace and a list of theoretical improvements.

**What to do:** For each of the following hypothetical optimizations, decide: optimize, leave alone, or "depends on measurement." Justify each.

1. The auto-save effect serializes the entire pattern + bpm to localStorage on every change.
2. The FFT visualizer redraws every frame even when not playing.
3. The mixer renders all four channel strips even if you've only interacted with one.
4. The page loads ~250KB of JS on first request.
5. Each cell click goes through three effects (the auto-save, the cell's class binding, the SR announcement).

**Verify by:** Your reasoning matches the principles in this lesson. Defensible answers vary by intended audience.

<details>
<summary>Show solution</summary>

My answers:

1. **Auto-save serializing on every change** — depends. For a typical session (~100 cell clicks per minute), 100 small localStorage writes per minute is fine. For a stress test (auto-randomize 1000 patterns per second), it'd matter. Default: leave alone. If you ever add bulk-edit features, debounce.

2. **FFT visualizer redrawing when not playing** — leave alone. The "idle" branch draws one rectangle (the baseline) per frame. ~5 microseconds. Below noise.

3. **Mixer rendering all four strips** — leave alone. There are four channels. Always. There's no scenario where rendering fewer would help. (For a 64-channel mixer this changes — virtualization would matter.)

4. **250KB of JS** — depends on audience. Personal/desktop: leave alone. Public-facing with mobile users: investigate code-splitting Tone.js. Currently no measurable user-perceptible impact.

5. **Three effects per cell click** — leave alone. Each effect is cheap. Three of them per click is invisible. If profiling shows clicks taking >100ms, investigate, but the per-effect overhead is unlikely to be the cause.

The pattern: optimize when measurement shows a user-perceptible problem. Leave alone when theory predicts a cost the user can't perceive.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- (no new files — this is a profiling exercise)

### Verify it works

- You've opened DevTools → Performance, recorded a session of interaction, and looked at the result
- Frame durations during typical interaction stay under 16ms (no red bars in the frames track)
- You can identify which functions/components take the most main-thread time
- You've installed the Svelte DevTools extension and can see your component tree, state, and effect activity
- If you spotted a bottleneck: you have a hypothesis about why, and a concrete change you'd try first

### Compare against the reference

If your version doesn't match: Nothing specific in capstone-reference for this lesson — it's a meta-skill. But the reference DAW IS the working baseline you can compare your performance against: if yours is meaningfully slower, you have something to investigate.

The reference project lives at `learn-svelte/capstone-reference/` in this repo. Run it locally — `cd capstone-reference && npm install && npm run dev` — to see a verified working version. If your DAW doesn't match the reference behaviorally, the bug is in your code, not the framework.

## Common questions

**Q: Should I install React DevTools alongside Svelte DevTools?**
A: No reason to unless you're working on both. The two extensions don't conflict but each takes some memory and tab overhead. Install per-project.

**Q: The Svelte DevTools extension doesn't show my app.**
A: A few common causes: you're running a production build (extension only works on dev builds), the extension is outdated relative to your Svelte version, or the extension is disabled for the tab. Check the extension settings. Reload.

**Q: Performance recordings are huge files. Is that a problem?**
A: They're large (often MB-scale) but manageable. Don't commit them to version control; do save them locally for before/after comparisons. The Chrome team also has a "minimal" recording mode that drops some detail in exchange for smaller files; useful for long recordings.

**Q: What about Lighthouse for profiling?**
A: Lighthouse is for first-paint / cold-start / accessibility / SEO. It's not useful for hot-path profiling of an interactive app. For the DAW, Lighthouse will mostly tell you about the initial page load and not about whether the DAW feels good to use.

**Q: How do I know if my effect timeline shows "too many" fires?**
A: Compare against your mental model. If you expect "one effect per cell click" and the timeline shows three, ask why. If you expect "one effect per step" and the timeline shows sixty per second, you have a frame-rate-state problem. The threshold for "too many" depends on what you expected.

**Q: My audio glitches but the trace looks clean. What gives?**
A: A few options: the trace might not be capturing the glitch period (try a longer recording with the audio fault reproduced inside it); the audio thread isn't always visible in standard Chrome traces (try `chrome://flags` to enable additional audio profiling); or the glitch might be in the OS audio driver, not the app (try restarting Chrome, or test in a different browser).

## What's next

Module 8 is the last module. Deploy the DAW to the web (so the share URLs you built in M6 actually work), polish the production build for sharing, and a synthesis lesson on where Svelte sits among other frontend frameworks. The DAW becomes a portfolio-grade artifact: a working, shippable, demonstrably-capable piece of work.

<SourcesSection lessonKey="07-capstone-polish/05-profile" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
