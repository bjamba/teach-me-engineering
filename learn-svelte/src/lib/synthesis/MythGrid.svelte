<!--
  Three myth → truth cards. The "claim in the wild" is crossed out at the
  top of each card; the body explains what's actually true in 2026.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  type Myth = { n: number; claim: string; verdict: string; body: Snippet };
  type Props = { myths: Myth[] };
  let { myths }: Props = $props();
</script>

<div class="myths">
  {#each myths as m}
    <article class="myth">
      <header class="myth-head">
        <span class="myth-n lcd">Myth {m.n}</span>
        <span class="myth-verdict">{m.verdict}</span>
      </header>
      <div class="myth-claim">
        <span class="myth-quote" aria-hidden="true">“</span>
        <span class="myth-strike">{m.claim}</span>
        <span class="myth-quote" aria-hidden="true">”</span>
      </div>
      <div class="myth-body">{@render m.body()}</div>
    </article>
  {/each}
</div>

<style>
  .myths {
    margin: var(--sp-5) 0;
    display: grid;
    gap: var(--sp-3);
  }
  .myth {
    background: var(--c-card);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-md);
    padding: var(--sp-4) var(--sp-5);
  }
  .myth-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--sp-2);
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .myth-n {
    color: var(--c-track-9);
    font-size: var(--fs-xs);
    padding: 2px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--c-track-9) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-track-9) 40%, transparent);
  }
  .myth-verdict {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--c-track-4);
    font-weight: 700;
  }

  .myth-claim {
    font-size: var(--fs-md);
    color: var(--c-text-faint);
    line-height: 1.5;
    margin-bottom: var(--sp-3);
    padding-bottom: var(--sp-3);
    border-bottom: 1px dashed var(--c-border);
  }
  .myth-quote { color: var(--c-text-faint); margin: 0 4px; }
  .myth-strike {
    text-decoration: line-through;
    text-decoration-color: color-mix(in srgb, var(--c-track-9) 70%, transparent);
    text-decoration-thickness: 1.5px;
  }

  .myth-body {
    color: var(--c-text);
    font-size: var(--fs-sm);
    line-height: 1.65;
  }
  .myth-body :global(p) { margin: 0 0 var(--sp-2); font-size: var(--fs-sm); }
  .myth-body :global(p:last-child) { margin-bottom: 0; }
  .myth-body :global(code:not(pre code)) {
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 1px 5px;
    font-size: 0.88em;
  }
</style>
