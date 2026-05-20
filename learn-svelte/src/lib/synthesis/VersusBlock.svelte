<!--
  Two-column "X's wins / Svelte's wins" block with an optional bottom note
  for "when X is right" and an optional "convergence" callout. Used in
  Concept 5 once per framework comparison.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    /** Other framework's name, e.g. "React", "Vue". */
    other: string;
    /** Short tag, e.g. "the giant", "the sibling", "the purist". */
    tagline?: string;
    /** Accent color for the other framework's column. */
    color?: string;
    otherWins: Snippet;
    svelteWins: Snippet;
    /** Optional "when X is right" footer. */
    whenOther?: Snippet;
    /** Optional convergence / honest-take callout. */
    note?: Snippet;
  };

  let { other, tagline, color = 'var(--c-track-9)', otherWins, svelteWins, whenOther, note }: Props = $props();
</script>

<section class="versus" style="--c-other: {color}">
  <header class="versus-head">
    <div class="vs-side vs-other">
      <span class="vs-name">{other}</span>
      {#if tagline}<span class="vs-tag">{tagline}</span>{/if}
    </div>
    <div class="vs-mid" aria-hidden="true">vs</div>
    <div class="vs-side vs-svelte">
      <span class="vs-name">Svelte</span>
    </div>
  </header>

  <div class="grid">
    <div class="col col-other">
      <div class="col-label">{other} wins on</div>
      <div class="col-body">{@render otherWins()}</div>
    </div>
    <div class="col col-svelte">
      <div class="col-label">Svelte wins on</div>
      <div class="col-body">{@render svelteWins()}</div>
    </div>
  </div>

  {#if note}
    <div class="note">{@render note()}</div>
  {/if}

  {#if whenOther}
    <div class="when">
      <span class="when-label">When {other} is the right call</span>
      <div class="when-body">{@render whenOther()}</div>
    </div>
  {/if}
</section>

<style>
  .versus {
    margin: var(--sp-5) 0 var(--sp-6);
    background: var(--c-card);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-md);
    overflow: hidden;
  }

  .versus-head {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    background: color-mix(in srgb, var(--c-surface) 50%, transparent);
    border-bottom: 1px solid var(--c-border);
  }
  .vs-side { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .vs-other { color: var(--c-other); align-items: flex-start; }
  .vs-svelte { color: var(--c-track, var(--c-accent)); align-items: flex-end; text-align: right; }
  .vs-name {
    font-weight: 700;
    font-size: var(--fs-md);
    letter-spacing: -0.01em;
  }
  .vs-tag {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    text-transform: lowercase;
    letter-spacing: 0.04em;
  }
  .vs-mid {
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    letter-spacing: 0.18em;
    color: var(--c-text-faint);
    text-transform: uppercase;
    padding: 2px 8px;
    border: 1px solid var(--c-border);
    border-radius: 999px;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .col {
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
    min-width: 0;
  }
  .col-other {
    border-right: 1px solid var(--c-border);
    background: color-mix(in srgb, var(--c-other) 5%, transparent);
  }
  .col-svelte {
    background: color-mix(in srgb, var(--c-track, var(--c-accent)) 5%, transparent);
  }
  .col-label {
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-bottom: var(--sp-2);
  }
  .col-other .col-label { color: var(--c-other); }
  .col-svelte .col-label { color: var(--c-track, var(--c-accent)); }

  .col-body :global(ul) {
    margin: 0;
    padding-left: 1.1em;
    display: grid;
    gap: var(--sp-1);
  }
  .col-body :global(li) {
    font-size: var(--fs-sm);
    line-height: 1.55;
    color: var(--c-text);
    margin: 0;
  }
  .col-body :global(li strong) { color: var(--c-text); font-weight: 600; }
  .col-body :global(p) {
    margin: 0 0 var(--sp-2);
    font-size: var(--fs-sm);
    color: var(--c-text);
  }
  .col-body :global(code:not(pre code)) {
    background: var(--c-bg-code);
    color: #ecedf3;
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 1px 5px;
    font-size: 0.88em;
  }

  .note {
    padding: var(--sp-3) var(--sp-4);
    background: color-mix(in srgb, var(--c-surface) 70%, transparent);
    border-top: 1px solid var(--c-border);
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
    line-height: 1.6;
  }
  .note :global(strong) { color: var(--c-text); }
  .note :global(p) { margin: 0; font-size: var(--fs-sm); }

  .when {
    padding: var(--sp-3) var(--sp-4);
    border-top: 1px solid var(--c-border);
    background: var(--c-bg-code);
  }
  .when-label {
    display: block;
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--c-other);
    margin-bottom: var(--sp-2);
  }
  .when-body { color: var(--c-text); font-size: var(--fs-sm); line-height: 1.6; }
  .when-body :global(p) { margin: 0; font-size: var(--fs-sm); }
  .when-body :global(code:not(pre code)) {
    background: color-mix(in srgb, var(--c-surface) 80%, transparent);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 1px 5px;
    font-size: 0.88em;
  }

  @media (max-width: 600px) {
    .grid { grid-template-columns: 1fr; }
    .col-other { border-right: none; border-bottom: 1px solid var(--c-border); }
    .versus-head { grid-template-columns: 1fr; gap: var(--sp-1); }
    .vs-other, .vs-svelte { align-items: flex-start; text-align: left; }
    .vs-mid { justify-self: start; }
  }
</style>
