<!--
  Paginated exercise deck. Shows one exercise at a time with a progress
  strip and prev/next controls. Replaces a vertical stack of six.

  Each exercise is provided via the `items` prop: a label, setup, task,
  verify text, and an optional solution snippet rendered on demand.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  type Item = {
    n: string;            // "1", "2", … or "6 · stretch"
    title: string;
    setup: string;
    task: string;
    verify: string;
    stretch?: string;
    solution: Snippet;
  };

  type Props = { items: Item[] };
  let { items }: Props = $props();

  let idx = $state(0);
  let solutionOpen = $state(false);

  function go(i: number) {
    idx = Math.max(0, Math.min(items.length - 1, i));
    solutionOpen = false;
  }

  const current = $derived(items[idx]);
</script>

<section class="deck">
  <header class="deck-head">
    <div class="head-meta">
      <span class="head-label">Exercises</span>
      <span class="head-sub">Articulation, not code. Practice improves the shape.</span>
    </div>
    <div class="counter lcd">{idx + 1} / {items.length}</div>
  </header>

  <nav class="dots" aria-label="Exercise selector">
    {#each items as ex, i}
      <button
        class="dot"
        class:active={i === idx}
        aria-current={i === idx ? 'true' : undefined}
        aria-label="Exercise {ex.n}: {ex.title}"
        onclick={() => go(i)}
      >
        <span class="dot-n">{ex.n}</span>
        <span class="dot-title">{ex.title}</span>
      </button>
    {/each}
  </nav>

  <article class="card">
    <header class="card-head">
      <span class="card-n lcd">Ex {current.n}</span>
      <h3 class="card-title">{current.title}</h3>
    </header>

    <dl class="fields">
      <div class="row">
        <dt>Setup</dt>
        <dd>{current.setup}</dd>
      </div>
      <div class="row">
        <dt>Do</dt>
        <dd>{current.task}</dd>
      </div>
      <div class="row">
        <dt>Verify</dt>
        <dd>{current.verify}</dd>
      </div>
      {#if current.stretch}
        <div class="row row-stretch">
          <dt>Stretch</dt>
          <dd>{current.stretch}</dd>
        </div>
      {/if}
    </dl>

    <div class="sol">
      <button class="sol-toggle" onclick={() => (solutionOpen = !solutionOpen)} aria-expanded={solutionOpen}>
        <span class="sol-chev" class:open={solutionOpen} aria-hidden="true">▸</span>
        {solutionOpen ? 'Hide reference solution' : 'Show reference solution'}
      </button>
      {#if solutionOpen}
        <div class="sol-body">{@render current.solution()}</div>
      {/if}
    </div>
  </article>

  <footer class="deck-foot">
    <button class="nav-btn" onclick={() => go(idx - 1)} disabled={idx === 0}>
      ← Previous
    </button>
    <span class="prog-label">{current.title}</span>
    <button class="nav-btn" onclick={() => go(idx + 1)} disabled={idx === items.length - 1}>
      Next →
    </button>
  </footer>
</section>

<style>
  .deck {
    margin: var(--sp-5) 0;
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-md);
    background: var(--c-card);
    overflow: hidden;
  }

  .deck-head {
    padding: var(--sp-3) var(--sp-4);
    background: color-mix(in srgb, var(--c-surface) 50%, transparent);
    border-bottom: 1px solid var(--c-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .head-meta { display: flex; flex-direction: column; gap: 2px; }
  .head-label {
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--c-track, var(--c-accent));
    font-weight: 700;
  }
  .head-sub { color: var(--c-text-muted); font-size: var(--fs-sm); }
  .counter {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 4px 10px;
    background: var(--c-bg-code);
  }

  .dots {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1px;
    background: var(--c-border);
    border-bottom: 1px solid var(--c-border);
  }
  .dot {
    appearance: none;
    background: var(--c-card);
    border: none;
    padding: var(--sp-2) var(--sp-3);
    cursor: pointer;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: background 120ms;
    min-width: 0;
  }
  .dot:hover { background: var(--c-bg-code); }
  .dot.active {
    background: color-mix(in srgb, var(--c-track, var(--c-accent)) 12%, var(--c-card));
    box-shadow: inset 0 -2px 0 var(--c-track, var(--c-accent));
  }
  .dot-n {
    font-family: var(--font-lcd);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--c-text-faint);
  }
  .dot.active .dot-n { color: var(--c-track, var(--c-accent)); }
  .dot-title {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dot.active .dot-title { color: var(--c-text); }

  .card {
    padding: var(--sp-4) var(--sp-5);
  }
  .card-head {
    display: flex;
    align-items: baseline;
    gap: var(--sp-3);
    margin-bottom: var(--sp-4);
    padding-bottom: var(--sp-3);
    border-bottom: 1px dashed var(--c-border);
  }
  .card-n {
    color: var(--c-track, var(--c-accent));
    font-size: var(--fs-xs);
    padding: 3px 8px;
    background: color-mix(in srgb, var(--c-track, var(--c-accent)) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-track, var(--c-accent)) 40%, transparent);
    border-radius: 999px;
  }
  .card-title {
    margin: 0;
    color: var(--c-text);
    font-size: var(--fs-lg);
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.3;
  }

  .fields { margin: 0; display: grid; gap: var(--sp-3); }
  .row {
    display: grid;
    grid-template-columns: 72px 1fr;
    gap: var(--sp-3);
    align-items: baseline;
  }
  .row dt {
    font-family: var(--font-lcd);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--c-text-faint);
  }
  .row dd {
    margin: 0;
    color: var(--c-text);
    font-size: var(--fs-md);
    line-height: 1.55;
  }
  .row-stretch dt { color: var(--c-track-5); }

  .sol {
    margin-top: var(--sp-4);
    padding-top: var(--sp-3);
    border-top: 1px dashed var(--c-border);
  }
  .sol-toggle {
    appearance: none;
    background: transparent;
    border: none;
    color: var(--c-text-muted);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0;
  }
  .sol-toggle:hover { color: var(--c-text); }
  .sol-chev { transition: transform 160ms; }
  .sol-chev.open { transform: rotate(90deg); color: var(--c-track, var(--c-accent)); }

  .sol-body {
    margin-top: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    background: var(--c-bg-code);
    border-radius: var(--r-sm);
    border: 1px solid var(--c-border);
    color: var(--c-text);
    font-size: var(--fs-sm);
    line-height: 1.6;
  }
  .sol-body :global(p) {
    margin: 0 0 var(--sp-2);
    font-size: var(--fs-sm);
  }
  .sol-body :global(p:last-child) { margin-bottom: 0; }
  .sol-body :global(blockquote) {
    margin: 0 0 var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    border-left: 2px solid var(--c-track, var(--c-accent));
    background: color-mix(in srgb, var(--c-track, var(--c-accent)) 6%, transparent);
    color: var(--c-text);
    font-style: italic;
    border-radius: 0 var(--r-sm) var(--r-sm) 0;
    font-size: var(--fs-sm);
  }
  .sol-body :global(code:not(pre code)) {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 1px 5px;
    font-size: 0.88em;
  }

  .deck-foot {
    padding: var(--sp-3) var(--sp-4);
    border-top: 1px solid var(--c-border);
    background: color-mix(in srgb, var(--c-surface) 40%, transparent);
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--sp-3);
  }
  .prog-label {
    text-align: center;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .nav-btn {
    appearance: none;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    color: var(--c-text);
    padding: 6px 12px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    cursor: pointer;
    transition: background 120ms, border-color 120ms;
  }
  .nav-btn:hover:not(:disabled) {
    background: var(--c-surface);
    border-color: var(--c-border-strong);
  }
  .nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .deck-foot > .nav-btn:first-child { justify-self: start; }
  .deck-foot > .nav-btn:last-child { justify-self: end; }

  @media (max-width: 540px) {
    .row { grid-template-columns: 60px 1fr; }
    .dots { grid-template-columns: repeat(3, 1fr); }
  }
</style>
