<!--
  Status LED — small glowing dot + optional label.
  Models the indicator lights on hardware control surfaces. Variants are
  semantic, not arbitrary colors, so usage stays consistent across the site.

    <Led variant="rec" label="REC" />     red, blinking — recording / processing
    <Led variant="live" label="LIVE" />   green, steady — running / playing
    <Led variant="ready" label="READY" /> dim green, steady — idle, ready to go
    <Led variant="loading" label="…" />   amber, blinking — loading
    <Led variant="error" label="ERR" />   red, steady — broken
    <Led variant="idle" />                gray, off — explicitly off
-->
<script lang="ts">
  type Variant = 'rec' | 'live' | 'ready' | 'loading' | 'error' | 'idle';
  type Props = {
    variant?: Variant;
    label?: string;
    /** Compact = no border around the chip, just the dot + label. */
    compact?: boolean;
  };
  let { variant = 'ready', label, compact = false }: Props = $props();
</script>

<span class="led" class:compact data-variant={variant} aria-hidden="true">
  <span class="dot"></span>
  {#if label}<span class="label">{label}</span>{/if}
</span>

<style>
  .led {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px 3px 7px;
    border-radius: 99px;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    font-family: var(--font-lcd);
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    line-height: 1;
    color: var(--c-text-muted);
    user-select: none;
    font-variant-numeric: tabular-nums;
  }
  .led.compact {
    background: transparent;
    border: 0;
    padding: 0;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 99px;
    background: var(--c-text-faint);
    box-shadow: 0 0 0 0 transparent;
    transition: background var(--d-fast), box-shadow var(--d-fast);
  }
  .label { color: var(--c-text-muted); }

  /* ── variants ───────────────────────────────────────────────────── */
  .led[data-variant='rec'] .dot {
    background: #ff4040;
    box-shadow: 0 0 8px #ff4040;
    animation: led-blink 0.85s ease-in-out infinite;
  }
  .led[data-variant='rec'] .label { color: #ff6464; }

  .led[data-variant='live'] .dot {
    background: #5cd991;
    box-shadow: 0 0 8px #5cd991;
  }
  .led[data-variant='live'] .label { color: #5cd991; }

  .led[data-variant='ready'] .dot {
    background: #5cd991;
    box-shadow: 0 0 4px #5cd991;
    opacity: 0.55;
  }

  .led[data-variant='loading'] .dot {
    background: #f0c050;
    box-shadow: 0 0 8px #f0c050;
    animation: led-blink 0.55s ease-in-out infinite;
  }
  .led[data-variant='loading'] .label { color: #f0c050; }

  .led[data-variant='error'] .dot {
    background: #ff4040;
    box-shadow: 0 0 10px #ff4040;
  }
  .led[data-variant='error'] .label { color: #ff6464; }

  .led[data-variant='idle'] .dot {
    background: var(--c-text-faint);
    box-shadow: none;
    opacity: 0.4;
  }

  @keyframes led-blink {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.35; }
  }
</style>
