<!--
  FrameworkRace — module 09 headline.
  The same todo widget written in 5 frameworks, side-by-side, plus a
  bundle-cost bar chart at the bottom. No live execution; the source
  blocks are static strings. Intent is comparison, not a benchmark.
-->
<script lang="ts">
  import Led from '$lib/components/Led.svelte';

  type FrameworkId = 'vanilla' | 'react' | 'vue' | 'solid' | 'svelte';

  type Framework = {
    id: FrameworkId;
    name: string;
    version: string;
    /** Approx runtime + widget cost, gzipped, in KB. Teaching-grade only. */
    sizeKb: number;
    lines: number;
    color: string;
    blurb: string;
    source: string;
  };

  // Source strings live inline. Indented two spaces; tab-size: 2 in CSS.
  // Keep each one in the 20–40 line range.

  const VANILLA_SRC = `const root = document.getElementById('app');
let items = [];
let filter = 'all';
let nextId = 1;

function render() {
  const visible = items.filter(i =>
    filter === 'all' ? true : filter === 'done' ? i.done : !i.done
  );
  root.innerHTML = \`
    <input id="t" placeholder="add…" />
    <button id="add">add</button>
    <div>\${['all','active','done'].map(f =>
      \`<button data-f="\${f}">\${f}\${f===filter?' •':''}</button>\`
    ).join('')}</div>
    <ul>\${visible.map(i => \`
      <li data-id="\${i.id}">
        <input type="checkbox" \${i.done?'checked':''} />
        <span>\${i.text}</span>
        <button class="x">×</button>
      </li>\`).join('')}</ul>\`;
}

root.addEventListener('click', e => {
  const t = e.target;
  if (t.id === 'add') {
    const v = root.querySelector('#t').value.trim();
    if (v) { items.push({ id: nextId++, text: v, done: false }); render(); }
  } else if (t.dataset.f) { filter = t.dataset.f; render(); }
  else if (t.classList.contains('x')) {
    const id = +t.closest('li').dataset.id;
    items = items.filter(i => i.id !== id); render();
  } else if (t.type === 'checkbox') {
    const id = +t.closest('li').dataset.id;
    items = items.map(i => i.id===id ? {...i, done:!i.done} : i); render();
  }
});
render();`;

  const REACT_SRC = `import { useState, useMemo } from 'react';

export function Todos() {
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('all');

  const visible = useMemo(() => items.filter(i =>
    filter === 'all' ? true : filter === 'done' ? i.done : !i.done
  ), [items, filter]);

  function add() {
    const v = text.trim();
    if (!v) return;
    setItems([...items, { id: Date.now(), text: v, done: false }]);
    setText('');
  }
  const toggle = id => setItems(items.map(i =>
    i.id === id ? { ...i, done: !i.done } : i));
  const remove = id => setItems(items.filter(i => i.id !== id));

  return (
    <div>
      <input value={text} onChange={e => setText(e.target.value)} />
      <button onClick={add}>add</button>
      <div>
        {['all','active','done'].map(f =>
          <button key={f} onClick={() => setFilter(f)}>
            {f}{f === filter ? ' •' : ''}
          </button>)}
      </div>
      <ul>{visible.map(i =>
        <li key={i.id}>
          <input type="checkbox" checked={i.done} onChange={() => toggle(i.id)} />
          <span>{i.text}</span>
          <button onClick={() => remove(i.id)}>×</button>
        </li>)}</ul>
    </div>
  );
}`;

  const VUE_SRC = `<script setup>
import { ref, computed } from 'vue';

const items = ref([]);
const text = ref('');
const filter = ref('all');

const visible = computed(() => items.value.filter(i =>
  filter.value === 'all' ? true :
  filter.value === 'done' ? i.done : !i.done
));

function add() {
  const v = text.value.trim();
  if (!v) return;
  items.value.push({ id: Date.now(), text: v, done: false });
  text.value = '';
}
const toggle = id => {
  const it = items.value.find(i => i.id === id);
  if (it) it.done = !it.done;
};
const remove = id => {
  items.value = items.value.filter(i => i.id !== id);
};
<\/script>

<template>
  <input v-model="text" />
  <button @click="add">add</button>
  <div>
    <button v-for="f in ['all','active','done']" :key="f" @click="filter = f">
      {{ f }}{{ f === filter ? ' •' : '' }}
    </button>
  </div>
  <ul>
    <li v-for="i in visible" :key="i.id">
      <input type="checkbox" :checked="i.done" @change="toggle(i.id)" />
      <span>{{ i.text }}</span>
      <button @click="remove(i.id)">×</button>
    </li>
  </ul>
</template>`;

  const SOLID_SRC = `import { createSignal, createMemo, For } from 'solid-js';

export function Todos() {
  const [items, setItems] = createSignal([]);
  const [text, setText] = createSignal('');
  const [filter, setFilter] = createSignal('all');

  const visible = createMemo(() => items().filter(i =>
    filter() === 'all' ? true : filter() === 'done' ? i.done : !i.done
  ));

  const add = () => {
    const v = text().trim();
    if (!v) return;
    setItems([...items(), { id: Date.now(), text: v, done: false }]);
    setText('');
  };
  const toggle = id => setItems(items().map(i =>
    i.id === id ? { ...i, done: !i.done } : i));
  const remove = id => setItems(items().filter(i => i.id !== id));

  return (
    <div>
      <input value={text()} onInput={e => setText(e.currentTarget.value)} />
      <button onClick={add}>add</button>
      <div>
        <For each={['all','active','done']}>{f =>
          <button onClick={() => setFilter(f)}>
            {f}{f === filter() ? ' •' : ''}
          </button>}</For>
      </div>
      <ul><For each={visible()}>{i =>
        <li>
          <input type="checkbox" checked={i.done} onChange={() => toggle(i.id)} />
          <span>{i.text}</span>
          <button onClick={() => remove(i.id)}>×</button>
        </li>}</For></ul>
    </div>
  );
}`;

  const SVELTE_SRC = `<script>
  let items = $state([]);
  let text = $state('');
  let filter = $state('all');

  let visible = $derived(items.filter(i =>
    filter === 'all' ? true : filter === 'done' ? i.done : !i.done
  ));

  function add() {
    const v = text.trim();
    if (!v) return;
    items.push({ id: Date.now(), text: v, done: false });
    text = '';
  }
<\/script>

<input bind:value={text} />
<button onclick={add}>add</button>
<div>
  {#each ['all','active','done'] as f}
    <button onclick={() => (filter = f)}>
      {f}{f === filter ? ' •' : ''}
    </button>
  {/each}
</div>
<ul>
  {#each visible as i (i.id)}
    <li>
      <input type="checkbox" bind:checked={i.done} />
      <span>{i.text}</span>
      <button onclick={() => items = items.filter(x => x.id !== i.id)}>×</button>
    </li>
  {/each}
</ul>`;

  const FRAMEWORKS: Framework[] = [
    {
      id: 'vanilla',
      name: 'Vanilla JS',
      version: 'ES2022',
      sizeKb: 1.2,
      lines: VANILLA_SRC.split('\n').length,
      color: '#c8c5bc',
      blurb:
        'No framework. Hand-written DOM updates. Less code shipped to the browser than anything else here, but every state mutation is your problem. The innerHTML rerender pattern shown is the cheap option; once the widget grows you reach for either diffing or surgical updates, and at that point you are reinventing one of the other four.',
      source: VANILLA_SRC
    },
    {
      id: 'react',
      name: 'React',
      version: '18.3',
      sizeKb: 44,
      lines: REACT_SRC.split('\n').length,
      color: '#61dafb',
      blurb:
        'useState everywhere; the framework re-runs your component on every state change and reconciles a virtual DOM against the real one. Memoization (useMemo, useCallback) is your responsibility, and forgetting it is the most common React performance bug. The mental model is small and the ecosystem is enormous.',
      source: REACT_SRC
    },
    {
      id: 'vue',
      name: 'Vue',
      version: '3.4',
      sizeKb: 34,
      lines: VUE_SRC.split('\n').length,
      color: '#42b883',
      blurb:
        'Composition API with ref() and computed values; the .value unwrapping is the syntactic price for plain-object reactivity. The single-file component shape and template directives are pleasant to read. The compiler does some optimization, but the runtime ships a reactivity engine to every browser, which is most of the bundle cost.',
      source: VUE_SRC
    },
    {
      id: 'solid',
      name: 'Solid',
      version: '1.8',
      sizeKb: 7.5,
      lines: SOLID_SRC.split('\n').length,
      color: '#2c4f7c',
      blurb:
        'Same fine-grained signal model as Svelte 5, but no SFC compile step transforms your component code — it is JSX with signals. Components run exactly once; signals track every read and update only the DOM nodes that depend on them. Smaller runtime than React or Vue; calling getters as functions (text()) is the ergonomic tax.',
      source: SOLID_SRC
    },
    {
      id: 'svelte',
      name: 'Svelte 5',
      version: '5.16',
      sizeKb: 4.8,
      lines: SVELTE_SRC.split('\n').length,
      color: '#ff3e00',
      blurb:
        'Runes ($state, $derived) are syntax the compiler reads. Components run once; reactivity is wired up at build time, so the runtime that ships to the browser is small. The output is just JavaScript that touches the DOM. The cost is a build step and the fact that you are running compiler-generated code, not the code you wrote.',
      source: SVELTE_SRC
    }
  ];

  let active = $state<FrameworkId>('svelte');
  let compare = $state(false);
  let activeFramework = $derived(FRAMEWORKS.find(f => f.id === active)!);

  const maxKb = Math.max(...FRAMEWORKS.map(f => f.sizeKb));
