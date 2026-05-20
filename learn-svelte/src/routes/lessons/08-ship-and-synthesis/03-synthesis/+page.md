<script>
  import FrameworkRace from '$lib/sandbox/FrameworkRace.svelte';
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import LessonTldr from '$lib/synthesis/LessonTldr.svelte';
  import ModulesInventory from '$lib/synthesis/ModulesInventory.svelte';
  import VersusBlock from '$lib/synthesis/VersusBlock.svelte';
  import ComparisonMatrix from '$lib/synthesis/ComparisonMatrix.svelte';
  import DecisionRules from '$lib/synthesis/DecisionRules.svelte';
  import PitchCard from '$lib/synthesis/PitchCard.svelte';
  import ExerciseDeck from '$lib/synthesis/ExerciseDeck.svelte';
  import FaqList from '$lib/synthesis/FaqList.svelte';
  import MythGrid from '$lib/synthesis/MythGrid.svelte';
  import RunesTranslation from '$lib/synthesis/RunesTranslation.svelte';
  import WhatsNextGrid from '$lib/synthesis/WhatsNextGrid.svelte';
  import Checklist from '$lib/synthesis/Checklist.svelte';
  import BigAnswers from '$lib/synthesis/BigAnswers.svelte';
</script>

<svelte:head><title>Why Svelte: A Working Synthesis · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-8);">

<LessonHeader
  moduleSlug="08-ship-and-synthesis"
  lessonSlug="03-synthesis"
  title="Why Svelte: A Working Synthesis"
  blurb="The bookend. Where Svelte wins, where it loses, the convergence story, and what to say when someone asks."
/>

<LessonTldr />

## Why this lesson exists

You picked up Svelte to learn it. You finished the curriculum with a working DAW and five other apps to your name. Somewhere along the way the question "should I use Svelte for this?" started having an actual answer for you, instead of being a thing other people argue about. This lesson sharpens that answer into a position you can defend.

Most "framework comparison" content is written by people whose stake in being right is greater than their stake in being useful. It's marketing dressed as analysis. The honest version is unglamorous: every modern reactive framework can build the apps you'd want to build. The differences are real but they're trade-offs, not absolutes. There's a thing each of them is best at, and there are situations where each of them is the wrong call.

By the end you should be able to walk into any framework conversation — at a job interview, in a tech-stack-selection meeting, with a friend choosing what to learn next — and offer a position that's specific, defensible, and grounded in what you've actually shipped. Not "Svelte is best." Not "it depends." An honest map of where each framework lives and the kind of project that fits each one.

## Learning objectives

By the end of this lesson you'll be able to:

- State the single architectural choice that distinguishes Svelte from React, Vue, Solid, and Qwik, and trace its consequences.
- Explain what changed in Svelte 5 (runes) versus Svelte 3/4 and why the change happened.
- Compare Svelte to React, Vue, Solid, Qwik, and Astro on the dimensions that actually matter for stack selection.
- Identify cases where each of those frameworks is the better choice than Svelte.
- Articulate the React Compiler convergence story and what it means for the Svelte-vs-React framing.
- Deliver a 60-second pitch for Svelte that's honest about trade-offs and includes specific decision rules.
- Recognize three out-of-date 2026 myths about Svelte and correct them without sounding defensive.

## Concept 1: What you've actually built

Before the synthesis, the inventory. Look at what shipped across the curriculum.

<ModulesInventory />

Roughly 1500–2000 lines of application code across six projects. The Svelte surface you touched: `$state`, `$derived`, `$effect`, `$props`, `$bindable`, slots and snippets, transitions, motion springs, scoped CSS, layouts, routing, load functions, form actions, render mode flags, prerender configuration. Plus the SvelteKit conventions — `+page.svelte`, `+page.ts`, `+layout.svelte`, `+layout.ts`, `+server.ts`. Plus the deploy story.

That's most of what Svelte and SvelteKit are. The features you didn't touch — server hooks, custom transitions, `<svelte:options>`, custom elements, the inspector API — are corners you can learn in an afternoon when you need them. The framework doesn't get materially bigger as you scale up. It's all here.

> **Svelte has a small mental surface, and using it doesn't reveal a second, hidden Svelte underneath.** What you've seen is most of what there is.

React's surface, by contrast, keeps growing — hooks, then concurrent mode, then Suspense, then Server Components, then Server Actions, then the Compiler — and each layer interacts with the previous ones. The second observation: **you shipped something live.** The DAW is on a public URL. Other humans can open it, click PLAY, share a pattern. That's not the same as building a tutorial counter app, and you got there in 35 lessons because Svelte gets out of the way enough that real work is reachable from the basics.

## Concept 2: The one architectural choice

