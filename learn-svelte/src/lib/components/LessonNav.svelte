<!--
  Prev/next navigation at the bottom of every lesson, plus a "mark complete"
  toggle. Reads the curriculum spine to figure out neighbors based on the
  current URL.
-->
<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { curriculum, flattenLessons } from '$lib/curriculum';
  import { progress, lessonKey } from '$lib/stores/progress.svelte';
  import { audio } from '$lib/audio/audio.svelte';

  function handleToggle() {
    if (!key) return;
    const wasComplete = progress.isComplete(key);
    progress.toggle(key);
    if (!wasComplete) {
      // Play the bigger fanfare if this completion finished the whole module.
      const mod = here?.module;
      if (mod) {
        const allDone = mod.lessons.every((l) =>
          progress.isComplete(lessonKey(mod.slug, l.slug))
        );
        audio.play(allDone ? 'module_done' : 'complete');
      } else {
        audio.play('complete');
      }
    } else {
      audio.play('click');
    }
  }

  const all = flattenLessons();

  const here = $derived.by(() => {
    const path = page.url.pathname.replace(/\/$/, '');
    return all.find((r) => path.endsWith(r.href));
  });

  const key = $derived(here ? lessonKey(here.module.slug, here.lesson.slug) : '');
  const done = $derived(key ? progress.isComplete(key) : false);
</script>

{#if here}
  <nav class="lesson-nav">
    <button
      class="complete"
      class:done
      type="button"
      onclick={handleToggle}
    >
      <span class="check" aria-hidden="true">{done ? '✓' : ''}</span>
      <span class="complete-label">{done ? 'Lesson complete' : 'Mark complete'}</span>
    </button>

    <div class="prev-next">
      {#if here.prev}
        <a class="link prev" href={base + here.prev.href} onclick={() => audio.play('click')}>
          <span class="dir">← Previous</span>
          <span class="title">{here.prev.lesson.title}</span>
        </a>
      {:else}
        <a class="link prev" href={base + '/'} onclick={() => audio.play('click')}>
          <span class="dir">← Dashboard</span>
          <span class="title">Course home</span>
        </a>
      {/if}
      {#if here.next}
        <a class="link next" href={base + here.next.href} onclick={() => audio.play('select')}>
          <span class="dir">Next →</span>
          <span class="title">{here.next.lesson.title}</span>
        </a>
      {/if}
    </div>
  </nav>
{/if}

<style>
  .lesson-nav {
    margin-top: var(--sp-7);
    padding-top: var(--sp-5);
    border-top: 1px solid var(--c-border);
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }

  .complete {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    background: transparent;
    border: 1px solid var(--c-border-strong);
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-sm);
    padding: 8px 14px 8px 10px;
    border-radius: 99px;
    cursor: pointer;
    transition: background var(--d-fast), border-color var(--d-fast), color var(--d-fast);
  }
  .complete:hover { border-color: var(--c-track, var(--c-accent)); color: var(--c-track, var(--c-accent)); }
  .complete .check {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 99px;
    border: 1px solid var(--c-border-strong);
    color: white;
    background: transparent;
    font-size: 10px;
    transition: all var(--d-mid) var(--ease-spring);
  }
  .complete.done {
    border-color: var(--c-success);
    color: var(--c-success);
  }
  .complete.done .check {
    background: var(--c-success);
    border-color: var(--c-success);
  }

  .prev-next {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-3);
  }
  @media (max-width: 600px) {
    .prev-next { grid-template-columns: 1fr; }
  }

  .link {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--sp-3) var(--sp-4);
    background: var(--c-bg-card);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    color: var(--c-text);
    text-decoration: none;
    transition: border-color var(--d-mid), transform var(--d-mid) var(--ease-out);
  }
  .link:hover {
    border-color: var(--c-border-strong);
    transform: translateY(-1px);
    text-decoration: none;
  }
  .link.next { text-align: right; align-items: flex-end; }
  .dir {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-track, var(--c-accent));
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .title {
    font-size: var(--fs-sm);
    color: var(--c-text);
    line-height: 1.3;
  }
</style>
