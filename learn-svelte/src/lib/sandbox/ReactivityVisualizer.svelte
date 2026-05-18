<!--
  ReactivityVisualizer — headline interactive for Module 2.
  Visualizes the signal graph of a small Svelte 5 example: $state nodes
  feeding $derived nodes feeding a $effect. Mutations on the left pane
  pulse their node and shoot a particle along each outgoing edge to
  every dependent, which then pulses in turn.

  The example is hard-coded: source code is not parsed at runtime.
  The user-typed-source variant is a future iteration.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import Led from '$lib/components/Led.svelte';

  type Props = { height?: string };
  let { height = '520px' }: Props = $props();

  // ── the example component's state ─────────────────────────────────
  let count = $state(0);
  let ascending = $state(true);
  let doubled = $derived(count * 2);
  let tripled = $derived(count * 3);
  let direction = $derived(ascending ? 'up' : 'down');
  let message = $derived(`${count} going ${direction}`);

  // logger is the $effect node. Keep its log line for the readout.
  let lastLog = $state('logger idle');
  $effect(() => {
    // Read both deps so the effect actually subscribes to them.
    const c = count;
    const a = ascending;
    lastLog = `count=${c} dir=${a ? 'up' : 'down'}`;
    fire('logger');
  });

  // ── graph topology ────────────────────────────────────────────────
  type NodeKind = 'state' | 'derived' | 'effect';
  type GraphNode = {
    id: string;
    label: string;
    kind: NodeKind;
    x: number;
    y: number;
  };

  // Hand-positioned. Canvas viewBox is 520x360.
  const NODES: GraphNode[] = [
    { id: 'count',     label: 'count',     kind: 'state',   x:  70, y:  90 },
    { id: 'ascending', label: 'ascending', kind: 'state',   x:  70, y: 260 },
    { id: 'doubled',   label: 'doubled',   kind: 'derived', x: 260, y:  60 },
    { id: 'tripled',   label: 'tripled',   kind: 'derived', x: 260, y: 160 },
    { id: 'message',   label: 'message',   kind: 'derived', x: 260, y: 280 },
    { id: 'logger',    label: 'logger',    kind: 'effect',  x: 450, y: 180 }
  ];

  type Edge = { id: string; from: string; to: string };
  const EDGES: Edge[] = [
    { id: 'count-doubled',   from: 'count',     to: 'doubled' },
    { id: 'count-tripled',   from: 'count',     to: 'tripled' },
    { id: 'count-message',   from: 'count',     to: 'message' },
    { id: 'count-logger',    from: 'count',     to: 'logger' },
    { id: 'asc-message',     from: 'ascending', to: 'message' },
    { id: 'asc-logger',      from: 'ascending', to: 'logger' }
  ];

  function nodeById(id: string): GraphNode {
    const n = NODES.find((x) => x.id === id);
    if (!n) throw new Error(`unknown node ${id}`);
    return n;
  }

  function edgePath(from: GraphNode, to: GraphNode): string {
    // Cubic bezier with horizontal control handles for a clean left-to-right flow.
    const dx = (to.x - from.x) * 0.55;
    const c1x = from.x + dx;
    const c1y = from.y;
    const c2x = to.x - dx;
    const c2y = to.y;
    return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
  }

  function colorVar(kind: NodeKind): string {
    if (kind === 'state') return 'var(--c-track-2)';
    if (kind === 'derived') return 'var(--c-success)';
    return 'var(--c-warning)';
  }

  // ── pulse + particle bookkeeping ──────────────────────────────────
  // pulseTokens[id] increments each time a node fires; the SVG keys off
  // the token to remount the pulse ring and replay the CSS animation.
  let pulseTokens: Record<string, number> = $state(
    Object.fromEntries(NODES.map((n) => [n.id, 0]))
  );

  // Particles in flight along edges. Each carries its own token so the
  // <animateMotion> begin attribute is unique on every fire.
  type Particle = { key: number; edgeId: string; color: string };
  let particles: Particle[] = $state([]);
  let particleSeq = 0;
  const PARTICLE_DUR_MS = 480;

  // Track which deriveds we've already followed in a propagation pass
  // so a single mutation produces one wave, not a flood of duplicates.
  function fire(nodeId: string, visited = new Set<string>()) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    pulseTokens[nodeId] = (pulseTokens[nodeId] ?? 0) + 1;

    const outgoing = EDGES.filter((e) => e.from === nodeId);
    for (const edge of outgoing) {
      const dst = nodeById(edge.to);
      const key = ++particleSeq;
      particles = [...particles, { key, edgeId: edge.id, color: colorVar(dst.kind) }];

      // Cascade: when the particle "arrives", pulse the dependent.
      // The visual pulse on the dependent is handled here, since
      // $derived reads don't give us a recompute hook.
      const downstream = edge.to;
      setTimeout(() => {
        fire(downstream, visited);
        // Clean up the particle once its motion completes.
        particles = particles.filter((p) => p.key !== key);
      }, PARTICLE_DUR_MS);
    }
  }

  // ── user actions ──────────────────────────────────────────────────
  function inc() {
    count = ascending ? count + 1 : count - 1;
    fire('count');
  }
  function reset() {
    count = 0;
    fire('count');
  }
  function flipDir() {
    ascending = !ascending;
    fire('ascending');
  }

  // Cleanup any pending timeouts on unmount by clearing particles.
  // The setTimeouts above will still fire but their effects are
  // bounded (writes to $state and array filter, both safe after mount).
  let mounted = true;
  onDestroy(() => { mounted = false; });

  // ── footer readouts ───────────────────────────────────────────────
  const dependencyCount = EDGES.length;