Strip away surface differences (template syntax, file format, naming) and the differentiator between Svelte and almost every other JavaScript framework is one thing: **Svelte is a compiler.**

### What that means specifically

When you write a React component, you're calling functions in a runtime library. `React.createElement` creates virtual DOM nodes. `useState` registers a piece of state with React's reconciler. `useEffect` registers a side effect with React's scheduler. The framework runs in the browser, reads what your code wants, and updates the real DOM. Vue works similarly with a `Proxy`-based reactivity model. Solid is signal-based but still ships a runtime that reads and writes signals. They're all libraries that do work at request time, paying a runtime cost on every state update.

Svelte reads your `.svelte` files at **build time**, generates JavaScript that directly manipulates the DOM, and ships a small (~5KB) runtime to coordinate things. The "framework" is mostly the compiled output of your own components. There's no virtual DOM diffing in the browser, because the compiler already knows which DOM nodes depend on which pieces of state — it emits update code per binding, statically. When you write `<span>&lbrace;count&rbrace;</span>` with `let count = $state(0)`, the compiler emits: "create a text node, set its content to the current `count`, register an update function that re-sets the content whenever `count` changes." No virtual node, no reconciliation, no diff.

### Why this matters

The architectural choice cascades into downstream consequences:

**Smaller bundles.** A "hello world" React app ships ~45KB of runtime before your code. A Svelte hello world ships ~5KB. As your app grows, both add code on top, but Svelte's floor is lower. For a marketing site loading on 3G, the difference is significant; for an internal admin app on gigabit fiber, it's invisible.

**Per-binding updates.** When you mutate state in Svelte, only the DOM bindings that depend on that state re-evaluate. React's `useState` triggers the whole component function to re-run, which reconciles its returned VDOM against the previous one. You notice the cost on big trees with frequent updates, and reach for `useMemo`, `useCallback`, `React.memo`, eventually the React Compiler. In the DAW this showed up concretely: dragging one mixer slider ran one `gain.rampTo` call, because the compiler knew only that one effect read that one piece of state. In React you'd memoize the slider, the mixer row, possibly the whole panel to get the same property.

**Things VDOM can't easily do.** Scoped CSS with zero runtime cost. Transitions that compose with conditionals — `&lbrace;#if&rbrace;` blocks declare enter/exit transitions and Svelte tracks them through the lifecycle. Per-cell reactivity in a 1000-cell grid without virtualization — each cell is its own bound expression; updating one doesn't touch the others.

**A smaller mental model.** React's hooks have rules (only at the top level, only in components, dependency arrays must list everything you read). `useEffect` semantics are notoriously hard to teach because the model isn't intuitive. Svelte's `$state` declares state, `$derived` computes from state, `$effect` reacts to state. The semantics map directly onto how you'd describe what you want.

### Why other people care less than they used to

The compiler-vs-runtime framing was historically Svelte's headline argument. In 2026 it's muddier — in a way good for Svelte's underlying point but bad for the marketing lever.

React Compiler auto-memoizes React components so you don't write `useMemo` and `useCallback` everywhere. It does at compile time what React used to require manually. It doesn't make React's bundle smaller, but it removes most of the "React forces you to babysit re-renders" complaint. Vue has had a template compiler since Vue 2. Solid has a compiler. Qwik has a compiler. The "Svelte uses a compiler, others don't" framing is false. What's true: **Svelte's compiler targets a smaller runtime**, because the framework was designed around the compiler from day one rather than bolting one on later.

> The real argument isn't "Svelte has a compiler." It's "Svelte's compiler targets a smaller runtime and produces tighter output because the whole framework was architected for it." Still a real advantage. Just less marketable than "compiler vs no compiler."

### Common misframings

- **"Svelte has no runtime."** False. The runtime is small (~5KB) but it exists. It handles the reactive graph, the scheduler, lifecycle hooks, and `bind:` machinery.
- **"React Compiler makes Svelte obsolete."** False. It addresses auto-memoization without addressing bundle size, single-file components, scoped CSS, two-way binding, or the smaller API surface. It closes a gap; not the gap.
- **"Compilers can't do what runtimes can."** Sometimes true historically. Concurrent rendering is hard to do purely at compile time. But that's a list of three or four things, not a generalization.

## Concept 3: Svelte 5 specifically

The version of Svelte you've been learning is Svelte 5, which shipped with runes (`$state`, `$derived`, `$effect`, `$props`, `$bindable`) replacing the Svelte 3/4 model of "let-as-reactive" assignments plus stores.

### What changed

In Svelte 3/4, a top-level `let count = 0` was reactive by default, you wrote `$: doubled = count * 2` for derived values, and stores lived in separate modules. The model was clever but had problems: reactivity was implicit and module-scoped (a `let` at component top was reactive; a `let` inside a function was not); stores and component state were different mental models; `$:` blocks had reordering rules that made debugging confusing.

