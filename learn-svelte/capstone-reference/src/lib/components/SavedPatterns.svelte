<!--
  Named saved-pattern sidebar. Patterns are stored in localStorage; deletion
  and load are immediate.
-->
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';

  let saveName = $state('');

  function handleSave(e: Event) {
    e.preventDefault();
    const name = saveName.trim();
    if (!name) return;
    audio.saveAs(name);
    saveName = '';
  }
</script>

<aside class="saved">
  <h3>SAVED PATTERNS</h3>

  <form onsubmit={handleSave}>
    <input
      type="text"
      bind:value={saveName}
      placeholder="name this pattern..."
      maxlength="40"
    />
    <button type="submit" disabled={!saveName.trim()}>save</button>
  </form>

  {#if audio.savedPatterns.length === 0}
    <p class="empty">no saved patterns yet</p>
  {:else}
    <ul>
      {#each audio.savedPatterns as p (p.id)}
        <li>
          <button class="load" type="button" onclick={() => audio.loadSlot(p.id)}>
            <span class="name">{p.name}</span>
            <span class="meta lcd">{p.bpm}bpm</span>
          </button>
          <button class="del" type="button" onclick={() => audio.deleteSlot(p.id)} aria-label="Delete {p.name}">×</button>
        </li>
      {/each}
    </ul>
  {/if}
</aside>

<style>
  .saved {
    padding: var(--sp-3);
    background: var(--c-chrome);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
  }
  h3 {
    margin: 0 0 var(--sp-3);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    color: var(--c-text-muted);
  }
  form { display: flex; gap: 6px; margin-bottom: var(--sp-3); }
  input {
    flex: 1;
    padding: 7px 10px;
    background: var(--c-bg-code);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    font: inherit;
    font-size: var(--fs-sm);
  }
  input:focus { outline: 1px solid var(--c-accent); }
  button {
    cursor: pointer;
    font: inherit;
  }
  form button {
    padding: 7px 14px;
    background: var(--c-accent);
    color: white;
    border: 0;
    border-radius: var(--r-sm);
    font-weight: 600;
    font-size: var(--fs-xs);
    letter-spacing: 0.04em;
  }
  form button:disabled { opacity: 0.4; cursor: not-allowed; }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
  }
  .load {
    flex: 1;
    background: transparent;
    color: var(--c-text);
    text-align: left;
    border: 0;
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-sm);
  }
  .load:hover { background: var(--c-surface); }
  .meta { font-size: 0.7rem; color: var(--c-text-faint); }
  .del {
    background: transparent;
    color: var(--c-text-faint);
    border: 0;
    padding: 4px 10px;
    font-size: 18px;
    line-height: 1;
  }
  .del:hover { color: var(--c-error); }

  .empty {
    padding: var(--sp-3);
    text-align: center;
    color: var(--c-text-faint);
    font-size: var(--fs-sm);
    font-style: italic;
    margin: 0;
  }
</style>
