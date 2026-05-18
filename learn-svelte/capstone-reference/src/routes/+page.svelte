<!--
  The main DAW UI. Composes every component.
-->
<script lang="ts">
  import Sequencer from '$lib/components/Sequencer.svelte';
  import TransportBar from '$lib/components/TransportBar.svelte';
  import FftVisualizer from '$lib/components/FftVisualizer.svelte';
  import EffectPanels from '$lib/components/EffectPanels.svelte';
  import Mixer from '$lib/components/Mixer.svelte';
  import SavedPatterns from '$lib/components/SavedPatterns.svelte';
  import Recordings from '$lib/components/Recordings.svelte';
</script>

<svelte:head><title>Svelte DAW</title></svelte:head>

<main class="page">
  <header class="page-head">
    <h1>SVELTE <span class="accent">DAW</span></h1>
    <p class="sub">A 4-track step sequencer. Tone.js + Svelte 5 runes.</p>
  </header>

  <TransportBar />
  <Sequencer />
  <div class="strip"><FftVisualizer /></div>

  <div class="panels">
    <EffectPanels />
  </div>

  <div class="mixer-wrap">
    <Mixer />
  </div>

  <div class="sidebars">
    <SavedPatterns />
    <Recordings />
  </div>
</main>

<style>
  .page {
    max-width: 1180px;
    margin: 0 auto;
    padding: var(--sp-5) var(--sp-4) var(--sp-7);
  }
  .page-head {
    margin-bottom: var(--sp-4);
  }
  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--fs-2xl);
    letter-spacing: 0.04em;
    font-weight: 800;
  }
  .accent { color: var(--c-accent); }
  .sub {
    margin: 4px 0 0;
    color: var(--c-text-muted);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.08em;
  }
  .strip { margin-top: var(--sp-3); }
  .panels { margin-top: var(--sp-3); }
  .mixer-wrap { margin-top: var(--sp-3); }
  .sidebars {
    margin-top: var(--sp-3);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-3);
  }
  @media (max-width: 720px) {
    .sidebars { grid-template-columns: 1fr; }
  }
</style>
