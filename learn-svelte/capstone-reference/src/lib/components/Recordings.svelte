<!--
  Recordings sidebar. Lists captured WebM blobs from IndexedDB, with inline
  preview, download, and delete.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { audio, type Recording } from '$lib/audio/engine.svelte';

  // Cache object URLs per recording so we don't leak / regenerate every render.
  const urlCache = new Map<string, string>();

  function urlFor(r: Recording) {
    const cached = urlCache.get(r.id);
    if (cached) return cached;
    const url = URL.createObjectURL(r.blob);
    urlCache.set(r.id, url);
    return url;
  }

  function download(r: Recording) {
    const url = urlFor(r);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daw-${r.recordedAt.slice(0, 19).replace(/[:T]/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function remove(r: Recording) {
    const cached = urlCache.get(r.id);
    if (cached) {
      URL.revokeObjectURL(cached);
      urlCache.delete(r.id);
    }
    await audio.deleteRecording(r.id);
  }

  onMount(() => {
    void audio.loadRecordings();
  });
</script>

<aside class="recs">
  <h3>RECORDINGS</h3>

  {#if audio.recordings.length === 0}
    <p class="empty">click ● REC, play your pattern, click ■ to stop</p>
  {:else}
    <ul>
      {#each audio.recordings as r (r.id)}
        <li>
          <div class="rec-meta">
            <span class="when">{new Date(r.recordedAt).toLocaleString()}</span>
            <span class="dur lcd">{r.durationSec.toFixed(1)}s</span>
          </div>
          <audio controls src={urlFor(r)}></audio>
          <div class="rec-actions">
            <button type="button" onclick={() => download(r)}>download</button>
            <button type="button" class="del" onclick={() => remove(r)}>delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</aside>

<style>
  .recs {
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
  .empty {
    padding: var(--sp-3);
    text-align: center;
    color: var(--c-text-faint);
    font-size: var(--fs-sm);
    font-style: italic;
    margin: 0;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  li {
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    padding: var(--sp-2);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .rec-meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
  }
  .when { font-family: var(--font-mono); }
  .dur { color: var(--c-accent); font-size: 0.72rem; }
  audio { width: 100%; height: 32px; }
  .rec-actions { display: flex; gap: 4px; }
  .rec-actions button {
    flex: 1;
    padding: 6px;
    background: var(--c-surface);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    font: inherit;
    font-size: var(--fs-xs);
    cursor: pointer;
  }
  .rec-actions button:hover { border-color: var(--c-border-strong); }
  .rec-actions .del { background: transparent; color: var(--c-text-faint); }
  .rec-actions .del:hover { color: var(--c-error); }
</style>