Runes solve all three. `$state(0)` is reactive anywhere — inside a function, inside a `.svelte.ts` module. Component state and shared state both use `$state` (you learned this in M4 with the chord player's shared transport). `$derived` declares a computed value with no side effects; `$effect` runs side effects; the dependency graph is built by reads at runtime, not by source position.

The cost: more characters. `$state(0)` is longer than `let x = 0`. The loss in brevity is small, the gain in clarity is large.

### What runes look like coming from another framework

<RunesTranslation />

### What this means for choosing Svelte in 2026

If you're evaluating Svelte for a new project, you're evaluating Svelte 5. The Svelte 3/4 critiques don't apply. The 2026 mental model is signals (under a different name) with a thin reactive-template layer on top. A lot of "Svelte is weird" takes are pre-runes — check the date on anything that critiques Svelte's reactivity model; if it's from before late 2024, it probably doesn't apply.

## Concept 4: The interactive comparison

The comparison below shows the same small widget — a counter, a list, an input — in five frameworks. Toggle "Compare" to see all sources side-by-side; click each tab for per-framework discussion.

<FrameworkRace />

Spend a few minutes with this before reading on. The visual side-by-side conveys things prose can't. All five do essentially the same thing — the differences are about how the work is described, not what work is being done. That's the synthesis in a nutshell: framework choice is mostly a choice about which conventions you want to live inside, not which capabilities you get access to.

Two specific things to notice. **Reading state:** in Svelte, `count` is `count`; in React, the value half of a `useState` tuple; in Solid, `count()` with non-optional parens; in Vue, `count.value`. The number of characters you type to read a piece of state, in aggregate, is a real ergonomic difference. **Updating state:** `count++` (Svelte) vs `setCount(c => c + 1)` (React) vs `count.value++` (Vue) vs `setCount(count() + 1)` (Solid). Same operation, four shapes. Svelte wins on brevity; Solid wins on explicitness. Pick your taste.

## Concept 5: Svelte vs the alternatives

Now the framework-by-framework discussion. Each block follows the same shape — what the other framework wins on, what Svelte wins on, when to pick the other framework instead of Svelte.

### Svelte vs React

<VersusBlock other="React" tagline="the giant" color="var(--c-track-3)">
  {#snippet otherWins()}
    <ul>
      <li><strong>Ecosystem depth.</strong> Every UI primitive has a React implementation, usually three.</li>
      <li><strong>Hiring pool.</strong> Roughly 10x more React developers than Svelte.</li>
      <li><strong>React Native.</strong> No Svelte equivalent for native mobile. NativeScript-Svelte is small and not first-party.</li>
      <li><strong>Concurrent rendering.</strong> <code>useTransition</code>, <code>useDeferredValue</code>, Suspense are mature for very-large-tree scenarios.</li>
      <li><strong>Server Components.</strong> RSC is a real architectural advance for content-heavy apps blending server-rendered content with client-side interactivity.</li>
      <li><strong>Hosting tier-1 status.</strong> Vercel, Netlify, Cloudflare all support React first.</li>
    </ul>
  {/snippet}
  {#snippet svelteWins()}
    <ul>
      <li><strong>Bundle size.</strong> Smaller runtime, smaller compiled output per component.</li>
      <li><strong>No <code>useEffect</code> foot-cannons.</strong> Dependency-array discipline, cleanup-function timing, StrictMode double-render — gone.</li>
      <li><strong>Native two-way binding.</strong> <code>bind:value</code> is one keyword. React makes you wire <code>value</code> + <code>onChange</code> for every input.</li>
      <li><strong>Smaller mental surface.</strong> "I trained someone on Svelte in a week" is a common story; the React version usually means they wrote some components, not that they understand the framework.</li>
      <li><strong>Single-file components.</strong> Logic, markup, styles co-located.</li>
      <li><strong>Scoped CSS at zero cost.</strong> No CSS-in-JS runtime, no naming convention.</li>
      <li><strong>Per-binding updates without manual memoization.</strong> What React Compiler tries to give you, Svelte gives by default.</li>
    </ul>
  {/snippet}
  {#snippet note()}
    <p><strong>The convergence:</strong> React Compiler reduces the "babysit re-renders" complaint to a footnote. Hooks-vs-runes is increasingly the same idea in different syntaxes. The remaining differences are bundle size (Svelte will stay smaller), ecosystem depth (React will stay larger), and design-philosophy choices.</p>
  {/snippet}
  {#snippet whenOther()}
    <p>You need React Native; you depend on a React-only library (parts of the AI SDK ecosystem, certain data grids, some unported headless UI libraries); your team is deeply React and the switching cost isn't worth it; you specifically need RSC for content + interactivity; you're hiring at scale and labor-market math dominates.</p>
  {/snippet}
</VersusBlock>

### Svelte vs Vue

<VersusBlock other="Vue" tagline="the sibling" color="var(--c-track-4)">
  {#snippet otherWins()}
    <ul>
      <li><strong>Docs.</strong> The best docs in the JS ecosystem.</li>
      <li><strong>Formal LTS</strong> with clear upgrade paths.</li>
      <li><strong>Geography.</strong> Dominant in China and well-adopted in European enterprises (PayPal, Nintendo, GitLab).</li>
      <li><strong>Mature SFC tooling</strong> across editors.</li>
      <li><strong>Nuxt</strong> is older and more featureful than SvelteKit in some dimensions — built-in i18n, image optimization, content modules.</li>
    </ul>
  {/snippet}
  {#snippet svelteWins()}
    <ul>
      <li><strong>Tighter syntax.</strong> Vue's <code>count.value++</code> vs Svelte's <code>count++</code>.</li>
      <li><strong>Smaller bundle.</strong> ~25KB vs ~5KB.</li>
      <li><strong>Compiles more aggressively.</strong></li>
      <li><strong>Fewer template surface conventions</strong> to memorize (<code>&lbrace;#if&rbrace;</code> vs <code>v-if</code> / <code>:value</code> / <code>@click</code>).</li>
    </ul>
  {/snippet}
  {#snippet note()}
    <p><strong>Honest assessment:</strong> Vue and Svelte make similar architectural bets with slightly different specific choices. Both are technically excellent. Personal preference dominates. I find Svelte's syntax tighter; I find Vue's docs better. Net wash.</p>
  {/snippet}
  {#snippet whenOther()}
    <p>You're in a market where Vue's hiring pool is significantly larger; you need Nuxt-specific features SvelteKit doesn't ship; your team is already Vue.</p>
  {/snippet}
</VersusBlock>

### Svelte vs Solid

<VersusBlock other="Solid" tagline="the purist" color="var(--c-track-7)">
  {#snippet otherWins()}
    <ul>
      <li><strong>No compiler magic in script.</strong> The <code>&lt;script&gt;</code> is just JS; only JSX is compiled.</li>
      <li><strong>JSX</strong> — familiar from React.</li>
      <li><strong>Philosophical purity</strong> in the reactivity model.</li>
      <li><strong>Even smaller runtime</strong> (~3KB).</li>
    </ul>
  {/snippet}
  {#snippet svelteWins()}
    <ul>
      <li><strong>Tighter syntax.</strong> <code>count</code> vs <code>count()</code>.</li>
      <li><strong>Single-file components</strong> with scoped CSS instead of CSS modules.</li>
      <li><strong>More mature meta-framework</strong> (SvelteKit vs SolidStart).</li>
      <li><strong>Larger community.</strong></li>
    </ul>
  {/snippet}
  {#snippet note()}
    <p><strong>Both versus React:</strong> signal-based reactivity, per-binding updates, no component re-runs. If you ask "should I learn React or Svelte/Solid?" they're both on the "or" side, not the "and."</p>
  {/snippet}
  {#snippet whenOther()}
    <p>You have a strong preference for the explicit-signal model (the <code>()</code> is a feature, not a cost); the absolute smallest runtime matters more than ecosystem maturity; you specifically want JSX without React's baggage.</p>
  {/snippet}
</VersusBlock>

### Svelte vs Qwik

<VersusBlock other="Qwik" tagline="the specialist" color="var(--c-track-5)">
  {#snippet otherWins()}
    <ul>
      <li><strong>Extreme first-paint optimization.</strong> "Resumability" serializes the component tree to HTML at build time and streams JS handlers in only on interaction.</li>
      <li><strong>Faster than hydration</strong> for content-heavy sites with slow-network audiences.</li>
    </ul>
  {/snippet}
  {#snippet svelteWins()}
    <ul>
      <li><strong>Much smaller mental model.</strong> Qwik's resumability constraints leak — you think about QRL-serialization, event handlers wrap with <code>$()</code>, imports split across framework-chosen boundaries.</li>
      <li><strong>App-shape fit.</strong> The DAW you built is an app, not a content site; Qwik's optimization is wrong for it. No benefit to deferring JS for an app the user will use heavily for thirty minutes.</li>
    </ul>
  {/snippet}
  {#snippet whenOther()}
    <p>Content-heavy site (marketing, docs, e-commerce listing pages) with slow-network audiences where first-paint latency dominates. For app-shaped projects, Qwik's optimization isn't relevant and its constraints are.</p>
  {/snippet}
</VersusBlock>

### Svelte vs Astro

A different shape of comparison — Astro isn't a SPA framework, it's a content-site framework with islands.

<VersusBlock other="Astro" tagline="the content-site" color="var(--c-track-8)">
  {#snippet otherWins()}
    <ul>
      <li><strong>Zero JS by default.</strong> Genuinely zero — until you add an island.</li>
      <li><strong>Multi-framework islands.</strong> Svelte, React, Vue, Solid, or Preact within the same site.</li>
      <li><strong>First-class Markdown/MDX</strong> with type-safe frontmatter and built-in image optimization.</li>
    </ul>
  {/snippet}
  {#snippet svelteWins()}
    <ul>
      <li><strong>App-shape fit.</strong> When the whole app is interactive, the islands model is overhead — every piece needs a "hydrate this" directive.</li>
      <li><strong>SvelteKit's "everything is a Svelte page"</strong> is cleaner for apps.</li>
      <li><strong>Global state across pages.</strong> The DAW would be miserable in Astro — every interactive piece would need a hydration directive and global state wouldn't naturally cross page boundaries.</li>
    </ul>
  {/snippet}
  {#snippet note()}
    <p>Astro and SvelteKit are tools for different shapes of project. They don't compete directly — they compose. Many people use Astro for the marketing site and SvelteKit for the app.</p>
  {/snippet}
</VersusBlock>

### Svelte vs Angular

<VersusBlock other="Angular" tagline="the enterprise" color="var(--c-track-10)">
  {#snippet otherWins()}
    <ul>
      <li><strong>Opinionated structure</strong> at the project level.</li>
      <li><strong>TypeScript-first since day one.</strong></li>
      <li><strong>Dependency injection</strong> as a first-class concept.</li>
      <li><strong>RxJS</strong> for complex async.</li>
      <li><strong>Full-stack tooling</strong> with long-term support.</li>
    </ul>
  {/snippet}
  {#snippet svelteWins()}
    <ul>
      <li><strong>Dramatically smaller.</strong></li>
      <li><strong>Dramatically faster to learn.</strong></li>
      <li><strong>Dramatically less ceremony.</strong></li>
    </ul>
  {/snippet}
  {#snippet whenOther()}
    <p>You're in an enterprise that already has Angular shops and consistency benefits dominate, or your team knows RxJS deeply and needs its specific async primitives.</p>
  {/snippet}
</VersusBlock>

## Concept 6: The comparison matrix

The same comparison, pivoted. Toggle between **By framework** (a card per framework, all stats inside) and **By dimension** (each dimension showing all six frameworks ranked visually). Use this as the page you bookmark and come back to.

<ComparisonMatrix />

## Concept 7: When to pick Svelte, when not to

Stripping the comparisons to decision rules:

<DecisionRules />

These are decision rules, not tribal preferences. Apply them honestly and you'll recommend React for some projects, Svelte for others — which is the right answer.

## Concept 8: Three myths to update

If you've encountered Svelte criticism in the wild, some of it is out of date in 2026.

<MythGrid myths={[
  { n: 1, claim: 'Svelte\'s reactivity is implicit and confusing', verdict: 'Out of date', body: mythBodyOne },
  { n: 2, claim: 'Svelte\'s compiler is the only thing it has, and everyone has compilers now', verdict: 'Half-true', body: mythBodyTwo },
  { n: 3, claim: 'Svelte\'s ecosystem is tiny and you\'ll hit walls', verdict: 'Localized', body: mythBodyThree },
]} />

{#snippet mythBodyOne()}

True for Svelte 3 and 4. Their model — top-level `let` is reactive, but only in components, and `$:` had ordering rules — was learnable but full of gotchas. In Svelte 5 with runes, reactivity is explicit. `$state(0)` is reactive; nothing else is. Same model as Solid's signals and Vue's refs, with tighter syntax.

If someone repeats this critique, ask if they've used Svelte 5. Most "Svelte reactivity is weird" takes are pre-runes and the person hasn't updated their mental model. Be polite about it; the migration window was long and a lot of people held off learning Svelte 5 because Svelte 4 was working fine for them.

{/snippet}

{#snippet mythBodyTwo()}

The compiler is the most marketable advantage, but it's not the only one. The runtime is genuinely much smaller; that doesn't change when React Compiler ships, because React Compiler doesn't shrink the runtime. The mental surface is genuinely smaller; that's a design choice, not a compiler feature. The single-file component pattern is genuinely tighter; that's a file-format choice. Two-way binding with `bind:` is a syntax choice independent of the compiler.

The convergence makes the headline weaker. The underlying advantages survive.

{/snippet}

{#snippet mythBodyThree()}

Smaller than React's, yes — unlikely to change. But medium-sized, not tiny. Mature options exist for most categories: UI libraries (Bits UI, Skeleton, Flowbite, shadcn-svelte); animation (`svelte/transition`, `svelte/motion`, Threlte for 3D); data fetching (SvelteKit's native `load`, svelte-query); forms (Superforms, Formsnap — one of Svelte's stronger stories); charts (Chart.js wrappers, Layer Cake, Pancake); state management (runes + `.svelte.ts` modules, XState wrapper for complex machines); backend (SvelteKit form actions + `+server.ts`, tRPC, Prisma, Drizzle); auth (Auth.js, Lucia); CMS (Sanity, Contentful, Strapi).

You'll hit walls in specialized niches — a particular data grid, a video editor SDK, an obscure analytics widget. For typical web apps, you won't. The risk is real but localized; budget for a one-week "port the missing piece" task if you're worried.

{/snippet}

## Concept 9: What to say when someone asks

The 60-second pitch, broken down into the move each paragraph is making. Don't memorize the words; learn the shape, then rephrase in your own voice. Toggle between length variants for the elevator answer and the one-sentence version.

<PitchCard />

The pitch doesn't say "Svelte is better." It says "here's when Svelte is the right call and here's when it isn't." That's the framing that lands with anyone whose job involves picking technologies.

## Concept 10: What the curriculum was actually teaching

Looking back at eight modules, the through-line wasn't "syntax of Svelte." It was: **how reactive UI frameworks think, with Svelte as the working example.**

Modules 1-2 introduced reactivity primitives and the SFC model — concepts that transfer directly to React's hooks/components, Vue's refs/SFCs, Solid's signals/JSX. The mental model of "state is the source of truth, the view is a function of state, updates flow one way" is identical across all of them.

Modules 3-4 added composition, props, motion, shared state. Same concepts everywhere, slightly different names. Module 5 stepped up to filesystem routing, load functions, render modes, deployment — and the patterns are nearly identical in Next.js, Nuxt, SolidStart, Qwik City. If you understand SvelteKit's `+page.ts`, you understand Next's `getServerSideProps` (now mostly RSC) and Nuxt's `useAsyncData`. The labels change; the shape doesn't. Modules 6-7 built a real app with audio, persistence, recording, sharing — and the challenges (Web Audio's gesture requirement, IndexedDB schemas, sample-accurate scheduling) are framework-independent. Svelte just got out of the way.

> If you handed this curriculum to someone learning React or Vue, they'd recognize 80% of it. The framework-specific 20% is what changes. **You learned Svelte, but you mostly learned reactive UI development.**

The transferable skill is much bigger than the framework slot it lives in. Picking up React or Solid or Qwik later is a couple of weeks, not months.

## Putting it together

Three questions the synthesis should let you answer cleanly.

<BigAnswers items={[
  { q: 'What\'s actually special about Svelte?', tag: 'the architecture', a: answerOne },
  { q: 'When would you not use it?', tag: 'the no-go list', a: answerTwo },
  { q: 'What\'s the honest comparison to React?', tag: 'the convergence', a: answerThree },
]} />

{#snippet answerOne()}

It's a compiler-first framework. The compiler reads `.svelte` files at build time and emits JavaScript that touches the DOM directly with reactivity wired in at compile time. Small runtime (~5KB), per-binding updates with no manual memoization, scoped CSS at zero runtime cost, smaller mental surface than runtime-first frameworks.

{/snippet}

{#snippet answerTwo()}

When you need React Native; when you depend on a React-only library you can't replace; when team React investment dominates the velocity gain; when you need a much larger hiring pool; when the project is primarily a content site (Astro fits better); when first-paint on slow networks dominates (Qwik fits better).

{/snippet}

{#snippet answerThree()}

React has ecosystem depth, hiring scale, React Native, mature concurrent rendering, and a real RSC story. Svelte has smaller bundles, simpler effect semantics, native two-way binding, single-file components, scoped CSS, and a smaller mental footprint. React Compiler is closing the auto-memoization gap. After convergence, the remaining differences are bundle size (Svelte) and ecosystem depth (React). For most greenfield projects under five engineers, Svelte is the cleaner choice. For team-scale or library-dependent work, React often wins.

{/snippet}

These are the answers you should be able to give out loud, calibrated to the listener, in seconds. The body of this lesson is the long version; what you carry around is the short version.

## Exercises

Unlike the rest of the course, these exercises are about articulation, not code. The skill you're building here is the ability to defend a position. Articulation is a skill that practice improves — the first time you write a tech-stack-selection email it'll be wooden; the third time it'll be sharp.

<ExerciseDeck items={[
  {
    n: '1',
    title: 'The tech-stack-selection email',
    setup: 'A small startup (5 engineers) is choosing the frontend framework for a new SaaS. Web app, data-rich (charts, tables, forms), modern browsers, scaling to a few thousand users in year one.',
    task: 'Write a one-page email to the tech lead recommending a framework. Argue for Svelte. Name the trade-offs honestly. Anticipate the React partisan\'s objections.',
    verify: 'The email could be sent to a real tech lead without embarrassment. Names at least two reasons React might be right instead.',
    solution: exSol1,
  },
  {
    n: '2',
    title: 'The 30-second elevator answer',
    setup: 'Conference, someone asks "I keep hearing about Svelte. Should I learn it?"',
    task: 'Write the answer you\'d actually give, out loud, in 30 seconds. No marketing voice. Read it aloud to verify the length.',
    verify: '~90 words. Includes one concrete strength, one trade-off, one decision rule.',
    solution: exSol2,
  },
  {
    n: '3',
    title: 'Argue the opposite case',
    setup: 'Someone asks "I\'m thinking of switching from React to Svelte. Convince me not to."',
    task: 'Write a 90-second argument for staying on React. You don\'t believe it fully, but you can articulate the case honestly.',
    verify: 'Names at least three concrete reasons that aren\'t tribal preference. A React partisan would feel represented.',
    solution: exSol3,
  },
  {
    n: '4',
    title: 'Read the Svelte source',
    setup: 'The Svelte GitHub repo.',
    task: 'Open packages/svelte/src/internal/client/runtime.js. Read through it — ~1000 lines of well-commented signal-graph implementation. Don\'t try to understand every line. Try to understand: how $state creates a reactive value, how $effect registers and re-runs, how dependencies are tracked (look for active_reaction and track).',
    verify: 'You can describe in two sentences how Svelte\'s reactivity works under the hood. Bonus: explain why $effect reads dependencies eagerly and what breaks if it doesn\'t.',
    solution: exSol4,
  },
  {
    n: '5',
    title: 'Contribute to a Svelte library',
    setup: 'Any Svelte library you\'d reach for. Bits UI, Threlte, Superforms, Skeleton, MDsveX, svelte-query.',
    task: 'Find an open issue labeled good first issue. Read the code. Submit a PR. Or write a doc fix. Or report a bug with a minimal reproduction.',
    verify: 'Your contribution is open as a PR. The Svelte community is small enough that contributions land quickly.',
    stretch: 'Find an integration gap and ship a small wrapper. The bar for the svelte- npm namespace is lower than you\'d expect.',
    solution: exSol5,
  },
  {
    n: '6',
    title: 'Ship something you\'d actually use',
    setup: 'A problem you have, currently solved with a hacky workaround.',
    task: 'Build a small Svelte tool that solves it. Deploy it. Use it for a month. Iterate based on what annoys you when you use it.',
    verify: 'You actually use the tool. After a month, it\'s at least one feature past day-one.',
    solution: exSol6,
  },
]} />

{#snippet exSol1()}

A strong version would: open with the recommendation in one sentence; name three concrete reasons matching project needs (small team, web-only, data-rich UI benefiting from per-binding updates, fast first-visit load); acknowledge the team-size risk and mitigate it (Svelte is faster to learn; 5-person team isn't where React's scale advantage matters); name two scenarios where the recommendation flips (native mobile within 18 months, heavy React-only AI SDK integration); close with "happy to walk through this in more detail."

A pitch that names downsides is more credible than one that doesn't. A skeptical tech lead respects "here are the cases where I'd flip" more than "Svelte is the answer for everything."

{/snippet}

{#snippet exSol2()}

One version (~85 words):

> Svelte is a compile-first reactive framework. The compiler does most of the work at build time, so the runtime is small — about 5KB — and you get per-binding updates without manual memoization. The mental model is smaller than React's; you can learn it in a couple of weeks if you know any reactive framework. The trade-off is a smaller ecosystem and hiring pool. For greenfield personal projects or small teams, I'd reach for it first. For an existing React shop, probably not.

Yours will sound different. The shape — what it is, what it's good at, what the trade-off is, when to pick it — is what matters.

{/snippet}

{#snippet exSol3()}

One version (~150 words):

> If you're already productive in React, the switching cost is real. You'd lose six months to a year of muscle memory, and the velocity gain in Svelte doesn't fully pay back until you've internalized the new patterns. If your team is hiring, React's labor pool is roughly 10x larger — you can staff faster, lose someone without panicking, find consultants who already know the stack. If you depend on React Native for mobile, there's no equivalent. If your work is built around RSC or React-only libraries like the Vercel AI SDK, the migration would be more than a port. Svelte is smaller, simpler, ships less JS — real wins. Not always large enough to justify rewriting working code or moving away from a labor market that runs on React.

The ability to argue the opposite case is what separates an informed advocate from a partisan.

{/snippet}

{#snippet exSol4()}

Each `$state` is a "source" with a list of subscribers. Reading a source while inside an active reaction registers the source as a dependency. Writing to a source schedules its subscribers to re-run. The scheduler batches updates within a microtask so multiple writes in the same tick trigger one re-render.

Effects read eagerly so the tracker knows what to subscribe to. Lazy reads inside conditionals would miss dependencies on the first run and the effect would never re-fire — exactly the bug the M6 audio engine work warns against.

{/snippet}

{#snippet exSol5()}

The first contribution is the hardest. Picking a library you actually use (not a famous one you don't) makes it much easier — you know what's broken because you've hit it.

{/snippet}

{#snippet exSol6()}

No solution. The exercise is the rest of your career.

{/snippet}

## Checkpoint

<Checklist />

### What you couldn't do 35 lessons ago

Worth being explicit, because the gap is easy to forget once you've crossed it: you couldn't write a Svelte component from a blank editor, explain what `$state` does, ship a SvelteKit app to a public URL, build a sequencer that schedules audio accurately, pre-warm a Web Audio context for mobile Safari, write a GitHub Pages deploy workflow with the SPA fallback hack, compare Svelte to React, Vue, Solid, Qwik, and Astro with specific decision rules, or tell someone "I shipped a DAW" and back it up with a URL. Now you can.

### Compare against the reference

The reference repo is a finished product at this point. There's nothing to compare for this lesson — you're past the code, into the meta. The repo's commit history is the comparison.

## Common questions

<FaqList items={[
  { q: 'Is Svelte going to be around in five years?', a: faqA1 },
  { q: 'Should I learn React after Svelte if I\'m looking for a job?', a: faqA2 },
  { q: 'What about web components / Lit / Stencil?', a: faqA3 },
  { q: 'When does it make sense to use Svelte without SvelteKit?', a: faqA4 },
  { q: 'I want to build a mobile app. What\'s the closest Svelte equivalent to React Native?', a: faqA5 },
  { q: 'Is there a Svelte equivalent of React Server Components?', a: faqA6 },
  { q: 'What if my team objects "Svelte is just a passing trend"?', a: faqA7 },
  { q: 'What\'s the one thing that would change my mind about Svelte?', a: faqA8 },
]} />

{#snippet faqA1()}

Almost certainly yes. Vercel-funded since 2021. Svelte 5 landed on solid foundations. Corporate users (Apple, Cloudflare, IBM, IKEA) substantial enough that continuity is a business concern. If Svelte died tomorrow, the migration path to Solid or Vue 3 is short — same signal-based mental model.

{/snippet}

{#snippet faqA2()}

Yes — but the cost is low because most of what you know transfers. React's hooks are weirder than runes; the dependency-array discipline takes some unlearning. Two weeks shipping a small React project and you'll interview competently. Svelte experience is a tiebreaker because it shows breadth.

{/snippet}

{#snippet faqA3()}

Web components are a browser-native primitive; Svelte can compile to them with `<svelte:options customElement>`. For cross-framework component libraries, that's the answer. For application development, frameworks above are better fits — web components don't give you routing or state management.

{/snippet}

{#snippet faqA4()}

Two cases. Adding Svelte components to an existing app in another framework (use `@sveltejs/vite-plugin-svelte` directly). Or shipping a compiled component library. For new applications, default to SvelteKit.

{/snippet}

{#snippet faqA5()}

NativeScript-Svelte exists but is small. The honest answer: React Native, Flutter, or Capacitor (web app wrapped in a native shell — works fine with SvelteKit). If native is a hard requirement driving architecture, Svelte isn't the strongest answer in 2026.

{/snippet}

{#snippet faqA6()}

SvelteKit's load functions plus `+page.server.ts` plus form actions cover most of the same use cases, with simpler semantics. For very content-heavy apps benefiting from RSC's streaming model specifically, React still wins on this dimension.

{/snippet}

{#snippet faqA7()}

Continuous active development since 2016, corporate backing, stable major version, users at scale. If the real concern is "I don't want to bet on a smaller ecosystem," answer that directly with the labor-market and library-availability arguments, not a defense of Svelte's permanence.

{/snippet}

{#snippet faqA8()}

React Native support at first-party polish. If a "Svelte Native" landed with the maturity React Native has, the calculus tilts further toward Svelte for cross-platform apps. As of 2026 that doesn't exist.

{/snippet}

## What's next

You've finished the curriculum. The next-best things to do:

<WhatsNextGrid />

The curriculum is done. The framework is yours. The DAW is on a public URL, recording patterns and producing shareable links. The opinion is formed and defensible. The skill is transferable. Build something.

— end of curriculum —

<SourcesSection lessonKey="08-ship-and-synthesis/03-synthesis" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
