<!--
  An expandable contributor-depth panel embedded inside a lesson.
  The practitioner-tier reader closes it and reads on. The contributor-tier
  reader opens it and gets the implementation-level explanation.

  Uses the slide transition to demonstrate Svelte's transition: directive
  in the chrome of the curriculum itself.
-->
<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { Snippet } from 'svelte';
  import { audio } from '$lib/audio/audio.svelte';

  let { title, children }: { title?: string; children: Snippet } = $props();
  let open = $state(false);

  function handleToggle() {
    open = !open;
    audio.play(open ? 'thud' : 'click');
  }
</script>

<div class="hood" class:open>
  <button
    type="button"
    class="toggle"
    onclick={handleToggle}
    aria-expanded={open}
  >
    <span class="gear" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path
          d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9.4 4l-1.7-1a7.7 7.7 0 0 0 0-2l1.7-1-2-3.4-2 .7a7.7 7.7 0 0 0-1.7-1l-.3-2H9.6l-.3 2c-.6.3-1.2.6-1.7 1l-2-.7-2 3.4 1.7 1a7.7 7.7 0 0 0 0 2l-1.7 1 2 3.4 2-.7c.5.4 1.1.7 1.7 1l.3 2h4.8l.3-2c.6-.3 1.2-.6 1.7-1l2 .7 2-3.4z"
          fill="currentColor"
        />
      </svg>
    </span>
    <span class="label">
      <span class="label-main">Open the Hood</span>
      {#if title}<span class="label-sub">{title}</span>{/if}
    </span>
    <span class="caret" aria-hidden="true">›</span>
  </button>

  {#if open}
    <div class="body" transition:slide={{ duration: 280 }}>
      <div class="body-inner">
        {@render children()}
      </div>
    </div>
  {/if}
</div>

<style>
  .hood {
    margin: var(--sp-5) 0;
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    overflow: hidden;
    background: color-mix(in srgb, var(--c-bg-raised) 80%, transparent);
    transition: border-color var(--d-mid);
  }
  .hood.open { border-color: var(--c-border-strong); }

  .toggle {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    width: 100%;
    padding: var(--sp-3) var(--sp-4);
    background: transparent;
    border: 0;
    color: var(--c-text);
    text-align: left;
    cursor: pointer;
    font: inherit;
  }
  .toggle:hover { background: color-mix(in srgb, color-mix(in srgb, var(--c-track, var(--c-accent)) 14%, transparent) 50%, transparent); }

  .gear {
    color: var(--c-text-muted);
    display: grid;
    place-items: center;
    transition: color var(--d-mid), transform var(--d-slow) var(--ease-spring);
  }
  .hood.open .gear { color: var(--c-track, var(--c-accent)); transform: rotate(60deg); }

  .label { flex: 1; display: flex; flex-direction: column; line-height: 1.2; }
  .label-main {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--c-text-muted);
  }
  .hood.open .label-main { color: var(--c-track, var(--c-accent)); }
  .label-sub { font-size: var(--fs-sm); color: var(--c-text); margin-top: 2px; }

  .caret {
    color: var(--c-text-faint);
    font-size: 1.2rem;
    transition: transform var(--d-mid) var(--ease-out);
  }
  .hood.open .caret { transform: rotate(90deg); color: var(--c-track, var(--c-accent)); }

  .body {
    border-top: 1px solid var(--c-border);
    background: var(--c-bg-card);
  }
  .body-inner {
    padding: var(--sp-5);
    color: var(--c-text);
    font-size: var(--fs-sm);
    line-height: var(--lh-prose);
  }
  .body-inner :global(p) { margin: 0 0 var(--sp-3); }
  .body-inner :global(p:last-child) { margin-bottom: 0; }
  .body-inner :global(code) {
    background: var(--c-bg-code);
    color: #f1ebe6;
    padding: 1px 6px;
    border-radius: var(--r-sm);
    font-size: 0.9em;
  }
</style>
