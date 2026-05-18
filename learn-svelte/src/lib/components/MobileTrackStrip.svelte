<!--
  Mobile-only horizontal module switcher. The desktop sidebar is hidden
  under 760px (see app.css .shell-side rule), which leaves no nav. This
  strip replaces it: a scroll-snapping row of compact module pills that
  link to each module's first lesson. Desktop hides this entirely.
-->
<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { curriculum } from '$lib/curriculum';
  import { audio } from '$lib/audio/audio.svelte';

  const currentModuleSlug = $derived.by(() => {
    const m = page.url.pathname.match(/\/lessons\/([^/]+)\//);
    return m ? m[1] : null;
  });
</script>

<nav class="strip" aria-label="Modules">
  <ol class="pills">
    {#each curriculum as m (m.slug)}
      {@const active = currentModuleSlug === m.slug}
      <li class="pill-li">
        <a
          class="pill"
          class:active
          style="--c-track: {m.color};"
          href={base + `/lessons/${m.slug}/${m.lessons[0].slug}`}
          onclick={() => audio.play('select')}
        >
          <span class="pill-stripe" aria-hidden="true"></span>
          <span class="pill-num lcd">M{String(m.number).padStart(2, '0')}</span>
          <span class="pill-title">{m.title}</span>
        </a>
      </li>
    {/each}
  </ol>
</nav>

<style>
  .strip {
    display: none;
  }

  @media (max-width: 760px) {
    .strip {
      display: block;
      background: var(--c-chrome);
      border-bottom: 1px solid var(--c-border);
      overflow: hidden;
    }
    .pills {
      list-style: none;
      margin: 0;
      padding: var(--sp-2);
      display: flex;
      gap: var(--sp-2);
      overflow-x: auto;
      overflow-y: hidden;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .pills::-webkit-scrollbar { display: none; }
    .pill-li {
      flex: 0 0 auto;
      scroll-snap-align: start;
    }
    .pill {
      --c-track: #888;
      display: grid;
      grid-template-rows: auto 1fr;
      align-content: start;
      gap: 2px;
      width: 80px;
      height: 56px;
      padding: 6px 8px;
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-left: 3px solid var(--c-track);
      border-radius: var(--r-sm);
      text-decoration: none;
      color: var(--c-text);
      transition: background var(--d-fast), border-color var(--d-fast);
      position: relative;
      overflow: hidden;
    }
    .pill:hover { text-decoration: none; }
    .pill.active {
      background: color-mix(in srgb, var(--c-track) 14%, var(--c-surface));
      border-color: var(--c-border-strong);
      border-left-color: var(--c-track);
      box-shadow: 0 0 8px -2px var(--c-track);
    }
    .pill-stripe {
      /* Reserved: the visible "stripe" is the 3px border-left above. This
         span is left as an a11y-friendly hook for future indicators. */
      display: none;
    }
    .pill-num {
      font-family: var(--font-mono);
      font-size: 0.6rem;
      color: var(--c-text-faint);
      letter-spacing: 0.06em;
    }
    .pill.active .pill-num { color: var(--c-text-muted); }
    .pill-title {
      font-size: 0.65rem;
      line-height: 1.15;
      font-weight: 500;
      color: var(--c-text);
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
  }
</style>
