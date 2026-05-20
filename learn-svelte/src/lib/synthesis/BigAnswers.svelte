<!--
  Three question-card pairs for the "Putting it together" section. Each
  one is a question the synthesis should let you answer cleanly, with
  the answer rendered as a styled body.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  type Ans = { q: string; tag: string; a: Snippet };
  type Props = { items: Ans[] };
  let { items }: Props = $props();
</script>

<div class="answers">
  {#each items as it, i}
    <article class="ans">
      <header class="ans-head">
        <span class="ans-n lcd">{(i + 1).toString().padStart(2, '0')}</span>
        <span class="ans-tag">{it.tag}</span>
      </header>
      <h3 class="ans-q">{it.q}</h3>
      <div class="ans-body">{@render it.a()}</div>
    </article>
  {/each}
</div>

<style>
  .answers {
    margin: var(--sp-5) 0;
    display: grid;
    gap: var(--sp-3);
  }
  .ans {
    background: var(--c-card);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-md);
    padding: var(--sp-4) var(--sp-5);
    border-top: 3px solid var(--c-track, var(--c-accent));
  }
  .ans-head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: var(--sp-2);
  }
  .ans-n {
    color: var(--c-track, var(--c-accent));
    font-size: var(--fs-xs);
    padding: 2px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--c-track, var(--c-accent)) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-track, var(--c-accent)) 40%, transparent);
  }
  .ans-tag {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    text-transform: lowercase;
  }
  .ans-q {
    margin: 0 0 var(--sp-3);
    color: var(--c-text);
    font-size: var(--fs-lg);
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }
  .ans-body {
    color: var(--c-text);
    font-size: var(--fs-md);
    line-height: 1.6;
  }
  .ans-body :global(p) { margin: 0 0 var(--sp-2); font-size: var(--fs-md); }
  .ans-body :global(p:last-child) { margin-bottom: 0; }
  .ans-body :global(code:not(pre code)) {
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 1px 5px;
    font-size: 0.88em;
  }
  .ans-body :global(strong) { color: var(--c-text); font-weight: 700; }
</style>