</script>

<div class="rv" style="height: {height}">
  <header class="sandbox-head">
    <Led variant="live" label="LIVE" />
    <span class="head-title">Reactivity Visualizer</span>
    <span class="head-meta lcd">module 02 · signals + derived + effect</span>
  </header>

  <div class="grid">
    <!-- ── controls + state readout ─────────────────────────────── -->
    <section class="pane left-pane">
      <div class="pane-tab">
        <span class="lang-pill">Source · App.svelte</span>
      </div>

      <div class="left-body">
        <div class="controls">
          <button class="btn btn-primary" type="button" onclick={inc}>
            count{ascending ? '++' : '--'}
          </button>
          <button class="btn" type="button" onclick={reset}>count = 0</button>
          <button class="btn" type="button" onclick={flipDir}>toggle ascending</button>
        </div>

        <div class="readout">
          <div class="readout-row">
            <span class="r-key">count</span>
            <span class="r-kind state">$state</span>
            <span class="r-val lcd">{count}</span>
          </div>
          <div class="readout-row">
            <span class="r-key">ascending</span>
            <span class="r-kind state">$state</span>
            <span class="r-val lcd">{ascending}</span>
          </div>
          <div class="r-divider"></div>
          <div class="readout-row">
            <span class="r-key">doubled</span>
            <span class="r-kind derived">$derived</span>
            <span class="r-val lcd">{doubled}</span>
          </div>
          <div class="readout-row">
            <span class="r-key">tripled</span>
            <span class="r-kind derived">$derived</span>
            <span class="r-val lcd">{tripled}</span>
          </div>
          <div class="readout-row">
            <span class="r-key">direction</span>
            <span class="r-kind derived">$derived</span>
            <span class="r-val lcd">{direction}</span>
          </div>
          <div class="readout-row">
            <span class="r-key">message</span>
            <span class="r-kind derived">$derived</span>
            <span class="r-val lcd r-val-wide">{message}</span>
          </div>
          <div class="r-divider"></div>
          <div class="readout-row">
            <span class="r-key">logger</span>
            <span class="r-kind effect">$effect</span>
            <span class="r-val lcd r-val-wide">{lastLog}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── graph ────────────────────────────────────────────────── -->
    <section class="pane right-pane">
      <div class="pane-tab">
        <span class="lang-pill">Signal graph</span>
        <span class="legend">
          <span class="leg"><span class="leg-sw state"></span>$state</span>
          <span class="leg"><span class="leg-sw derived"></span>$derived</span>
          <span class="leg"><span class="leg-sw effect"></span>$effect</span>
        </span>
      </div>

      <div class="canvas-wrap">
        <svg viewBox="0 0 520 360" preserveAspectRatio="xMidYMid meet" class="canvas">
          <defs>
            <marker
              id="rv-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" opacity="0.55" />
            </marker>
          </defs>

          <!-- edges first so nodes paint on top -->
          <g class="edges">
            {#each EDGES as e (e.id)}
              {@const from = nodeById(e.from)}
              {@const to = nodeById(e.to)}
              <path
                id="rv-edge-{e.id}"
                d={edgePath(from, to)}
                class="edge"
                marker-end="url(#rv-arrow)"
                fill="none"
              />
            {/each}
          </g>

          <!-- particles travelling along edges -->
          <g class="particles">
            {#each particles as p (p.key)}
              <circle r="4" fill={p.color} class="particle">
                <animateMotion
                  dur="{PARTICLE_DUR_MS}ms"
                  repeatCount="1"
                  rotate="auto"
                  fill="freeze"
                  begin="0s"
                >
                  <mpath href="#rv-edge-{p.edgeId}" />
                </animateMotion>
              </circle>
            {/each}
          </g>

          <!-- nodes -->
          <g class="nodes">
            {#each NODES as n (n.id)}
              {@const c = colorVar(n.kind)}
              <g class="node node-{n.kind}" transform="translate({n.x} {n.y})">
                <!-- pulse ring: keyed on the token so it remounts and replays -->
                {#key pulseTokens[n.id]}
                  {#if pulseTokens[n.id] > 0}
                    <g class="pulse" style="color: {c}">
                      {#if n.kind === 'state'}
                        <rect x="-22" y="-22" width="44" height="44" rx="4" />
                      {:else if n.kind === 'derived'}
                        <circle r="22" />
                      {:else}
                        <polygon points="0,-24 22,16 -22,16" />
                      {/if}
                    </g>
                  {/if}
                {/key}

                <!-- the node shape itself -->
                {#if n.kind === 'state'}
                  <rect
                    x="-18" y="-18" width="36" height="36" rx="3"
                    class="shape"
                    style="fill: {c};"
                  />
                {:else if n.kind === 'derived'}
                  <circle r="18" class="shape" style="fill: {c};" />
                {:else}
                  <polygon points="0,-20 18,12 -18,12" class="shape" style="fill: {c};" />
                {/if}

                <text class="node-label" y="38">{n.label}</text>
                <text class="node-sigil" y="4">
                  {n.kind === 'state' ? '$' : n.kind === 'derived' ? 'ƒ' : '!'}
                </text>
              </g>
            {/each}
          </g>
        </svg>
      </div>
    </section>
  </div>

  <footer class="rv-foot">
    <span>click a button to mutate state and watch the graph update.</span>
    <span class="foot-meta lcd">tracking: {dependencyCount} dependencies</span>
  </footer>
</div>

<style>
  .rv {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-lg);
    background: var(--c-bg-card, var(--c-card));
    box-shadow: var(--shadow-card);
    overflow: hidden;
    margin: var(--sp-5) 0;
  }

  .sandbox-head {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-4);
    background: color-mix(in srgb, var(--c-surface) 60%, transparent);
    border-bottom: 1px solid var(--c-border);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    color: var(--c-text-muted);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .head-title { color: var(--c-text); font-weight: 600; }
  .head-meta {
    margin-left: auto;
    opacity: 0.7;
    text-transform: none;
    letter-spacing: 0.06em;
  }

  .grid {
    flex: 1;
    display: grid;
    grid-template-columns: 320px 1fr;
    min-height: 0;
  }
  @media (max-width: 720px) {
    .grid { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  }

  .pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }
  .left-pane { border-right: 1px solid var(--c-border); background: var(--c-chrome); }
  @media (max-width: 720px) {
    .left-pane { border-right: 0; border-bottom: 1px solid var(--c-border); }
  }

  .pane-tab {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-4);
    background: var(--c-surface);
    border-bottom: 1px solid var(--c-border);
  }
  .lang-pill {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    letter-spacing: 0.04em;
  }
  .lang-pill::before { content: '▲ '; color: var(--c-track-2); }

  .legend {
    display: flex;
    gap: var(--sp-3);
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    color: var(--c-text-faint);
    letter-spacing: 0.04em;
  }
  .leg { display: inline-flex; align-items: center; gap: 4px; }
  .leg-sw {
    width: 8px;
    height: 8px;
    border-radius: 99px;
    display: inline-block;
  }
  .leg-sw.state   { background: var(--c-track-2); border-radius: 1px; }
  .leg-sw.derived { background: var(--c-success); }
  .leg-sw.effect  {
    background: var(--c-warning);
    width: 0; height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-bottom: 8px solid var(--c-warning);
    border-radius: 0;
  }

  /* ── left pane body ───────────────────────────────────────────── */
  .left-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    padding: var(--sp-4);
    overflow: auto;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .btn {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    color: var(--c-text);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 9px 12px;
    border-radius: var(--r-sm);
    cursor: pointer;
    text-align: left;
    transition: all var(--d-fast);
  }
  .btn:hover { border-color: var(--c-border-strong); }
  .btn-primary {
    background: var(--c-track-2);
    border-color: var(--c-track-2);
    color: white;
    box-shadow: 0 8px 24px -10px var(--c-track-2);
  }
  .btn-primary:hover { transform: translateY(-1px); }

  .readout {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    padding: var(--sp-3);
  }
  .readout-row {
    display: grid;
    grid-template-columns: 78px 64px 1fr;
    align-items: center;
    gap: var(--sp-2);
    padding: 4px 2px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .r-key { color: var(--c-text); }
  .r-kind {
    font-size: 0.62rem;
    padding: 1px 6px;
    border-radius: var(--r-sm);
    text-align: center;
    letter-spacing: 0.04em;
    border: 1px solid transparent;
  }
  .r-kind.state {
    color: var(--c-track-2);
    border-color: color-mix(in srgb, var(--c-track-2) 40%, transparent);
    background: color-mix(in srgb, var(--c-track-2) 10%, transparent);
  }
  .r-kind.derived {
    color: var(--c-success);
    border-color: color-mix(in srgb, var(--c-success) 40%, transparent);
    background: color-mix(in srgb, var(--c-success) 10%, transparent);
  }
  .r-kind.effect {
    color: var(--c-warning);
    border-color: color-mix(in srgb, var(--c-warning) 40%, transparent);
    background: color-mix(in srgb, var(--c-warning) 10%, transparent);
  }
  .r-val {
    color: var(--c-text);
    text-align: right;
    font-feature-settings: 'tnum';
    text-transform: none;
    letter-spacing: 0.04em;
  }
  .r-val-wide {
    text-align: left;
    color: var(--c-text-muted);
  }
  .r-divider {
    height: 1px;
    background: var(--c-border);
    margin: 4px 0;
  }

  /* ── graph canvas ─────────────────────────────────────────────── */
  .canvas-wrap {
    flex: 1;
    background: var(--c-bg-code);
    padding: var(--sp-3);
    min-height: 0;
    min-width: 0;
    background-image:
      radial-gradient(
        circle at 1px 1px,
        color-mix(in srgb, var(--c-border) 70%, transparent) 1px,
        transparent 0
      );
    background-size: 24px 24px;
  }
  .canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .edge {
    stroke: var(--c-border-strong);
    stroke-width: 1.4;
    color: var(--c-text-muted); /* fed into marker fill via currentColor */
    opacity: 0.85;
  }

  .particle {
    filter: drop-shadow(0 0 4px currentColor);
  }

  /* node shape: subtle outline + the inline-styled fill colour */
  .shape {
    stroke: rgba(255, 255, 255, 0.15);
    stroke-width: 1;
    transition: filter var(--d-fast);
  }
  .node:hover .shape {
    filter: brightness(1.15);
  }

  .node-label {
    fill: var(--c-text);
    font-family: var(--font-mono);
    font-size: 10px;
    text-anchor: middle;
    letter-spacing: 0.02em;
  }
  .node-sigil {
    fill: rgba(0, 0, 0, 0.65);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    text-anchor: middle;
    pointer-events: none;
  }

  /* pulse ring: sized larger than the shape, animates outward and fades */
  .pulse {
    pointer-events: none;
  }
  .pulse rect,
  .pulse circle,
  .pulse polygon {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    transform-origin: center;
    transform-box: fill-box;
    animation: rv-pulse 0.6s var(--ease-out) forwards;
    filter: drop-shadow(0 0 6px currentColor);
  }
  @keyframes rv-pulse {
    0%   { transform: scale(0.85); opacity: 0.9; }
    100% { transform: scale(1.9);  opacity: 0;   }
  }

  /* ── footer ───────────────────────────────────────────────────── */
  .rv-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-4);
    border-top: 1px solid var(--c-border);
    background: color-mix(in srgb, var(--c-surface) 60%, transparent);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    flex-wrap: wrap;
  }
  .foot-meta { color: var(--c-text-muted); letter-spacing: 0.06em; }
</style>
