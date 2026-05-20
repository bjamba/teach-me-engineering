<!--
  Interactive end-of-curriculum checklist. Persists check state to
  localStorage so the reader can come back to it. Replaces a bullet list
  the reader would just skim.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  type Item = { id: string; text: string };

  const items: Item[] = [
    { id: 'ship',        text: 'Shipped at least one substantial Svelte project (the DAW from M6-M7).' },
    { id: 'component',   text: 'Can write a Svelte component without looking up syntax.' },
    { id: 'routing',     text: 'Can navigate a SvelteKit project\'s filesystem routing without reading the docs.' },
    { id: 'debug',       text: 'Can debug "why isn\'t this updating?" using the inspector, source map, and runes mental model.' },
    { id: 'opinion',     text: 'Have an opinion about Svelte that\'s grounded in shipped code and defendable against pushback.' },
    { id: 'pitch',       text: 'Can deliver a working framework comparison in 30s, 60s, or one written page — calibrated to the audience.' },
    { id: 'cases',       text: 'Can articulate at least three concrete cases where each of React, Vue, Solid, Qwik, Astro is the better choice.' },
  ];

  const STORAGE_KEY = 'synthesis.checklist.v1';
  let checked = $state<Record<string, boolean>>({});

  onMount(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) checked = JSON.parse(raw);
    } catch {}
  });

  function toggle(id: string) {
    checked = { ...checked, [id]: !checked[id] };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(checked)); } catch {}
  }

  const done = $derived(items.filter((i) => checked[i.id]).length);
  const pct = $derived(Math.round((done / items.length) * 100));
</script>

<section class="checklist" aria-label="End-of-curriculum checklist">
  <header class="head">
    <div class="head-meta">
      <span class="head-label">Checkpoint</span>
      <span class="head-sub">If these are true, the curriculum did its job.</span>
    </div>
    <div class="prog" aria-label="Progress">
      <span class="prog-num lcd">{done} / {items.length}</span>
      <span class="prog-bar"><span class="prog-fill" style="width: {pct}%"></span></span>
    </div>
  </header>
  <ul class="list">
    {#each items as it}
      <li>
        <label class="item" class:done={checked[it.id]}>
          <input
            type="checkbox"
            checked={!!checked[it.id]}
            onchange={() => toggle(it.id)}
          />
          <span class="box" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="11" height="11">
              <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <span class="text">{it.text}</span>
        </label>
      </li>
    {/each}
  </ul>
</section>

<style>
  .checklist {
    margin: var(--sp-5) 0;
    background: var(--c-card);
    border: 1px solid var(--c-border-strong);
    border-left: 3px solid var(--c-track, var(--c-accent));
    border-radius: var(--r-md);
    overflow: hidden;
  }
  .head {
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--c-border);
    background: color-mix(in srgb, var(--c-surface) 50%, transparent);
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
  .prog { display: flex; align-items: center; gap: var(--sp-2); }
  .prog-num {
    color: var(--c-text);
    font-size: var(--fs-xs);
    padding: 2px 8px;
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    background: var(--c-bg-code);
  }
  .prog-bar {
    width: 96px;
    height: 5px;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: 999px;
    overflow: hidden;
  }
  .prog-fill {
    display: block;
    height: 100%;
    background: var(--c-track, var(--c-accent));
    transition: width 220ms ease-out;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list li + li { border-top: 1px solid var(--c-border); }

  .item {
    display: grid;
    grid-template-columns: 22px 1fr;
    gap: var(--sp-3);
    align-items: center;
    padding: var(--sp-3) var(--sp-4);
    cursor: pointer;
    transition: background 120ms;
  }
  .item:hover { background: color-mix(in srgb, var(--c-track, var(--c-accent)) 4%, transparent); }
  .item input { position: absolute; opacity: 0; pointer-events: none; }
  .box {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border: 1.5px solid var(--c-border-strong);
    border-radius: 5px;
    color: transparent;
    background: var(--c-bg-code);
    transition: background 120ms, border-color 120ms, color 120ms;
  }
  .item.done .box {
    background: var(--c-track, var(--c-accent));
    border-color: var(--c-track, var(--c-accent));
    color: #fff;
  }
  .text {
    color: var(--c-text);
    font-size: var(--fs-sm);
    line-height: 1.55;
    transition: color 120ms;
  }
  .item.done .text {
    color: var(--c-text-muted);
    text-decoration: line-through;
    text-decoration-color: color-mix(in srgb, var(--c-track, var(--c-accent)) 60%, transparent);
  }
</style>
