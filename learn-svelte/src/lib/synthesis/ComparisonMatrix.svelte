<!--
  Replacement for the 7-column markdown table that gets crushed inside
  64ch prose width. Two views switchable via a tab strip:

    1. "By framework" — card grid (one card per framework, all stats inside).
    2. "By dimension" — for each dimension, a small visual comparing the six.

  The data lives at the top so the surrounding prose can stay short and the
  reader can use this section as a reference page.
-->
<script lang="ts">
  type FW = 'svelte' | 'react' | 'vue' | 'solid' | 'qwik' | 'astro';

  type Framework = {
    id: FW;
    name: string;
    color: string;
    /** Approx runtime baseline, gzipped. Teaching-grade only. */
    sizeKb: number;
    /** Approx label for the runtime number. */
    sizeLabel: string;
    reactivity: string;
    mentalSurface: 'small' | 'medium' | 'medium-large' | 'large';
    /** 1..5 — relative ecosystem depth, for visual dots. */
    ecosystem: 1 | 2 | 3 | 4 | 5;
    /** 1..5 — hiring pool. */
    hiring: 1 | 2 | 3 | 4 | 5;
    nativeMobile: 'first-party' | 'community' | 'none';
    metaFramework: string;
    twoWay: 'native' | 'partial' | 'manual' | 'per-island';
    scopedCss: 'native' | 'community' | 'per-island';
    bestAt: string;
    worstAt: string;
  };

  const frameworks: Framework[] = [
    {
      id: 'svelte', name: 'Svelte', color: 'var(--c-track-1)',
      sizeKb: 5, sizeLabel: '~5 KB',
      reactivity: 'Signals (runes)',
      mentalSurface: 'small', ecosystem: 3, hiring: 3,
      nativeMobile: 'community',
      metaFramework: 'SvelteKit',
      twoWay: 'native', scopedCss: 'native',
      bestAt: 'Apps + content, small bundles, low ceremony',
      worstAt: 'React-only libraries, native mobile',
    },
    {
      id: 'react', name: 'React', color: 'var(--c-track-3)',
      sizeKb: 45, sizeLabel: '~45 KB',
      reactivity: 'Hooks',
      mentalSurface: 'large', ecosystem: 5, hiring: 5,
      nativeMobile: 'first-party',
      metaFramework: 'Next / Remix',
      twoWay: 'manual', scopedCss: 'community',
      bestAt: 'Anything; large teams + native mobile',
      worstAt: 'Bundle size, useEffect',
    },
    {
      id: 'vue', name: 'Vue', color: 'var(--c-track-4)',
      sizeKb: 25, sizeLabel: '~25 KB',
      reactivity: 'Refs (signals)',
      mentalSurface: 'medium', ecosystem: 4, hiring: 4,
      nativeMobile: 'community',
      metaFramework: 'Nuxt',
      twoWay: 'native', scopedCss: 'native',
      bestAt: 'Anything; SFCs done well',
      worstAt: 'Lock-in concerns (less than React)',
    },
    {
      id: 'solid', name: 'Solid', color: 'var(--c-track-7)',
      sizeKb: 3, sizeLabel: '~3 KB',
      reactivity: 'Signals',
      mentalSurface: 'small', ecosystem: 2, hiring: 2,
      nativeMobile: 'none',
      metaFramework: 'SolidStart',
      twoWay: 'manual', scopedCss: 'community',
      bestAt: 'Pure signal model, JSX without React',
      worstAt: 'Ecosystem depth',
    },
    {
      id: 'qwik', name: 'Qwik', color: 'var(--c-track-5)',
      sizeKb: 1, sizeLabel: '~1 KB (resumable)',
      reactivity: 'Signals',
      mentalSurface: 'medium-large', ecosystem: 2, hiring: 1,
      nativeMobile: 'none',
      metaFramework: 'Qwik City',
      twoWay: 'manual', scopedCss: 'community',
      bestAt: 'Content sites with slow-network audiences',
      worstAt: 'App-shaped UIs',
    },
    {
      id: 'astro', name: 'Astro', color: 'var(--c-track-8)',
      sizeKb: 0, sizeLabel: '0 KB (no islands)',
      reactivity: 'Per-island',
      mentalSurface: 'small', ecosystem: 3, hiring: 2,
      nativeMobile: 'none',
      metaFramework: 'Astro itself',
      twoWay: 'per-island', scopedCss: 'native',
      bestAt: 'Content sites, blogs, docs',
      worstAt: 'App-shaped UIs',
    },
  ];

  const maxKb = 45; // for size-bar scaling

  type ViewMode = 'by-framework' | 'by-dimension';
  let view = $state<ViewMode>('by-framework');

  type Dimension =
    | 'size'
    | 'mental'
    | 'ecosystem'
    | 'hiring'
    | 'mobile'
    | 'twoWay'
    | 'scopedCss'
    | 'bestAt'
    | 'worstAt';

  const dimensions: { id: Dimension; label: string; sub: string }[] = [
    { id: 'size',       label: 'Runtime size',     sub: 'gzipped baseline' },
    { id: 'mental',     label: 'Mental surface',   sub: 'how much to learn' },
    { id: 'ecosystem',  label: 'Ecosystem depth',  sub: 'libraries available' },
    { id: 'hiring',     label: 'Hiring pool',      sub: 'developers in market' },
    { id: 'mobile',     label: 'Native mobile',    sub: 'iOS / Android renderer' },
    { id: 'twoWay',     label: 'Two-way binding',  sub: 'forms, inputs' },
    { id: 'scopedCss',  label: 'Scoped CSS',       sub: 'styles per component' },
    { id: 'bestAt',     label: 'Best at',          sub: 'the project shape that fits' },
    { id: 'worstAt',    label: 'Worst at',         sub: 'where it gets uncomfortable' },
  ];

  const surfaceLabel: Record<string, string> = {
    small: 'Small', medium: 'Medium', 'medium-large': 'Medium-large', large: 'Large',
  };
  const mobileLabel: Record<string, string> = {
    'first-party': 'React Native', community: 'Community port', none: '—',
  };
  const twoWayLabel: Record<string, string> = {
    native: 'Native (bind:)', partial: 'Partial', manual: 'Manual wiring', 'per-island': 'Per island',
  };
  const cssLabel: Record<string, string> = {
    native: 'Built-in', community: 'CSS Modules / lib', 'per-island': 'Per island',
  };