</script>

<div class="race">
  <header class="race-head">
    <Led variant="live" label="MOD 09" />
    <span class="head-title">Framework Race</span>
    <span class="head-meta lcd">module 09 · same widget, five ways</span>
  </header>

  <!-- Framework tab strip -->
  <div class="tabs" role="tablist" aria-label="Frameworks">
    {#each FRAMEWORKS as f}
      <button
        class="tab"
        class:active={active === f.id && !compare}
        role="tab"
        aria-selected={active === f.id}
        onclick={() => { active = f.id; compare = false; }}
        style="--tab-accent: {f.color}"
      >
        <span class="tab-name">{f.name}</span>
        <span class="tab-meta lcd">v{f.version}</span>
        <span class="tab-stats">
          <span class="stat lcd">{f.sizeKb} kb</span>
          <span class="stat lcd">{f.lines} ln</span>
        </span>
      </button>
    {/each}

    <button
      class="compare-toggle"
      class:on={compare}
      onclick={() => (compare = !compare)}
      aria-pressed={compare}
    >
      {compare ? '◧ single' : '⊞ compare'}
    </button>
  </div>

  <!-- Body -->
  {#if compare}
    <div class="compare-grid">
      {#each FRAMEWORKS as f}
        <section class="col" style="--tab-accent: {f.color}">
          <header class="col-head">
            <span class="col-dot"></span>
            <span class="col-name">{f.name}</span>
            <span class="col-size lcd">{f.sizeKb} kb</span>
          </header>
          <pre class="code compact"><code>{f.source}</code></pre>
        </section>
      {/each}
    </div>
  {:else}
    <div class="detail">
      <section class="code-pane" style="--tab-accent: {activeFramework.color}">
        <div class="pane-tab">
          <span class="lang-pill">
            <span class="pill-dot"></span>
            {activeFramework.name} · v{activeFramework.version}
          </span>
          <span class="byte-count lcd">
            {activeFramework.lines} ln · {activeFramework.sizeKb} kb
          </span>
        </div>
        <pre class="code"><code>{activeFramework.source}</code></pre>
      </section>

      <aside class="notes-pane">
        <h3 class="notes-title">
          <span class="notes-dot" style="background: {activeFramework.color}"></span>
          How {activeFramework.name} thinks about this
        </h3>
        <p class="notes-body">{activeFramework.blurb}</p>
        <dl class="notes-stats">
          <div>
            <dt>runtime + widget</dt>
            <dd class="lcd">{activeFramework.sizeKb} kb</dd>
          </div>
          <div>
            <dt>source lines</dt>
            <dd class="lcd">{activeFramework.lines}</dd>
          </div>
          <div>
            <dt>version</dt>
            <dd class="lcd">{activeFramework.version}</dd>
          </div>
        </dl>
      </aside>
    </div>
  {/if}

  <!-- Bundle cost bar chart -->
  <footer class="chart">
    <div class="chart-head">
      <span class="chart-title lcd">bundle cost · runtime + widget · gzipped</span>
      <span class="chart-axis lcd">0 — {maxKb} kb</span>
    </div>
    <div class="bars">
      {#each [...FRAMEWORKS].sort((a, b) => a.sizeKb - b.sizeKb) as f}
        <div
          class="bar-row"
          class:active={f.id === active && !compare}
          onclick={() => { active = f.id; compare = false; }}
          role="button"
          tabindex="0"
          onkeydown={e => { if (e.key === 'Enter' || e.key === ' ') { active = f.id; compare = false; } }}
        >
          <span class="bar-name">{f.name}</span>
          <span class="bar-track">
            <span
              class="bar-fill"
              style="width: {(f.sizeKb / maxKb) * 100}%; background: {f.color}"
            ></span>
          </span>
          <span class="bar-size lcd">{f.sizeKb.toFixed(1)} kb</span>
        </div>
      {/each}
    </div>
    <p class="chart-foot">
      Approximations for a minimal todo widget. Real numbers vary with
      tree-shaking, hydration strategy, and what else the app is already
      shipping. The order is what matters here, not the digits.
    </p>
  </footer>
</div>

<style>
  .race {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-lg);
    background: var(--c-card);
    box-shadow: var(--shadow-card);
    overflow: hidden;
    margin: var(--sp-5) 0;
    --c-mod: var(--c-track-9);
  }

  .race-head {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-4);
    background: color-mix(in srgb, var(--c-surface) 60%, transparent);
    border-bottom: 1px solid var(--c-border);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    color: var(--c-text-muted);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .head-title { color: var(--c-text); font-weight: 600; }
  .head-meta { margin-left: auto; opacity: 0.8; text-transform: none; letter-spacing: 0.06em; }

  /* ── Tab strip ─────────────────────────────────────────────────── */
  .tabs {
    display: flex;
    align-items: stretch;
    gap: 1px;
    padding: var(--sp-2) var(--sp-3);
    background: var(--c-surface);
    border-bottom: 1px solid var(--c-border);
    flex-wrap: wrap;
  }
  .tab {
    flex: 1 1 140px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    background: transparent;
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 6px 10px;
    color: var(--c-text-muted);
    font: inherit;
    cursor: pointer;
    text-align: left;
    transition: background var(--d-fast), border-color var(--d-fast), color var(--d-fast);
  }
  .tab:hover {
    border-color: var(--c-border-strong);
    color: var(--c-text);
  }
  .tab.active {
    background: color-mix(in srgb, var(--c-mod) 18%, transparent);
    border-color: var(--c-mod);
    color: var(--c-text);
    box-shadow: 0 0 0 1px var(--c-mod) inset;
  }
  .tab-name {
    font-size: var(--fs-sm);
    font-weight: 600;
    letter-spacing: 0;
  }
  .tab-meta {
    font-size: 0.62rem;
    color: var(--c-text-faint);
    text-transform: lowercase;
    letter-spacing: 0.04em;
  }
  .tab-stats {
    display: flex;
    gap: var(--sp-2);
    margin-top: 2px;
  }
  .stat {
    font-size: 0.62rem;
    color: var(--c-text-muted);
    text-transform: lowercase;
  }

  .compare-toggle {
    align-self: stretch;
    padding: 6px 12px;
    background: transparent;
    color: var(--c-text-muted);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: background var(--d-fast), color var(--d-fast), border-color var(--d-fast);
  }
  .compare-toggle:hover { border-color: var(--c-border-strong); color: var(--c-text); }
  .compare-toggle.on {
    background: var(--c-mod);
    border-color: var(--c-mod);
    color: white;
  }

  /* ── Single-tab detail ─────────────────────────────────────────── */
  .detail {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    min-height: 360px;
  }
  @media (max-width: 820px) {
    .detail { grid-template-columns: 1fr; }
  }

  .code-pane {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--c-border);
    min-width: 0;
  }
  @media (max-width: 820px) {
    .code-pane { border-right: 0; border-bottom: 1px solid var(--c-border); }
  }
  .pane-tab {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-4);
    background: var(--c-surface);
    border-bottom: 1px solid var(--c-border);
  }
  .lang-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    letter-spacing: 0.04em;
  }
  .pill-dot {
    width: 8px;
    height: 8px;
    border-radius: 99px;
    background: var(--tab-accent, var(--c-mod));
    box-shadow: 0 0 6px -1px var(--tab-accent, var(--c-mod));
  }
  .byte-count {
    margin-left: auto;
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
  }

  .code {
    flex: 1;
    margin: 0;
    padding: var(--sp-4);
    overflow: auto;
    background: var(--c-bg-code);
    color: #ecedf3;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    line-height: 1.55;
    border: 0;
    tab-size: 2;
    white-space: pre;
    max-height: 460px;
  }
  .code.compact {
    font-size: 0.68rem;
    line-height: 1.45;
    padding: var(--sp-3);
    max-height: 320px;
  }

  /* ── Notes side ────────────────────────────────────────────────── */
  .notes-pane {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4) var(--sp-4) var(--sp-3);
    background: color-mix(in srgb, var(--c-surface) 50%, transparent);
    min-width: 0;
  }
  .notes-title {
    margin: 0;
    font-size: var(--fs-md);
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--c-text);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .notes-dot {
    width: 10px;
    height: 10px;
    border-radius: 99px;
    box-shadow: 0 0 8px -1px currentColor;
  }
  .notes-body {
    margin: 0;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.55;
  }
  .notes-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-2);
    margin: var(--sp-3) 0 0;
    padding: var(--sp-3);
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
  }
  .notes-stats div { display: flex; flex-direction: column; gap: 2px; }
  .notes-stats dt {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--c-text-faint);
    font-family: var(--font-mono);
  }
  .notes-stats dd {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--c-text);
  }

  /* ── Compare grid ──────────────────────────────────────────────── */
  .compare-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 1px;
    background: var(--c-border);
    border-bottom: 1px solid var(--c-border);
  }
  @media (max-width: 1100px) {
    .compare-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 540px) {
    .compare-grid { grid-template-columns: 1fr; }
  }
  .col {
    display: flex;
    flex-direction: column;
    background: var(--c-card);
    min-width: 0;
  }
  .col-head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px var(--sp-3);
    background: var(--c-surface);
    border-bottom: 1px solid var(--c-border);
    font-size: var(--fs-xs);
  }
  .col-dot {
    width: 8px;
    height: 8px;
    border-radius: 99px;
    background: var(--tab-accent);
    box-shadow: 0 0 6px -1px var(--tab-accent);
  }
  .col-name {
    color: var(--c-text);
    font-weight: 600;
    letter-spacing: 0;
  }
  .col-size {
    margin-left: auto;
    color: var(--c-text-faint);
    font-size: 0.62rem;
  }

  /* ── Chart ─────────────────────────────────────────────────────── */
  .chart {
    border-top: 1px solid var(--c-border);
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
    background: color-mix(in srgb, var(--c-surface) 30%, transparent);
  }
  .chart-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: var(--sp-3);
  }
  .chart-title {
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    text-transform: lowercase;
  }
  .chart-axis {
    font-size: 0.62rem;
    color: var(--c-text-faint);
  }

  .bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 110px 1fr 80px;
    gap: var(--sp-3);
    align-items: center;
    padding: 4px 8px;
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    cursor: pointer;
    transition: background var(--d-fast), border-color var(--d-fast);
  }
  .bar-row:hover { background: var(--c-surface); }
  .bar-row.active {
    background: color-mix(in srgb, var(--c-mod) 12%, transparent);
    border-color: var(--c-mod);
  }
  .bar-name {
    font-size: var(--fs-sm);
    color: var(--c-text);
    font-weight: 500;
  }
  .bar-track {
    position: relative;
    height: 14px;
    background: var(--c-bg-code);
    border-radius: 2px;
    overflow: hidden;
    border: 1px solid var(--c-border);
  }
  .bar-fill {
    display: block;
    height: 100%;
    border-radius: 1px;
    transition: width var(--d-mid) var(--ease-out);
    box-shadow: 0 0 8px -2px currentColor;
  }
  .bar-size {
    text-align: right;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }

  .chart-foot {
    margin: var(--sp-3) 0 0;
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    line-height: 1.5;
  }
</style>
