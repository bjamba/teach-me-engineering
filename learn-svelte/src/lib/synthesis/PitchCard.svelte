<!--
  The 60-second pitch as an annotated card: the script on the left, what
  each paragraph is doing on the right. Underneath: collapsed 30s and 10s
  variants.
-->
<script lang="ts">
  let openVariant = $state<'60' | '30' | '10'>('60');

  const annotations = [
    { tag: 'WHAT',     note: 'Names the architecture (compiler) and what it produces.' },
    { tag: 'HOW',      note: 'Names the reactivity model accurately — signals, per-binding, auto-tracked.' },
    { tag: 'COST',     note: 'Doesn’t oversell. The trade-offs land first because they make the wins credible.' },
    { tag: 'RULE',     note: 'Specific decision rules, not a general endorsement.' },
    { tag: 'HONEST',   note: 'Ends with “depends on the project.” The framing that lands with anyone whose job involves picking technologies.' },
  ];

  const paras = [
    `Svelte is a UI framework with a compile step. The thing you write is a .svelte file that mixes script, markup, and styles. The thing that ships is plain JavaScript that touches the DOM directly with reactivity wired up at compile time.`,
    `The reactivity model is signal-based — you declare state with $state(...), derived values with $derived(...), side effects with $effect(...). The runtime tracks dependencies automatically. Updates fire per-binding instead of re-running components. The runtime is small (~5KB), the bundle is meaningfully smaller than React's, the API is small enough to fit in your head.`,
    `The trade-offs are real. The ecosystem is smaller than React's, so you'll occasionally find that a specialized library you'd reach for in React doesn't have a Svelte equivalent. There's no React Native equivalent for native mobile. The hiring pool is roughly 10x smaller, which matters when you're staffing fast.`,
    `For greenfield projects where you value developer velocity and small bundles and your app is web-only, Svelte is the cleanest answer I know. For projects with specific React dependencies — React Native, a React-only library you can't replace, an existing React team where switching cost dominates — sticking with React is the right call.`,
    `The framework I'd reach for first depends on the project. Svelte for personal projects, side projects, small-team work, content sites, audio/visual apps where the bundle size compounds. React for anything that needs React Native, or where the team's React investment is large.`,
  ];

  const short30 = `Svelte's a reactive UI framework. The compiler does most of the work at build time, so the runtime is small — about 5KB — and you get per-binding updates without manual memoization. Smaller mental model than React, faster to learn. Trade-off is a smaller ecosystem and hiring pool. For greenfield personal projects or small teams, I'd reach for it first. For an existing React shop, probably not.`;

  const short10 = `It's React with a compiler instead of a runtime. Smaller bundles, simpler effects, smaller ecosystem. I like it for side projects.`;
</script>

<aside class="pitch">
  <header class="pitch-head">
    <div class="pitch-meta">
      <span class="pitch-label">The 60-second pitch</span>
      <span class="pitch-sub">delivery shape, not a script to memorize</span>
    </div>
    <div class="len-tabs" role="tablist" aria-label="Pitch length">
      <button class="len" class:active={openVariant === '60'} onclick={() => (openVariant = '60')}>60s</button>
      <button class="len" class:active={openVariant === '30'} onclick={() => (openVariant = '30')}>30s</button>
      <button class="len" class:active={openVariant === '10'} onclick={() => (openVariant = '10')}>10s</button>
    </div>
  </header>

  {#if openVariant === '60'}
    <div class="long">
      {#each paras as p, i}
        <div class="row">
          <span class="tag-col">
            <span class="tag">{annotations[i].tag}</span>
          </span>
          <p class="para">{p}</p>
          <span class="anno">{annotations[i].note}</span>
        </div>
      {/each}
    </div>
  {:else if openVariant === '30'}
    <div class="short">
      <p>{short30}</p>
      <ul class="short-anno">
        <li><span class="tag">WHAT</span> compile-first + small runtime</li>
        <li><span class="tag">HOW</span> per-binding, no manual memoization</li>
        <li><span class="tag">COST</span> ecosystem + hiring</li>
        <li><span class="tag">RULE</span> greenfield small-team / not an existing React shop</li>
      </ul>
    </div>
  {:else}
    <div class="short">
      <p class="ten">{short10}</p>
      <div class="ten-note">Inaccurate in detail. Conveys the gist in a sentence the listener can hold in working memory.</div>
    </div>
  {/if}
</aside>

<style>
  .pitch {
    margin: var(--sp-5) 0;
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-md);
    background: var(--c-card);
    overflow: hidden;
  }
  .pitch-head {
    padding: var(--sp-3) var(--sp-4);
    background: color-mix(in srgb, var(--c-surface) 50%, transparent);
    border-bottom: 1px solid var(--c-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .pitch-meta { display: flex; flex-direction: column; gap: 2px; }
  .pitch-label {
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--c-track, var(--c-accent));
    font-weight: 700;
  }
  .pitch-sub { color: var(--c-text-muted); font-size: var(--fs-sm); }

  .len-tabs {
    display: inline-flex;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    padding: 2px;
    gap: 2px;
  }
  .len {
    appearance: none;
    background: transparent;
    border: none;
    color: var(--c-text-muted);
    padding: 5px 12px;
    border-radius: var(--r-sm);
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    letter-spacing: 0.08em;
    cursor: pointer;
  }
  .len:hover { color: var(--c-text); }
  .len.active {
    background: var(--c-surface);
    color: var(--c-track, var(--c-accent));
    box-shadow: 0 0 0 1px var(--c-border-strong) inset;
  }

  .long {
    padding: var(--sp-4);
    display: grid;
    gap: var(--sp-4);
  }
  .row {
    display: grid;
    grid-template-columns: 64px 1fr 200px;
    gap: var(--sp-3);
    align-items: start;
  }
  .tag-col { padding-top: 4px; }
  .tag {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 999px;
    font-family: var(--font-lcd);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: color-mix(in srgb, var(--c-track, var(--c-accent)) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-track, var(--c-accent)) 40%, transparent);
    color: var(--c-track, var(--c-accent));
    font-weight: 700;
  }
  .para {
    margin: 0;
    padding-left: var(--sp-3);
    border-left: 2px solid color-mix(in srgb, var(--c-track, var(--c-accent)) 30%, transparent);
    color: var(--c-text);
    font-size: var(--fs-md);
    line-height: 1.6;
    font-style: italic;
  }
  .anno {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    line-height: 1.55;
    padding-top: 4px;
  }

  .short { padding: var(--sp-4); }
  .short p {
    margin: 0 0 var(--sp-3);
    color: var(--c-text);
    font-size: var(--fs-md);
    line-height: 1.6;
    padding-left: var(--sp-3);
    border-left: 2px solid color-mix(in srgb, var(--c-track, var(--c-accent)) 30%, transparent);
    font-style: italic;
  }
  .short p.ten { font-size: var(--fs-lg); }
  .ten-note { color: var(--c-text-muted); font-size: var(--fs-sm); }
  .short-anno {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--sp-2);
  }
  .short-anno li {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }

  @media (max-width: 720px) {
    .row { grid-template-columns: 56px 1fr; }
    .anno {
      grid-column: 1 / -1;
      padding-left: calc(56px + var(--sp-3));
      padding-top: 0;
      margin-top: -8px;
    }
  }
</style>
