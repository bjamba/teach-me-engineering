<!--
  Wraps an exercise / hands-on prompt inside a lesson. The body is whatever
  the lesson author wants — a prompt + a sandbox, a checkpoint, a "predict the
  output" question. Visually distinct from prose so the reader knows when to
  stop reading and start doing.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    /** Optional short label, e.g. "Exercise 1", "Checkpoint", "Predict it". Default: "Try this". */
    label?: string;
    /** Optional one-line subtitle for context. */
    title?: string;
    children: Snippet;
  };

  let { label = 'Try this', title, children }: Props = $props();
</script>

<aside class="trythis">
  <header class="trythis-head">
    <span class="trythis-icon" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path d="M8 1l1.8 4.2 4.2.4-3.2 2.9 1 4.5L8 11l-3.8 2 1-4.5L2 5.6l4.2-.4z" fill="currentColor"/>
      </svg>
    </span>
    <span class="trythis-label">{label}</span>
    {#if title}<span class="trythis-title">{title}</span>{/if}
  </header>
  <div class="trythis-body">
    {@render children()}
  </div>
</aside>

<style>
  .trythis {
    margin: var(--sp-5) 0;
    padding: var(--sp-4) var(--sp-5) var(--sp-5);
    background: color-mix(in srgb, var(--c-track, var(--c-accent)) 8%, var(--c-card));
    border: 1px solid color-mix(in srgb, var(--c-track, var(--c-accent)) 35%, var(--c-border));
    border-left: 3px solid var(--c-track, var(--c-accent));
    border-radius: var(--r-md);
  }

  .trythis-head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: var(--sp-3);
    color: var(--c-track, var(--c-accent));
  }
  .trythis-icon {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
  }
  .trythis-label {
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 600;
  }
  .trythis-title {
    font-size: var(--fs-sm);
    color: var(--c-text);
    margin-left: var(--sp-2);
  }

  .trythis-body {
    color: var(--c-text);
  }
  /* Override prose top-margin on the first element inside */
  .trythis-body :global(> *:first-child) { margin-top: 0; }
  .trythis-body :global(p:first-child) { margin-top: 0; }
  .trythis-body :global(p) {
    margin: 0 0 var(--sp-3);
    font-size: var(--fs-md);
  }
  .trythis-body :global(p:last-child) { margin-bottom: 0; }
  .trythis-body :global(ul), .trythis-body :global(ol) {
    margin: var(--sp-2) 0 var(--sp-3);
    padding-left: 1.4em;
  }
  .trythis-body :global(li) {
    margin-bottom: var(--sp-1);
  }
  .trythis-body :global(code:not(pre code)) {
    background: var(--c-bg-code);
    color: #ecedf3;
    padding: 1px 6px;
    border-radius: var(--r-sm);
    border: 1px solid color-mix(in srgb, var(--c-track, var(--c-accent)) 25%, var(--c-border));
    font-size: 0.9em;
  }
  .trythis-body :global(pre) {
    margin: var(--sp-3) 0;
  }
  .trythis-body :global(details) {
    margin-top: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    background: var(--c-bg-code);
    border-radius: var(--r-sm);
    border: 1px solid var(--c-border);
  }
  .trythis-body :global(details summary) {
    cursor: pointer;
    color: var(--c-text-muted);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    user-select: none;
  }
  .trythis-body :global(details summary:hover) {
    color: var(--c-text);
  }
  .trythis-body :global(details[open] summary) {
    margin-bottom: var(--sp-3);
    color: var(--c-track, var(--c-accent));
  }
</style>
