<script lang="ts">
  import '../app.css';
  import TitleBar from '$lib/components/TitleBar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import MobileTrackStrip from '$lib/components/MobileTrackStrip.svelte';
  import { onMount } from 'svelte';

  let { children } = $props();

  onMount(() => {
    const saved = localStorage.getItem('svelte_theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.dataset.theme = saved;
    }
  });
</script>

<div class="shell">
  <div class="shell-title">
    <TitleBar />
  </div>
  <div class="shell-side">
    <Sidebar />
  </div>
  <div class="shell-content">
    <MobileTrackStrip />
    {@render children()}
  </div>
</div>
