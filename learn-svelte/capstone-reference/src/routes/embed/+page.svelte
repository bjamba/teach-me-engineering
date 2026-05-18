<!--
  /embed — the sequencer alone, sized to fit inside an iframe. Useful for
  embedding the DAW on another page (e.g. a blog post). No surrounding chrome.
-->
<script lang="ts">
  import Sequencer from '$lib/components/Sequencer.svelte';
  import TransportBar from '$lib/components/TransportBar.svelte';
  import FftVisualizer from '$lib/components/FftVisualizer.svelte';
</script>

<svelte:head><title>Svelte DAW · embed</title></svelte:head>

<main class="embed">
  <TransportBar />
  <Sequencer />
  <div class="strip"><FftVisualizer /></div>
</main>

<style>
  .embed {
    padding: var(--sp-3);
  }
  .strip { margin-top: var(--sp-3); }
</style>
