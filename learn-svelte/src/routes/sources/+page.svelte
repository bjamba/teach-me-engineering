<!--
  /sources — the comprehensive bibliography for the entire curriculum.
  Every entry shows which lessons cite it.
-->
<script lang="ts">
  import { base } from '$app/paths';
  import { allSources, lessonsCiting } from '$lib/sources';
  import { curriculum } from '$lib/curriculum';

  const items = allSources();

  // Build a map of lessonKey → human-readable lesson title for the back-link.
  const lessonTitles = new Map<string, { title: string; href: string }>();
  for (const m of curriculum) {
    for (const l of m.lessons) {
      lessonTitles.set(`${m.slug}/${l.slug}`, {
        title: `M${m.number}.${l.slug.split('-')[0]} — ${l.title}`,
        href: `${base}/lessons/${m.slug}/${l.slug}`
      });
    }
  }
</script>

<svelte:head><title>Sources · Make / Svelte</title></svelte:head>

<article class="page prose">
  <header>
    <p class="kicker">Bibliography</p>
    <h1>Sources</h1>
    <p class="lede">
      Every external work this curriculum draws from. Lessons cite specific
      entries here at the bottom of the page, and each entry below lists which
      lessons depend on it. If a claim in a lesson cannot be traced to one of
      these, it's an error — please open an issue.
    </p>
  </header>

  <ul class="list">
    {#each items as s (s.id)}
      <li class="entry">
        <header class="entry-head">
          <span class="type" data-type={s.type}>{s.type}</span>
          <div>
            <div class="title">
              {#if s.url}<a href={s.url} target="_blank" rel="noopener">{s.title}</a>
              {:else}{s.title}{/if}
            </div>
            <div class="byline">
              {#if s.authors?.length}{s.authors.join(', ')}{/if}
              {#if s.venue}{s.authors?.length ? ' · ' : ''}{s.venue}{/if}
              {#if s.year} · {s.year}{/if}
            </div>
          </div>
        </header>
        {#if s.note}<p class="note">{s.note}</p>{/if}
        {#if lessonsCiting(s.id).length}
          <div class="cited">
            <span class="cited-label">Cited in:</span>
            <ul class="cited-list">
              {#each lessonsCiting(s.id) as key (key)}
                {@const ref = lessonTitles.get(key)}
                {#if ref}
                  <li><a href={ref.href}>{ref.title}</a></li>
                {/if}
              {/each}
            </ul>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</article>

<style>
  .page {
    max-width: 820px;
    margin: 0 auto;
    padding: var(--sp-7) var(--sp-5);
  }

  header { margin-bottom: var(--sp-6); }
  .kicker {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--c-accent);
    margin: 0 0 var(--sp-3);
  }
  h1 { margin: 0 0 var(--sp-3); font-size: var(--fs-2xl); letter-spacing: -0.025em; }
  .lede { color: var(--c-text-muted); margin: 0; }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }

  .entry {
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    background: var(--c-bg-card);
  }

  .entry-head {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: var(--sp-3);
    align-items: start;
  }

  .type {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 4px 8px;
    border-radius: var(--r-sm);
    background: var(--c-accent-soft);
    color: var(--c-accent);
    text-align: center;
  }

  .title {
    font-size: var(--fs-md);
    color: var(--c-text);
  }
  .byline {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    margin-top: 2px;
  }

  .note {
    margin: var(--sp-3) 0 0 calc(80px + var(--sp-3));
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }

  .cited {
    margin: var(--sp-3) 0 0 calc(80px + var(--sp-3));
    padding-top: var(--sp-3);
    border-top: 1px dashed var(--c-border);
  }
  .cited-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--c-text-faint);
  }
  .cited-list {
    list-style: none;
    margin: var(--sp-2) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cited-list a {
    font-size: var(--fs-sm);
  }
</style>
