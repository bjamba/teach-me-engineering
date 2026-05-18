<!--
  /demos — gallery of music-themed interactive widgets built with Svelte +
  Web Audio. Each demo is a self-contained component from $lib/sandbox.
  This page is inspiration, not curriculum: read the source on each one to
  see how it's built.
-->
<script lang="ts">
  import Sequencer from '$lib/sandbox/Sequencer.svelte';
  import KeyboardVisualizer from '$lib/sandbox/KeyboardVisualizer.svelte';
  import ToneGrid from '$lib/sandbox/ToneGrid.svelte';
  import SignalPatchDiagram from '$lib/sandbox/SignalPatchDiagram.svelte';

  type Demo = {
    id: string;
    label: string;
    title: string;
    description: string;
    interesting: string;
  };

  const demos: Demo[] = [
    {
      id: 'sequencer',
      label: '01 · STEP SEQUENCER',
      title: 'Step Sequencer',
      description:
        "A 4-track 16-step beat machine. Click cells to toggle, press play, drag the BPM. Demonstrates Tone.js scheduling, fine-grained reactivity per cell, and a real-time FFT visualizer. The capstone DAW is a more elaborate version of this.",
      interesting:
        "Each cell is its own reactive $state — no diffing a 64-element array on every toggle. The transport runs on Tone.Transport so timing stays sample-accurate even when the main thread stutters."
    },
    {
      id: 'keyboard',
      label: '02 · KEYBOARD VISUALIZER',
      title: 'Keyboard Visualizer',
      description:
        "A playable mini keyboard with a live spectrum + particle visualizer. Use mouse or computer keys. Demonstrates polyphonic synthesis, requestAnimationFrame visualization, and event handling for both mouse and keyboard input.",
      interesting:
        "The visualizer pulls FFT data inside an rAF loop while Svelte handles the key state — two timing domains, cleanly separated. Held keys map directly to a PolySynth voice pool."
    },
    {
      id: 'tone-grid',
      label: '03 · TONE GRID',
      title: 'Tone Grid',
      description:
        "Move your mouse across a 2D grid; position controls pitch and timbre, movement triggers notes with visual ripples. Demonstrates continuous-control audio, mouse trail tracking, and how a small synth + clever input mapping can feel like a real instrument.",
      interesting:
        "X maps to a quantized pitch scale, Y to filter cutoff. The ripple trail is a bounded array of points re-rendered each frame — a tiny example of decoupling input from render."
    },
    {
      id: 'signal-patch',
      label: '04 · SIGNAL PATCH DIAGRAM',
      title: 'Signal Patch Diagram',
      description:
        "A modular-synth-style patch diagram showing audio routing as visible cables with signal flowing through them. Adjust effect knobs, trigger sources. Demonstrates Web Audio's graph model, SVG-based visualization, and parameter automation with reactive bindings.",
      interesting:
        "Cables are SVG paths animated with a stroke-dashoffset loop; their thickness is bound to live RMS readings from the underlying AudioNode. The graph itself is plain Web Audio — Svelte just paints it."
    }
  ];
</script>

<svelte:head><title>Demos · Make / Svelte</title></svelte:head>

<article class="page">
  <header>
    <p class="kicker">DEMOS · INSPIRATION</p>
    <h1>Music demos</h1>
    <p class="lede">
      Interactive widgets built with Svelte and the Web Audio API. Each one
      is a starting point — view the source on this site to see how it's
      built. The capstone DAW you'll build in modules 6 and 7 combines
      techniques from all of these.
    </p>
  </header>

  <div class="demos">
    {#each demos as d (d.id)}
      <section class="demo" id={d.id}>
        <p class="lcd label">{d.label}</p>
        <h2 class="demo-title">{d.title}</h2>
        <p class="demo-desc">{d.description}</p>

        <div class="stage">
          {#if d.id === 'sequencer'}
            <Sequencer />
          {:else if d.id === 'keyboard'}
            <KeyboardVisualizer />
          {:else if d.id === 'tone-grid'}
            <ToneGrid />
          {:else if d.id === 'signal-patch'}
            <SignalPatchDiagram />
          {/if}
        </div>

        <aside class="callout">
          <span class="callout-tag">What's interesting</span>
          <p>{d.interesting}</p>
        </aside>
      </section>
    {/each}
  </div>

  <footer class="page-footer">
    <p>
      These all live at <code>src/lib/sandbox/</code>. Build similar things
      by combining Tone.js (for audio), the Svelte rune system (for state
      and reactivity), and <code>&lt;canvas&gt;</code> or SVG (for visuals).
      The patterns are reusable.
    </p>
  </footer>
</article>

<style>
  .page {
    max-width: 820px;
    margin: 0 auto;
    padding: var(--sp-7) var(--sp-5);
  }

  header { margin-bottom: var(--sp-7); }
  .kicker {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--c-accent);
    margin: 0 0 var(--sp-3);
  }
  h1 {
    margin: 0 0 var(--sp-3);
    font-size: var(--fs-2xl);
    letter-spacing: -0.025em;
    line-height: var(--lh-tight);
  }
  .lede {
    color: var(--c-text-muted);
    margin: 0;
    font-size: var(--fs-md);
  }

  .demos {
    display: flex;
    flex-direction: column;
    gap: var(--sp-7);
  }

  .demo {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding-top: var(--sp-6);
    border-top: 1px solid var(--c-border);
  }
  .demo:first-child {
    border-top: none;
    padding-top: 0;
  }

  .label {
    display: inline-block;
    align-self: flex-start;
    margin: 0;
    padding: 4px 10px;
    font-size: var(--fs-xs);
    color: var(--c-accent);
    background: var(--c-accent-soft);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
  }

  .demo-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--fs-xl);
    letter-spacing: -0.02em;
    line-height: var(--lh-tight);
    color: var(--c-text);
  }

  .demo-desc {
    margin: 0;
    color: var(--c-text-muted);
    font-size: var(--fs-md);
    max-width: 64ch;
  }

  .stage {
    margin-top: var(--sp-3);
    padding: var(--sp-4);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    background: var(--c-card);
    box-shadow: var(--shadow-card);
    /* let demos breathe wider than the prose column when they want to */
    width: 100%;
  }

  .callout {
    margin-top: var(--sp-2);
    padding: var(--sp-3) var(--sp-4);
    border-left: 3px solid var(--c-accent);
    background: color-mix(in srgb, var(--c-accent) 6%, transparent);
    border-radius: 0 var(--r-md) var(--r-md) 0;
  }
  .callout-tag {
    display: block;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--c-accent);
    margin-bottom: 4px;
  }
  .callout p {
    margin: 0;
    color: var(--c-text);
    font-size: var(--fs-sm);
    line-height: var(--lh-snug);
  }

  .page-footer {
    margin-top: var(--sp-7);
    padding-top: var(--sp-5);
    border-top: 1px solid var(--c-border);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .page-footer p { margin: 0; }
  .page-footer code {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    padding: 1px 6px;
    border-radius: var(--r-sm);
    color: var(--c-text);
  }

  @media (min-width: 1100px) {
    /* let demos break out a bit wider than the prose column on big screens */
    .stage {
      margin-left: calc(var(--sp-6) * -1);
      margin-right: calc(var(--sp-6) * -1);
    }
  }
</style>
