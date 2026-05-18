<!--
  Bottom-of-lesson sources panel. Pass either explicit IDs, or a lessonKey
  to look up via lessonCitations.
-->
<script lang="ts">
  import { citationsForLesson, getSources, type Source } from '$lib/sources';

  type Props = { lessonKey?: string; ids?: string[] };
  let { lessonKey, ids }: Props = $props();

  const items = $derived<Source[]>(
    ids ? getSources(ids) : lessonKey ? citationsForLesson(lessonKey) : []
  );
</script>

{#if items.length}
  <section class="sources">
    <h3>Sources</h3>
    <p class="note">
      What this lesson draws on. Anything stated as fact in the lesson should
      be checkable against one of these — if it isn't, that's a bug, tell me.
    </p>
    <ul>
      {#each items as s (s.id)}
        <li>
          <span class="type" data-type={s.type}>{s.type}</span>
          <div class="meta">
            <div class="title">
              {#if s.url}<a href={s.url} target="_blank" rel="noopener">{s.title}</a>
              {:else}{s.title}{/if}
            </div>
            <div class="byline">
              {#if s.authors?.length}{s.authors.join(', ')} · {/if}
              {#if s.venue}{s.venue}{/if}
              {#if s.year} · {s.year}{/if}
            </div>
            {#if s.note}<div class="note-line">{s.note}</div>{/if}
          </div>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .sources {
    margin-top: var(--sp-7);
    padding: var(--sp-5);
    background: var(--c-bg-card);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
  }
  h3 {
    margin: 0 0 var(--sp-2);
    font-size: var(--fs-md);
    letter-spacing: -0.01em;
  }
  .note {
    margin: 0 0 var(--sp-4);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  li {
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: var(--sp-3);
    align-items: start;
  }
  .type {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 6px;
    border-radius: var(--r-sm);
    background: color-mix(in srgb, var(--c-track, var(--c-accent)) 16%, transparent);
    color: var(--c-track, var(--c-accent));
    text-align: center;
    line-height: 1.5;
    align-self: start;
  }
  .meta { display: flex; flex-direction: column; gap: 2px; }
  .title { font-size: var(--fs-sm); color: var(--c-text); }
  .byline {
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    font-family: var(--font-mono);
  }
  .note-line {
    margin-top: 4px;
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    line-height: 1.5;
  }
</style>
