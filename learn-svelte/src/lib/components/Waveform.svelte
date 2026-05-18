<!--
  Renders a per-module waveform signature in the module's track color.
  On hover, the path "writes itself in" via a stroke-dashoffset animation
  (cheap effect, big payoff — feels like the waveform is being drawn live).

  Used in: ModuleCard (head row), LessonHeader (meta line), Sidebar (track row).
-->
<script lang="ts">
  import { getWaveform, approxLength, VIEWBOX } from '$lib/waveforms';

  type Props = {
    moduleSlug: string;
    /** Width in px. Height scales 2:1 with width by default. */
    width?: number;
    /** Override on aspect ratio (default 2:1, matching viewBox 24×12). */
    height?: number;
    /** Stroke color; defaults to currentColor so the parent's color drives it. */
    color?: string;
    /** Animate the path "writing in" on hover of an ancestor with [data-wf-host]. */
    drawOnHostHover?: boolean;
  };

  let {
    moduleSlug,
    width = 28,
    height,
    color = 'currentColor',
    drawOnHostHover = true
  }: Props = $props();

  const wf = $derived(getWaveform(moduleSlug));
  const len = $derived(wf ? Math.max(40, Math.ceil(approxLength(wf))) : 100);
  const computedH = $derived(height ?? Math.round(width / 2));
</script>

{#if wf}
  <svg
    class="wf"
    class:draw-on-hover={drawOnHostHover}
    viewBox={VIEWBOX}
    width={width}
    height={computedH}
    fill="none"
    stroke={color}
    stroke-linecap="round"
    stroke-linejoin="round"
    style="--wf-len: {len};"
    aria-hidden="true"
  >
    {#each wf.paths as d (d)}
      <path {d} stroke-width={wf.strokeWidth ?? 1.5} />
    {/each}
  </svg>
{/if}

<style>
  .wf {
    overflow: visible;
    flex-shrink: 0;
  }
  .wf path {
    transition: stroke-dashoffset 480ms cubic-bezier(0.65, 0, 0.35, 1);
  }
  /* Default: paths are fully drawn. */
  .wf:not(.draw-on-hover) path { stroke-dasharray: none; }

  /* "Draw in" effect: paths start invisible, then draw on host hover.
     Host element must have [data-wf-host] attribute. */
  .wf.draw-on-hover path {
    stroke-dasharray: var(--wf-len);
    stroke-dashoffset: var(--wf-len);
    opacity: 0.65;
    transition:
      stroke-dashoffset 600ms cubic-bezier(0.65, 0, 0.35, 1),
      opacity 200ms ease-out;
  }
  :global([data-wf-host]:hover) .wf.draw-on-hover path,
  :global([data-wf-host].active) .wf.draw-on-hover path {
    stroke-dashoffset: 0;
    opacity: 1;
  }
</style>
