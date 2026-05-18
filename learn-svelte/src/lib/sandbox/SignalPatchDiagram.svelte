<!--
  Signal Patch Diagram — Module 7 capstone interactive.

  A small fixed Web Audio routing graph (kick + snare → effects → master)
  rendered as a modular-synth patch. Patch cables are SVG paths; signal
  flow is shown by particles traveling along the path via getPointAtLength().
  Knobs are SVG arcs the user drags vertically; values are written straight
  to live Tone.js node parameters.

  Audio loads from esm.sh on first user gesture, same pattern as Sequencer.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Led from '$lib/components/Led.svelte';

  // ── layout constants ─────────────────────────────────────────────
  const VB_W = 880;
  const VB_H = 420;
  const MOD_W = 130;
  const MOD_H = 116;

  type Port = { x: number; y: number };

  type ModuleDef = {
    id: 'kick' | 'snare' | 'filter' | 'delay' | 'gain' | 'dest';
    title: string;
    x: number;
    y: number;
    w?: number;
    h?: number;
    /** Number of input ports on the left edge. */
    ins: number;
    /** Number of output ports on the right edge. */
    outs: number;
    /** Knob definitions. Coords are relative to the module's top-left. */
    knobs?: KnobDef[];
    /** Source-only: small label under the title for the trigger button. */
    sourceLabel?: string;
  };

  type KnobDef = {
    id: string;
    label: string;
    /** Param coords relative to module's interior (0..MOD_W, 0..MOD_H). */
    cx: number;
    cy: number;
    min: number;
    max: number;
    /** Default value. */
    init: number;
    /** Logarithmic mapping for frequency-style knobs. */
    log?: boolean;
    /** Format for the readout. */
    fmt?: (v: number) => string;
  };

  // Modules are hand-placed left-to-right. Sources stack on the left,
  // FX in the middle, master gain right of center, destination far right.
  const MODULES: ModuleDef[] = [
    {
      id: 'kick', title: 'KICK', sourceLabel: 'src',
      x: 24, y: 40, ins: 0, outs: 1
    },
    {
      id: 'snare', title: 'SNARE', sourceLabel: 'src',
      x: 24, y: 200, ins: 0, outs: 1
    },
    {
      id: 'filter', title: 'FILTER',
      x: 230, y: 40, ins: 1, outs: 1,
      knobs: [
        {
          id: 'freq', label: 'CUTOFF',
          cx: 38, cy: 70, min: 80, max: 8000, init: 1200, log: true,
          fmt: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`
        },
        {
          id: 'q', label: 'RES',
          cx: 92, cy: 70, min: 0.1, max: 12, init: 1.4,
          fmt: (v) => v.toFixed(1)
        }
      ]
    },
    {
      id: 'delay', title: 'DELAY',
      x: 230, y: 200, ins: 1, outs: 1,
      knobs: [
        {
          id: 'time', label: 'TIME',
          cx: 38, cy: 70, min: 0.04, max: 0.6, init: 0.22,
          fmt: (v) => `${Math.round(v * 1000)}ms`
        },
        {
          id: 'fb', label: 'FBK',
          cx: 92, cy: 70, min: 0, max: 0.85, init: 0.42,
          fmt: (v) => `${Math.round(v * 100)}%`
        }
      ]
    },
    {
      id: 'gain', title: 'GAIN',
      x: 470, y: 120, ins: 2, outs: 1,
      knobs: [
        {
          id: 'level', label: 'LEVEL',
          cx: 65, cy: 70, min: 0, max: 1, init: 0.78,
          fmt: (v) => `${Math.round(v * 100)}%`
        }
      ]
    },
    {
      id: 'dest', title: 'OUT',
      x: 700, y: 120, ins: 1, outs: 0, w: 100
    }
  ];

  type CableDef = {
    from: { mod: ModuleDef['id']; port: number };
    to: { mod: ModuleDef['id']; port: number };
    color: string;
    /** Source whose triggers should accelerate this cable. */
    source: 'kick' | 'snare';
  };

  // Default routing:
  //   kick  → filter → gain[in 0] → dest
  //   snare → delay  → gain[in 1] → dest
  const CABLES: CableDef[] = [
    { from: { mod: 'kick',  port: 0 }, to: { mod: 'filter', port: 0 }, color: '#ff8a5b', source: 'kick' },
    { from: { mod: 'filter', port: 0 }, to: { mod: 'gain',   port: 0 }, color: '#ff6b4a', source: 'kick' },
    { from: { mod: 'snare', port: 0 }, to: { mod: 'delay',  port: 0 }, color: '#e5468b', source: 'snare' },
    { from: { mod: 'delay',  port: 0 }, to: { mod: 'gain',   port: 1 }, color: '#c43d77', source: 'snare' },
    { from: { mod: 'gain',   port: 0 }, to: { mod: 'dest',   port: 0 }, color: '#9b6cff', source: 'kick' }
  ];

  // ── port geometry ────────────────────────────────────────────────
  // Distribute ports evenly on a module's vertical edge. Returned in
  // SVG (viewport) coords so cables and modules share a coordinate system.
  function inputPort(m: ModuleDef, i: number): Port {
    const w = m.w ?? MOD_W;
    const h = m.h ?? MOD_H;
    const span = h - 36;
    const step = span / (m.ins + 1);
    return { x: m.x, y: m.y + 18 + step * (i + 1) };
  }
  function outputPort(m: ModuleDef, i: number): Port {
    const w = m.w ?? MOD_W;
    const h = m.h ?? MOD_H;
    const span = h - 36;
    const step = span / (m.outs + 1);
    return { x: m.x + w, y: m.y + 18 + step * (i + 1) };
  }

  function modById(id: ModuleDef['id']): ModuleDef {
    return MODULES.find((m) => m.id === id)!;
  }

  // Bezier path between two ports — horizontal control handles so the cable
  // sags forward, not up/down.
  function cablePath(a: Port, b: Port): string {
    const dx = Math.max(60, Math.abs(b.x - a.x) * 0.55);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }

  // ── reactive state ───────────────────────────────────────────────
  // Knob values keyed by `${moduleId}:${knobId}`.
  let knobValues: Record<string, number> = $state(initialKnobValues());

  function initialKnobValues(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const m of MODULES) {
      for (const k of m.knobs ?? []) {
        out[`${m.id}:${k.id}`] = k.init;
      }
    }
    return out;
  }

  // Activity = 0..1 per source. Spikes on trigger, decays over ~600ms.
  // Drives cable particle speed + brief module LED flash.
  let kickActivity = $state(0);
  let snareActivity = $state(0);
  // Per-module "lit" flag for the module LED. Decays independently so the
  // light feels like signal arriving, not just the trigger button press.
  let modActivity: Record<string, number> = $state({
    kick: 0, snare: 0, filter: 0, delay: 0, gain: 0, dest: 0
  });

  let loading = $state(false);
  let started = $state(false);
  let loadError = $state<string | null>(null);

  // ── audio state (non-reactive — never re-rendered) ───────────────
  let Tone: any = null;
  let nodes: Record<string, any> = {};

  async function ensureTone() {
    if (Tone) return;
    loading = true;
    try {
      const mod: any = await import(/* @vite-ignore */ 'https://esm.sh/tone@15.0.4');
      Tone = mod;
      await Tone.start();
      buildGraph();
      started = true;
    } catch (err) {
      loadError = `Could not load audio: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  }

  function buildGraph() {
    nodes.gain = new Tone.Gain(knobValues['gain:level']).toDestination();

    nodes.filter = new Tone.Filter({
      type: 'lowpass',
      frequency: knobValues['filter:freq'],
      Q: knobValues['filter:q']
    }).connect(nodes.gain);

    nodes.delay = new Tone.FeedbackDelay({
      delayTime: knobValues['delay:time'],
      feedback: knobValues['delay:fb'],
      wet: 0.65
    }).connect(nodes.gain);

    nodes.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
    }).connect(nodes.filter);

    nodes.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0 }
    }).connect(nodes.delay);
  }

  async function trigger(which: 'kick' | 'snare') {
    await ensureTone();
    if (!Tone || !nodes[which]) return;
    const t = Tone.now();
    if (which === 'kick') {
      nodes.kick.triggerAttackRelease('C2', '8n', t);
      kickActivity = 1;
      pulseModules(['kick', 'filter', 'gain', 'dest']);
    } else {
      nodes.snare.triggerAttackRelease('16n', t, 0.7);
      snareActivity = 1;
      pulseModules(['snare', 'delay', 'gain', 'dest']);
    }
  }

  // Stagger module LED flashes so the eye reads "signal moving downstream"
  // rather than "everything blinks at once".
  function pulseModules(chain: string[]) {
    chain.forEach((id, i) => {
      setTimeout(() => { modActivity[id] = 1; modActivity = { ...modActivity }; }, i * 70);
    });
  }

  // Live-update Tone.js node params when knobs move. Each effect reads the
  // value unconditionally so the dependency is registered before nodes exist.
  $effect(() => {
    const v = knobValues['filter:freq'];
    if (nodes.filter) nodes.filter.frequency.rampTo(v, 0.05);
  });
  $effect(() => {
    const v = knobValues['filter:q'];
    if (nodes.filter) nodes.filter.Q.rampTo(v, 0.05);
  });
  $effect(() => {
    const v = knobValues['delay:time'];
    if (nodes.delay) nodes.delay.delayTime.rampTo(v, 0.05);
  });
  $effect(() => {
    const v = knobValues['delay:fb'];
    if (nodes.delay) nodes.delay.feedback.rampTo(v, 0.05);
  });
  $effect(() => {
    const v = knobValues['gain:level'];
    if (nodes.gain) nodes.gain.gain.rampTo(v, 0.05);
  });

  // ── animation loop ───────────────────────────────────────────────
  // Each cable emits a stream of particles that ride along its path. Speed
  // tracks the source activity, so quiet graphs idle slowly and a freshly
  // triggered chain accelerates.
  type Particle = { t: number };
  let particles: Particle[][] = CABLES.map(() => [{ t: 0 }, { t: 0.33 }, { t: 0.66 }]);
  // Path lengths cached after mount so we can convert path-fraction → coords.
  let pathLengths: number[] = [];
  let cableEls: (SVGPathElement | null)[] = $state(CABLES.map(() => null));
  // Particle position derived per-frame; written into a $state array so
  // template references update without re-running the path math in Svelte.
  let particleCoords: { x: number; y: number; alpha: number }[][] = $state(
    CABLES.map(() => [
      { x: 0, y: 0, alpha: 0 },
      { x: 0, y: 0, alpha: 0 },
      { x: 0, y: 0, alpha: 0 }
    ])
  );

  let raf: number | null = null;
  let lastFrame = 0;

  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, lastFrame ? (now - lastFrame) / 1000 : 0.016);
    lastFrame = now;

    // Decay activity envelopes. Decay rate set so a single trigger stays
    // visibly hot for ~600ms.
    kickActivity = Math.max(0, kickActivity - dt * 1.6);
    snareActivity = Math.max(0, snareActivity - dt * 1.6);
    let dirty = false;
    for (const id of Object.keys(modActivity)) {
      if (modActivity[id] > 0) {
        modActivity[id] = Math.max(0, modActivity[id] - dt * 3.0);
        dirty = true;
      }
    }
    if (dirty) modActivity = { ...modActivity };

    // Advance every cable's particles. Speed is base ambient + activity boost.
    for (let ci = 0; ci < CABLES.length; ci++) {
      const c = CABLES[ci];
      const act = c.source === 'kick' ? kickActivity : snareActivity;
      // path-fractions per second; idle ~0.12, peak ~0.85
      const speed = 0.12 + act * 0.73;
      const el = cableEls[ci];
      if (!el) continue;
      // Lazy-measure: bindings can land after onMount runs, so cache on first
      // available frame rather than gating particle motion on a stale 0.
      if (!pathLengths[ci]) pathLengths[ci] = el.getTotalLength();
      const len = pathLengths[ci];
      if (!len) continue;
      const ps = particles[ci];
      const coords = particleCoords[ci];
      for (let pi = 0; pi < ps.length; pi++) {
        ps[pi].t = (ps[pi].t + speed * dt) % 1;
        const pt = el.getPointAtLength(ps[pi].t * len);
        coords[pi].x = pt.x;
        coords[pi].y = pt.y;
        // Particles fade in/out at the endpoints so they don't pop.
        const edge = Math.min(ps[pi].t, 1 - ps[pi].t);
        const fade = Math.min(1, edge * 8);
        coords[pi].alpha = (0.25 + act * 0.75) * fade;
      }
    }
    particleCoords = particleCoords;
  }

  function measurePaths() {
    pathLengths = cableEls.map((el) => (el ? el.getTotalLength() : 0));
  }

  onMount(() => {
    measurePaths();
    raf = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    if (raf !== null) cancelAnimationFrame(raf);
    // Dispose every Tone node; otherwise they sit in the audio graph after
    // navigation and continue to consume CPU.
    for (const id of Object.keys(nodes)) {
      try { nodes[id].dispose?.(); } catch {}
    }
  });

  // ── knob drag ────────────────────────────────────────────────────
  // Vertical drag → value change. Range is "60px = full sweep" so coarse
  // moves cover the whole range, but you can still hit a precise value
  // by dragging slowly. Log-mapped for frequency knobs.
  type DragState = { key: string; def: KnobDef; startY: number; startV: number };
  let drag: DragState | null = null;

  function knobAngle(def: KnobDef, v: number): number {
    const norm = def.log
      ? (Math.log(v / def.min)) / (Math.log(def.max / def.min))
      : (v - def.min) / (def.max - def.min);
    // Sweep from -135° to +135° (270° total), classic synth-knob range.
    return -135 + norm * 270;
  }
  function valueFromNorm(def: KnobDef, n: number): number {
    n = Math.max(0, Math.min(1, n));
    if (def.log) return def.min * Math.pow(def.max / def.min, n);
    return def.min + (def.max - def.min) * n;
  }
  function normFromValue(def: KnobDef, v: number): number {
    if (def.log) return Math.log(v / def.min) / Math.log(def.max / def.min);
    return (v - def.min) / (def.max - def.min);
  }

  function onKnobDown(e: PointerEvent, modId: string, def: KnobDef) {
    const target = e.currentTarget as Element;
    target.setPointerCapture(e.pointerId);
    const key = `${modId}:${def.id}`;
    drag = { key, def, startY: e.clientY, startV: knobValues[key] };
  }
  function onKnobMove(e: PointerEvent) {
    if (!drag) return;
    const dy = drag.startY - e.clientY;
    const startNorm = normFromValue(drag.def, drag.startV);
    const next = valueFromNorm(drag.def, startNorm + dy / 140);
    knobValues[drag.key] = next;
    knobValues = { ...knobValues };
  }
  function onKnobUp(e: PointerEvent) {
    if (!drag) return;
    const target = e.currentTarget as Element;
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    drag = null;
  }
  function onKnobWheel(e: WheelEvent, modId: string, def: KnobDef) {
    e.preventDefault();
    const key = `${modId}:${def.id}`;
    const startNorm = normFromValue(def, knobValues[key]);
    knobValues[key] = valueFromNorm(def, startNorm - Math.sign(e.deltaY) * 0.04);
    knobValues = { ...knobValues };
  }

  // ── derived ──────────────────────────────────────────────────────
  let stateLabel = $derived(
    loadError ? 'error' : loading ? 'loading' : started ? 'live' : 'standby'
  );

  // SVG arc helper — describes a stroked arc from `start` to `end` (degrees,
  // 0 = up, clockwise). Used for the knob sweep indicator.
  function polarToCart(cx: number, cy: number, r: number, deg: number) {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
    const s = polarToCart(cx, cy, r, end);
    const e = polarToCart(cx, cy, r, start);
    const large = end - start <= 180 ? '0' : '1';
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
  }
