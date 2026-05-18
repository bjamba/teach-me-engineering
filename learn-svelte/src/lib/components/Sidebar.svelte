<!--
  Track-list sidebar. Each module is a row with its signature color, the
  module title, the verb, and a per-module progress fill. Clicking expands
  the lessons within. Active lesson gets highlighted.
-->
<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { curriculum } from '$lib/curriculum';
  import { progress, lessonKey } from '$lib/stores/progress.svelte';
  import { audio } from '$lib/audio/audio.svelte';
  import Waveform from '$lib/components/Waveform.svelte';

  const currentModuleSlug = $derived.by(() => {
    const m = page.url.pathname.match(/\/lessons\/([^/]+)\//);
    return m ? m[1] : null;
  });

  function isLessonActive(modSlug: string, lessonSlug: string) {
    return page.url.pathname.includes(`/lessons/${modSlug}/${lessonSlug}`);
  }

  function pctFor(modSlug: string, lessons: { slug: string }[]) {
    const done = lessons.filter((l) => progress.isComplete(lessonKey(modSlug, l.slug))).length;
    return Math.round((done / lessons.length) * 100);
  }
</script>

<aside class="side">
  <div class="head">
    <span class="head-label">Tracks</span>
    <span class="head-count">{curriculum.length}</span>
  </div>

  <ol class="tracks">
    {#each curriculum as m (m.slug)}
      {@const expanded = currentModuleSlug === m.slug}
      {@const pct = pctFor(m.slug, m.lessons)}
      <li class="track" class:expanded style="--c-track: {m.color};" data-wf-host>
        <a
          class="track-row"
          href={base + `/lessons/${m.slug}/${m.lessons[0].slug}`}
          onclick={() => audio.play('select')}
        >
          <span class="track-num lcd">M{String(m.number).padStart(2, '0')}</span>
          <span class="track-color-bar"></span>
          <span class="track-body">
            <span class="track-title">{m.title}</span>
            <span class="track-verb-row">
              <span class="track-verb">{m.verb}</span>
              <span class="track-wf" style="color: {m.color};">
                <Waveform moduleSlug={m.slug} width={26} height={8} />
              </span>
            </span>
          </span>
          <span class="track-meter">
            <span class="track-meter-fill" style="height: {pct}%"></span>
          </span>
        </a>

        {#if expanded}
          <ul class="lessons">
            {#each m.lessons as l, i (l.slug)}
              {@const active = isLessonActive(m.slug, l.slug)}
              {@const done = progress.isComplete(lessonKey(m.slug, l.slug))}
              <li>
                <a
                  class="lesson"
                  class:active
                  class:done
                  href={base + `/lessons/${m.slug}/${l.slug}`}
                  onclick={() => audio.play('click')}
                >
                  <span class="lesson-mark" aria-hidden="true">
                    {#if done}✓{:else if active}▸{:else}·{/if}
                  </span>
                  <span class="lesson-num">{String(m.number)}.{i + 1}</span>
                  <span class="lesson-title">{l.title}</span>
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ol>
</aside>

<style>
  .side {
    background: var(--c-chrome);
    border-right: 1px solid var(--c-border);
    height: 100%;
    padding: var(--sp-3) 0;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sp-2) var(--sp-4);
    margin-bottom: var(--sp-2);
  }
  .head-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--c-text-faint);
  }
  .head-count {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    background: var(--c-surface);
    padding: 2px 6px;
    border-radius: var(--r-sm);
  }

  .tracks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .track {
    --c-track: #888;
  }

  .track-row {
    display: grid;
    grid-template-columns: 36px 4px 1fr 12px;
    align-items: center;
    gap: var(--sp-2);
    padding: 8px 12px;
    text-decoration: none;
    color: var(--c-text);
    border-radius: var(--r-sm);
    margin: 0 var(--sp-2);
    transition: background var(--d-fast);
    height: 44px;
  }
  .track-row:hover {
    background: var(--c-surface);
    text-decoration: none;
  }
  .track.expanded > .track-row {
    background: var(--c-surface);
  }

  .track-num {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    letter-spacing: 0.06em;
  }
  .track.expanded > .track-row .track-num { color: var(--c-text-muted); }

  .track-color-bar {
    width: 4px;
    height: 26px;
    background: var(--c-track);
    border-radius: 2px;
    box-shadow: 0 0 8px -2px var(--c-track);
  }

  .track-body {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
    min-width: 0;
  }
  .track-title {
    font-size: var(--fs-sm);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--c-text);
  }
  .track-verb-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    margin-top: 2px;
  }
  .track-verb {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    text-transform: lowercase;
    color: var(--c-text-faint);
    letter-spacing: 0.06em;
  }
  .track-wf {
    display: inline-flex;
    align-items: center;
    opacity: 0.45;
    transition: opacity var(--d-fast);
  }
  .track:hover .track-wf,
  .track.expanded .track-wf { opacity: 1; }

  .track-meter {
    width: 8px;
    height: 26px;
    background: var(--c-surface-2);
    border-radius: 2px;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: flex-end;
  }
  .track-meter-fill {
    width: 100%;
    background: var(--c-track);
    transition: height var(--d-slow) var(--ease-spring);
    box-shadow: 0 0 8px -2px var(--c-track);
  }

  .lessons {
    list-style: none;
    margin: 4px 0 var(--sp-3);
    padding: 0 var(--sp-3) 0 var(--sp-5);
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .lesson {
    display: grid;
    grid-template-columns: 16px 24px 1fr;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    text-decoration: none;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    border-radius: var(--r-sm);
    transition: all var(--d-fast);
  }
  .lesson:hover {
    color: var(--c-text);
    background: var(--c-surface);
    text-decoration: none;
  }
  .lesson.active {
    color: var(--c-text);
    background: color-mix(in srgb, var(--c-track) 14%, transparent);
    box-shadow: inset 2px 0 0 var(--c-track);
  }
  .lesson.done .lesson-mark { color: var(--c-success); }
  .lesson-mark {
    text-align: center;
    color: var(--c-text-faint);
    font-family: var(--font-mono);
  }
  .lesson-num {
    font-family: var(--font-mono);
    color: var(--c-text-faint);
    font-size: 0.7rem;
  }
  .lesson-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
