<!--
  Track-style lesson header. The colored stripe at top is the module's
  signature color; the chrome below is denser and more "creative tool"
  than the previous blog-style header.
-->
<script lang="ts">
  import { curriculum } from '$lib/curriculum';
  import Waveform from '$lib/components/Waveform.svelte';

  type Props = {
    moduleSlug: string;
    lessonSlug: string;
    title: string;
    /** Optional one-paragraph blurb under the title. */
    blurb?: string;
  };
  let { moduleSlug, lessonSlug, title, blurb }: Props = $props();

  const module = $derived(curriculum.find((m) => m.slug === moduleSlug));
  const lessonIdx = $derived(
    module ? module.lessons.findIndex((l) => l.slug === lessonSlug) : -1
  );
  const lesson = $derived(module && lessonIdx >= 0 ? module.lessons[lessonIdx] : null);
  const trackColor = $derived(module?.color ?? 'var(--c-accent)');
</script>

{#if module && lesson}
  <header class="lhead active" style="--c-track: {trackColor};" data-wf-host>
    <div class="stripe"></div>
    <div class="meta">
      <span class="modref">
        <span class="num">M{String(module.number).padStart(2, '0')}</span>
        <span class="dot"></span>
        <span class="modtitle">{module.title}</span>
      </span>
      <span class="wf-slot" style="color: {trackColor};">
        <Waveform moduleSlug={module.slug} width={48} drawOnHostHover={false} />
      </span>
      <span class="verb">{module.verb}</span>
    </div>
    <h1 class="title">{title}</h1>
    {#if blurb}<p class="blurb">{blurb}</p>{/if}
    <div class="chips">
      <span class="chip">Lesson {module.number}.{lessonIdx + 1}</span>
      <span class="chip muted">{lesson.minutes} min</span>
    </div>
  </header>
{/if}

<style>
  .lhead {
    --c-track: var(--c-accent);
    margin: 0 calc(var(--sp-6) * -1) var(--sp-6);
    padding: var(--sp-6) var(--sp-6) var(--sp-5);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--c-track) 8%, transparent),
      transparent 80%
    );
    border-bottom: 1px solid var(--c-border);
    position: relative;
  }
  .stripe {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--c-track);
    box-shadow: 0 0 10px -2px var(--c-track);
  }

  .meta {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--c-text-muted);
    margin-bottom: var(--sp-3);
  }
  .modref { display: inline-flex; align-items: center; gap: var(--sp-2); }
  .num {
    color: var(--c-track);
    font-weight: 700;
  }
  .dot {
    width: 5px;
    height: 5px;
    background: var(--c-track);
    border-radius: 99px;
    box-shadow: 0 0 6px var(--c-track);
    display: inline-block;
  }
  .modtitle { color: var(--c-text); font-weight: 500; }
  .wf-slot {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
  }
  .verb {
    color: var(--c-text-faint);
    letter-spacing: 0.12em;
  }

  .title {
    font-family: var(--font-display);
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    line-height: 1.05;
    letter-spacing: -0.025em;
    font-weight: 800;
    margin: 0 0 var(--sp-3);
    color: var(--c-text);
    max-width: 22ch;
  }

  .blurb {
    margin: 0 0 var(--sp-4);
    color: var(--c-text-muted);
    font-size: var(--fs-md);
    max-width: 60ch;
  }

  .chips {
    display: flex;
    gap: var(--sp-2);
  }
  .chip {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    padding: 4px 10px;
    border-radius: 99px;
    background: color-mix(in srgb, var(--c-track) 16%, transparent);
    color: var(--c-track);
    letter-spacing: 0.04em;
  }
  .chip.muted {
    background: var(--c-surface);
    color: var(--c-text-faint);
  }
</style>