</script>

<div class="patch">
  <header class="seq-head">
    <div class="brand">
      <Led
        variant={loading ? 'loading' : loadError ? 'error' : started ? 'live' : 'ready'}
        label={loading ? 'LOAD' : loadError ? 'ERR' : started ? 'LIVE' : 'STBY'}
      />
      <span class="brand-text">Signal Patch Diagram</span>
      <span class="brand-sub lcd">module 07 · audio graph as patch</span>
    </div>

    <div class="controls">
      <button
        class="btn btn-trigger btn-kick"
        type="button"
        onclick={() => trigger('kick')}
        disabled={loading}
      >
        <span class="trig-dot"></span> trigger kick
      </button>
      <button
        class="btn btn-trigger btn-snare"
        type="button"
        onclick={() => trigger('snare')}
        disabled={loading}
      >
        <span class="trig-dot"></span> trigger snare
      </button>
    </div>
  </header>

  {#if loadError}
    <div class="seq-error">{loadError}</div>
  {/if}

  <div class="canvas-wrap">
    <svg
      class="canvas"
      viewBox="0 0 {VB_W} {VB_H}"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Audio routing patch diagram"
    >
      <!-- backdrop grid -->
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1a1d2a" stroke-width="0.5" />
        </pattern>
        <radialGradient id="port-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stop-color="#9b6cff" stop-opacity="0.7" />
          <stop offset="100%" stop-color="#9b6cff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#grid)" opacity="0.5" />

      <!-- cables — drawn first so modules sit on top of the cable ends -->
      {#each CABLES as c, ci (ci)}
        {@const a = outputPort(modById(c.from.mod), c.from.port)}
        {@const b = inputPort(modById(c.to.mod), c.to.port)}
        {@const d = cablePath(a, b)}
        <g class="cable">
          <!-- shadow under the cable for depth -->
          <path
            d={d}
            fill="none"
            stroke="#000"
            stroke-opacity="0.45"
            stroke-width="6"
            stroke-linecap="round"
            transform="translate(0,2)"
          />
          <path
            bind:this={cableEls[ci]}
            d={d}
            fill="none"
            stroke={c.color}
            stroke-width="3.2"
            stroke-linecap="round"
            stroke-opacity="0.85"
          />
          <!-- highlight stripe -->
          <path
            d={d}
            fill="none"
            stroke="#ffffff"
            stroke-opacity="0.12"
            stroke-width="1"
            stroke-linecap="round"
          />
          <!-- particles -->
          {#each particleCoords[ci] as p, pi (pi)}
            <circle
              cx={p.x}
              cy={p.y}
              r="3.2"
              fill={c.color}
              opacity={p.alpha}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r="1.4"
              fill="#ffffff"
              opacity={p.alpha * 0.85}
            />
          {/each}
        </g>
      {/each}

      <!-- modules -->
      {#each MODULES as m (m.id)}
        {@const w = m.w ?? MOD_W}
        {@const h = m.h ?? MOD_H}
        {@const lit = modActivity[m.id]}
        <g class="module" data-id={m.id}>
          <!-- panel body -->
          <rect
            x={m.x} y={m.y} width={w} height={h}
            rx="8" ry="8"
            fill="#161823"
            stroke={lit > 0.05
              ? `color-mix(in srgb, var(--c-track-7) ${30 + lit * 50}%, #262a3a)`
              : '#262a3a'}
            stroke-width="1"
          />
          <!-- screw / bolt detail in corners (Buchla-ish) -->
          <circle cx={m.x + 6} cy={m.y + 6} r="1.5" fill="#262a3a" />
          <circle cx={m.x + w - 6} cy={m.y + 6} r="1.5" fill="#262a3a" />
          <circle cx={m.x + 6} cy={m.y + h - 6} r="1.5" fill="#262a3a" />
          <circle cx={m.x + w - 6} cy={m.y + h - 6} r="1.5" fill="#262a3a" />

          <!-- title bar -->
          <rect
            x={m.x} y={m.y} width={w} height="20"
            rx="8" ry="8"
            fill="#1d2030"
          />
          <rect
            x={m.x} y={m.y + 12} width={w} height="8"
            fill="#1d2030"
          />
          <text
            x={m.x + 8} y={m.y + 14}
            fill="#ecedf3"
            font-family="JetBrains Mono, monospace"
            font-size="9"
            font-weight="600"
            letter-spacing="0.1em"
          >{m.title}</text>

          <!-- module LED — sits on title bar, lights when signal arrives -->
          <circle
            cx={m.x + w - 10} cy={m.y + 10}
            r="3"
            fill={lit > 0.05 ? '#9b6cff' : '#262a3a'}
            opacity={lit > 0.05 ? 0.4 + lit * 0.6 : 0.5}
          />
          {#if lit > 0.05}
            <circle
              cx={m.x + w - 10} cy={m.y + 10}
              r={3 + lit * 4}
              fill="#9b6cff"
              opacity={lit * 0.4}
            />
          {/if}

          <!-- input ports -->
          {#each Array(m.ins) as _, i (i)}
            {@const p = inputPort(m, i)}
            <g class="port port-in">
              <circle cx={p.x} cy={p.y} r="6" fill="#08090d" stroke="#383d52" stroke-width="1" />
              <circle cx={p.x} cy={p.y} r="2.5" fill="#262a3a" />
            </g>
          {/each}

          <!-- output ports -->
          {#each Array(m.outs) as _, i (i)}
            {@const p = outputPort(m, i)}
            <g class="port port-out">
              <circle cx={p.x} cy={p.y} r="6" fill="#08090d" stroke="#383d52" stroke-width="1" />
              <circle cx={p.x} cy={p.y} r="2.5" fill="#9b6cff" opacity="0.7" />
            </g>
          {/each}

          <!-- knobs -->
          {#each m.knobs ?? [] as k (k.id)}
            {@const v = knobValues[`${m.id}:${k.id}`]}
            {@const angle = knobAngle(k, v)}
            {@const cx = m.x + k.cx}
            {@const cy = m.y + k.cy}
            <g
              class="knob"
              role="slider"
              tabindex="0"
              aria-label={`${m.title} ${k.label}`}
              aria-valuemin={k.min}
              aria-valuemax={k.max}
              aria-valuenow={v}
              onpointerdown={(e) => onKnobDown(e, m.id, k)}
              onpointermove={onKnobMove}
              onpointerup={onKnobUp}
              onpointercancel={onKnobUp}
              onwheel={(e) => onKnobWheel(e, m.id, k)}
            >
              <circle cx={cx} cy={cy} r="16" fill="#08090d" stroke="#262a3a" stroke-width="1" />
              <circle cx={cx} cy={cy} r="13" fill="#1d2030" stroke="#383d52" stroke-width="1" />
              <path
                d={describeArc(cx, cy, 18, -135, angle)}
                fill="none" stroke="var(--c-track-7)"
                stroke-width="1.6" stroke-linecap="round" opacity="0.85"
              />
              <line
                x1={cx} y1={cy}
                x2={cx + Math.cos((angle - 90) * Math.PI / 180) * 11}
                y2={cy + Math.sin((angle - 90) * Math.PI / 180) * 11}
                stroke="#ecedf3" stroke-width="1.8" stroke-linecap="round"
              />
              <text
                x={cx} y={cy + 28} text-anchor="middle"
                fill="#5e6378" font-family="JetBrains Mono, monospace"
                font-size="7" letter-spacing="0.08em"
              >{k.label}</text>
              <text
                x={cx} y={cy + 37} text-anchor="middle"
                fill="#ecedf3" font-family="Share Tech Mono, monospace"
                font-size="8" letter-spacing="0.04em"
              >{(k.fmt ?? ((n: number) => n.toFixed(2)))(v)}</text>
            </g>
          {/each}

          {#if m.sourceLabel}
            <g class="src-glyph">
              <text
                x={m.x + w / 2} y={m.y + 56} text-anchor="middle"
                fill={m.id === 'kick' ? '#ff8a5b' : '#e5468b'}
                font-family="JetBrains Mono, monospace" font-size="9" opacity="0.85"
              >{m.id === 'kick' ? 'membrane' : 'noise'}</text>
              {#if m.id === 'kick'}
                <path
                  d="M {m.x + 20} {m.y + 80} Q {m.x + 35} {m.y + 60}, {m.x + 50} {m.y + 80} T {m.x + 80} {m.y + 80} T {m.x + 110} {m.y + 80}"
                  fill="none" stroke="#ff8a5b" stroke-width="1.4" opacity="0.65"
                />
              {:else}
                <g opacity="0.65">
                  {#each Array(20) as _, i (i)}
                    <line
                      x1={m.x + 18 + i * 5} y1={m.y + 70 + (i * 13 % 11)}
                      x2={m.x + 18 + i * 5} y2={m.y + 92 - (i * 7 % 9)}
                      stroke="#e5468b" stroke-width="1.2"
                    />
                  {/each}
                </g>
              {/if}
              <text
                x={m.x + w / 2} y={m.y + 104} text-anchor="middle"
                fill="#5e6378" font-family="JetBrains Mono, monospace"
                font-size="6.5" letter-spacing="0.1em"
              >TRIGGER ABOVE</text>
            </g>
          {/if}

          {#if m.id === 'dest'}
            <g>
              <text
                x={m.x + w / 2} y={m.y + 50} text-anchor="middle"
                fill="#9b6cff" font-family="JetBrains Mono, monospace"
                font-size="11" font-weight="600"
              >▶ ▶ ▶</text>
              <text
                x={m.x + w / 2} y={m.y + 74} text-anchor="middle"
                fill="#5e6378" font-family="JetBrains Mono, monospace"
                font-size="7" letter-spacing="0.1em"
              >SPEAKERS</text>
              <text
                x={m.x + w / 2} y={m.y + 92} text-anchor="middle"
                fill="#ecedf3" font-family="Share Tech Mono, monospace"
                font-size="8" letter-spacing="0.04em"
              >{Math.round(knobValues['gain:level'] * 100)}%</text>
            </g>
          {/if}
        </g>
      {/each}
    </svg>
  </div>

  <footer class="seq-foot">
    <span>drag knobs to adjust effects. trigger sources to send signal through the graph.</span>
    <span class="foot-meta lcd">tone.js · web audio · {stateLabel}</span>
  </footer>
</div>

<style>
  .patch {
    background: var(--c-chrome);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    padding: var(--sp-3);
    box-shadow: var(--shadow-card);
    user-select: none;
  }

  .seq-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-3) var(--sp-3);
    flex-wrap: wrap;
  }
  .brand { display: flex; align-items: baseline; gap: var(--sp-2); }
  .brand-text {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-md);
    color: var(--c-text);
    letter-spacing: -0.01em;
  }
  .brand-sub {
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
  }

  .controls { display: flex; align-items: center; gap: var(--sp-2); }

  .btn {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    color: var(--c-text);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 7px 12px;
    border-radius: var(--r-sm);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all var(--d-fast);
  }
  .btn:hover { border-color: var(--c-border-strong); transform: translateY(-1px); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  .btn-trigger { font-weight: 600; }
  .btn-kick {
    border-color: color-mix(in srgb, #ff8a5b 60%, var(--c-border));
    color: #ff8a5b;
    box-shadow: 0 6px 18px -10px #ff8a5b;
  }
  .btn-kick:hover { background: color-mix(in srgb, #ff8a5b 12%, var(--c-surface)); }
  .btn-snare {
    border-color: color-mix(in srgb, #e5468b 60%, var(--c-border));
    color: #e5468b;
    box-shadow: 0 6px 18px -10px #e5468b;
  }
  .btn-snare:hover { background: color-mix(in srgb, #e5468b 12%, var(--c-surface)); }
  .trig-dot {
    width: 6px;
    height: 6px;
    border-radius: 99px;
    background: currentColor;
    box-shadow: 0 0 6px currentColor;
  }

  .seq-error {
    background: color-mix(in srgb, var(--c-error) 14%, transparent);
    color: var(--c-error);
    border: 1px solid color-mix(in srgb, var(--c-error) 30%, transparent);
    border-radius: var(--r-sm);
    padding: var(--sp-2) var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    margin: 0 var(--sp-3) var(--sp-3);
  }

  .canvas-wrap {
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    padding: var(--sp-2);
  }
  .canvas {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 880 / 420;
    /* Subtle vignette so the patch reads as a panel under a stage light. */
    background:
      radial-gradient(ellipse at center, rgba(155, 108, 255, 0.05), transparent 70%),
      var(--c-bg-code);
    border-radius: var(--r-sm);
  }

  /* Knobs are interactive — give them an obvious affordance. */
  :global(.canvas .knob) {
    cursor: ns-resize;
    touch-action: none;
  }
  :global(.canvas .knob:focus) { outline: none; }
  :global(.canvas .knob:focus-visible circle:nth-of-type(2)) {
    stroke: var(--c-track-7);
    stroke-width: 1.6;
  }

  .seq-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--sp-2) var(--sp-3) 4px;
    margin-top: var(--sp-2);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .foot-meta { color: var(--c-text-faint); }

  @media (max-width: 720px) {
    .controls { width: 100%; }
    .btn-trigger { flex: 1; justify-content: center; }
  }
</style>
