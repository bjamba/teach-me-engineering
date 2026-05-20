<!--
  Accordion FAQ. Each item collapses by default — the page reads as a list
  of questions, not a wall of answers. Click to expand.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  type Item = { q: string; a: Snippet };
  type Props = { items: Item[] };
  let { items }: Props = $props();

  let open = $state<number | null>(null);

  function toggle(i: number) {
    open = open === i ? null : i;
  }
</script>

<section class="faq" aria-label="Common questions">
  {#each items as item, i}
    <details class="faq-item" open={open === i} ontoggle={(e) => { if ((e.target as HTMLDetailsElement).open) open = i; else if (open === i) open = null; }}>
      <summary class="q">
        <span class="q-mark" aria-hidden="true">Q</span>
        <span class="q-text">{item.q}</span>
        <span class="q-chev" aria-hidden="true">+</span>
      </summary>
      <div class="a">
        <span class="a-mark" aria-hidden="true">A</span>
        <div class="a-body">{@render item.a()}</div>
      </div>
    </details>
  {/each}
</section>

<style>
  .faq {
    margin: var(--sp-5) 0;
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    overflow: hidden;
    background: var(--c-card);
  }
  .faq-item + .faq-item { border-top: 1px solid var(--c-border); }

  .q {
    display: grid;
    grid-template-columns: 28px 1fr 24px;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-4);
    cursor: pointer;
    color: var(--c-text);
    font-size: var(--fs-md);
    line-height: 1.45;
    list-style: none;
    transition: background 120ms;
    user-select: none;
  }
  .q::-webkit-details-marker { display: none; }
  .q:hover { background: color-mix(in srgb, var(--c-track, var(--c-accent)) 4%, transparent); }
  .q-mark {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--c-track, var(--c-accent)) 18%, transparent);
    color: var(--c-track, var(--c-accent));
    font-family: var(--font-lcd);
    font-size: 11px;
    font-weight: 700;
  }
  .q-text { font-weight: 600; }
  .q-chev {
    font-family: var(--font-mono);
    font-size: var(--fs-lg);
    color: var(--c-text-faint);
    text-align: center;
    transition: transform 160ms;
    line-height: 1;
  }
  details[open] > .q .q-chev { transform: rotate(45deg); color: var(--c-track, var(--c-accent)); }
  details[open] > .q { background: color-mix(in srgb, var(--c-track, var(--c-accent)) 6%, transparent); }

  .a {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: var(--sp-2);
    padding: 0 var(--sp-4) var(--sp-4);
  }
  .a-mark {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    color: var(--c-text-muted);
    font-family: var(--font-lcd);
    font-size: 11px;
    font-weight: 700;
    margin-top: 2px;
  }
  .a-body {
    color: var(--c-text);
    font-size: var(--fs-sm);
    line-height: 1.65;
  }
  .a-body :global(p) { margin: 0 0 var(--sp-2); font-size: var(--fs-sm); }
  .a-body :global(p:last-child) { margin-bottom: 0; }
  .a-body :global(code:not(pre code)) {
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 1px 5px;
    font-size: 0.88em;
  }
</style>