</script>

<section class="matrix">
  <header class="head">
    <div class="head-left">
      <span class="head-label">Comparison matrix</span>
      <span class="head-sub">Approximate. Teaching-grade, not benchmark-grade.</span>
    </div>
    <div class="tabs" role="tablist" aria-label="View mode">
      <button
        class="tab"
        class:active={view === 'by-framework'}
        role="tab"
        aria-selected={view === 'by-framework'}
        onclick={() => (view = 'by-framework')}
      >By framework</button>
      <button
        class="tab"
        class:active={view === 'by-dimension'}
        role="tab"
        aria-selected={view === 'by-dimension'}
        onclick={() => (view = 'by-dimension')}
      >By dimension</button>
    </div>
  </header>

  {#if view === 'by-framework'}
    <div class="grid">
      {#each frameworks as f}
        <article class="card" style="--c-fw: {f.color}">
          <header class="card-head">
            <span class="card-dot" aria-hidden="true"></span>
            <span class="card-name">{f.name}</span>
            <span class="card-size lcd">{f.sizeLabel}</span>
          </header>

          <div class="bar-wrap" aria-label="Runtime size relative to React's ~45KB baseline">
            <div class="bar" style="width: {(f.sizeKb / maxKb) * 100}%;"></div>
          </div>

          <dl class="stats">
            <div class="stat">
              <dt>Reactivity</dt>
              <dd>{f.reactivity}</dd>
            </div>
            <div class="stat">
              <dt>Mental surface</dt>
              <dd>{surfaceLabel[f.mentalSurface]}</dd>
            </div>
            <div class="stat">
              <dt>Ecosystem</dt>
              <dd>
                <span class="dots" aria-label="{f.ecosystem} of 5">
                  {#each Array(5) as _, i}<span class="dot" class:on={i < f.ecosystem}></span>{/each}
                </span>
              </dd>
            </div>
            <div class="stat">
              <dt>Hiring pool</dt>
              <dd>
                <span class="dots" aria-label="{f.hiring} of 5">
                  {#each Array(5) as _, i}<span class="dot" class:on={i < f.hiring}></span>{/each}
                </span>
              </dd>
            </div>
            <div class="stat">
              <dt>Native mobile</dt>
              <dd>{mobileLabel[f.nativeMobile]}</dd>
            </div>
            <div class="stat">
              <dt>Meta-framework</dt>
              <dd>{f.metaFramework}</dd>
            </div>
            <div class="stat">
              <dt>Two-way binding</dt>
              <dd>{twoWayLabel[f.twoWay]}</dd>
            </div>
            <div class="stat">
              <dt>Scoped CSS</dt>
              <dd>{cssLabel[f.scopedCss]}</dd>
            </div>
          </dl>

          <footer class="card-foot">
            <div class="foot-row">
              <span class="foot-label foot-best">Best at</span>
              <span class="foot-val">{f.bestAt}</span>
            </div>
            <div class="foot-row">
              <span class="foot-label foot-worst">Worst at</span>
              <span class="foot-val">{f.worstAt}</span>
            </div>
          </footer>
        </article>
      {/each}
    </div>
  {:else}
    <div class="dim-list">
      {#each dimensions as d}
        <section class="dim">
          <header class="dim-head">
            <span class="dim-label">{d.label}</span>
            <span class="dim-sub">{d.sub}</span>
          </header>
          <ul class="dim-rows">
            {#each frameworks as f}
              <li class="dim-row" style="--c-fw: {f.color}">
                <span class="dim-fw"><span class="dim-fw-dot" aria-hidden="true"></span>{f.name}</span>
                <span class="dim-val">
                  {#if d.id === 'size'}
                    <span class="dim-bar-wrap">
                      <span class="dim-bar" style="width: {(f.sizeKb / maxKb) * 100}%;"></span>
                    </span>
                    <span class="dim-num lcd">{f.sizeLabel}</span>
                  {:else if d.id === 'mental'}
                    {surfaceLabel[f.mentalSurface]}
                  {:else if d.id === 'ecosystem'}
                    <span class="dots" aria-label="{f.ecosystem} of 5">
                      {#each Array(5) as _, i}<span class="dot" class:on={i < f.ecosystem}></span>{/each}
                    </span>
                  {:else if d.id === 'hiring'}
                    <span class="dots" aria-label="{f.hiring} of 5">
                      {#each Array(5) as _, i}<span class="dot" class:on={i < f.hiring}></span>{/each}
                    </span>
                  {:else if d.id === 'mobile'}
                    {mobileLabel[f.nativeMobile]}
                  {:else if d.id === 'twoWay'}
                    {twoWayLabel[f.twoWay]}
                  {:else if d.id === 'scopedCss'}
                    {cssLabel[f.scopedCss]}
                  {:else if d.id === 'bestAt'}
                    <span class="cap">{f.bestAt}</span>
                  {:else if d.id === 'worstAt'}
                    <span class="cap">{f.worstAt}</span>
                  {/if}
                </span>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {/if}

  <footer class="caveat">
    Numbers are approximate (your mileage will vary by 30–50% on bundle size).
    The “best at” / “worst at” lines are opinions, not facts. Use it as a starting point for your own thinking.
  </footer>
</section>

<style>
  .matrix {
    margin: var(--sp-5) 0;
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-md);
    background: var(--c-card);
    overflow: hidden;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    background: color-mix(in srgb, var(--c-surface) 50%, transparent);
    border-bottom: 1px solid var(--c-border);
    flex-wrap: wrap;
  }
  .head-left { display: flex; flex-direction: column; gap: 2px; }
  .head-label {
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--c-text);
    font-weight: 700;
  }
  .head-sub { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--c-text-faint); }

  .tabs {
    display: inline-flex;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    overflow: hidden;
    padding: 2px;
    gap: 2px;
  }
  .tab {
    appearance: none;
    background: transparent;
    border: none;
    color: var(--c-text-muted);
    padding: 6px 12px;
    border-radius: var(--r-sm);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    cursor: pointer;
    transition: background 120ms, color 120ms;
  }
  .tab:hover { color: var(--c-text); }
  .tab.active {
    background: var(--c-surface);
    color: var(--c-text);
    box-shadow: 0 0 0 1px var(--c-border-strong) inset;
  }

  /* ── Card grid view ─────────────────────────────────────────────── */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1px;
    background: var(--c-border);
  }
  .card {
    display: flex;
    flex-direction: column;
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
    background: var(--c-card);
    min-width: 0;
  }
  .card-head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: var(--sp-3);
  }
  .card-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    background: var(--c-fw);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--c-fw) 25%, transparent);
  }
  .card-name {
    color: var(--c-text);
    font-weight: 700;
    font-size: var(--fs-md);
    letter-spacing: -0.01em;
  }
  .card-size {
    margin-left: auto;
    color: var(--c-fw);
    font-size: var(--fs-xs);
  }

  .bar-wrap {
    height: 6px;
    background: var(--c-bg-code);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: var(--sp-3);
    border: 1px solid var(--c-border);
  }
  .bar {
    height: 100%;
    background: var(--c-fw);
    transition: width 220ms ease-out;
    min-width: 2px;
  }

  .stats {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--sp-2);
    margin: 0 0 var(--sp-3);
  }
  .stat {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: var(--sp-2);
    align-items: center;
  }
  .stat dt {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .stat dd {
    margin: 0;
    color: var(--c-text);
    font-size: var(--fs-sm);
  }

  .dots {
    display: inline-flex;
    gap: 3px;
    align-items: center;
  }
  .dots .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--c-border-strong);
  }
  .dots .dot.on {
    background: var(--c-fw, var(--c-track, var(--c-accent)));
  }

  .card-foot {
    margin-top: auto;
    padding-top: var(--sp-3);
    border-top: 1px dashed var(--c-border);
    display: grid;
    gap: var(--sp-2);
  }
  .foot-row {
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: var(--sp-2);
    align-items: baseline;
  }
  .foot-label {
    font-family: var(--font-lcd);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .foot-best { color: var(--c-track-4); }
  .foot-worst { color: var(--c-text-faint); }
  .foot-val { color: var(--c-text); font-size: var(--fs-sm); line-height: 1.5; }

  /* ── Dimension view ─────────────────────────────────────────────── */
  .dim-list {
    display: grid;
    gap: 1px;
    background: var(--c-border);
  }
  .dim {
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
    background: var(--c-card);
  }
  .dim-head {
    display: flex;
    align-items: baseline;
    gap: var(--sp-2);
    margin-bottom: var(--sp-3);
    flex-wrap: wrap;
  }
  .dim-label { color: var(--c-text); font-weight: 700; font-size: var(--fs-md); }
  .dim-sub { color: var(--c-text-faint); font-family: var(--font-mono); font-size: var(--fs-xs); }

  .dim-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--sp-1);
  }
  .dim-row {
    display: grid;
    grid-template-columns: 100px 1fr;
    align-items: center;
    gap: var(--sp-3);
    padding: 4px 0;
  }
  .dim-fw {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--c-text);
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  .dim-fw-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--c-fw);
  }
  .dim-val {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    color: var(--c-text);
    font-size: var(--fs-sm);
    min-width: 0;
  }
  .dim-bar-wrap {
    flex: 1 1 auto;
    height: 6px;
    background: var(--c-bg-code);
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid var(--c-border);
    min-width: 60px;
    max-width: 240px;
  }
  .dim-bar {
    display: block;
    height: 100%;
    background: var(--c-fw);
    min-width: 2px;
  }
  .dim-num {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    white-space: nowrap;
  }
  .cap {
    color: var(--c-text);
    font-size: var(--fs-sm);
    line-height: 1.5;
  }

  .caveat {
    padding: var(--sp-3) var(--sp-4);
    background: var(--c-bg-code);
    border-top: 1px solid var(--c-border);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    line-height: 1.6;
  }

  @media (max-width: 540px) {
    .stat { grid-template-columns: 96px 1fr; }
    .dim-row { grid-template-columns: 84px 1fr; }
    .foot-row { grid-template-columns: 60px 1fr; }
  }
</style>
