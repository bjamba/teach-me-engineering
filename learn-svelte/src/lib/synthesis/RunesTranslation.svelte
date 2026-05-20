<!--
  Three side-by-side translation cards: "if you know X, here's how runes
  map." Concept 3's runes-from-another-framework block, made visual.
-->
<script lang="ts">
  type Row = { from: string; to: string };
  type FW = {
    name: string;
    color: string;
    blurb: string;
    rows: Row[];
    closer: string;
  };

  const frameworks: FW[] = [
    {
      name: 'React',
      color: 'var(--c-track-3)',
      blurb: 'Runes are signals. No setter tuples, no dependency arrays.',
      rows: [
        { from: 'const [c, setC] = useState(0)', to: 'let c = $state(0)' },
        { from: 'const d = useMemo(() => c*2, [c])', to: 'const d = $derived(c * 2)' },
        { from: 'useEffect(() => {…}, [c])', to: '$effect(() => {…})' },
      ],
      closer: 'No dependency array — you can\'t forget to list one because there isn\'t one.',
    },
    {
      name: 'Vue 3',
      color: 'var(--c-track-4)',
      blurb: 'Runes are refs without .value.',
      rows: [
        { from: 'const c = ref(0)', to: 'let c = $state(0)' },
        { from: 'c.value++',         to: 'c++' },
        { from: 'computed(() => c.value*2)', to: '$derived(c * 2)' },
      ],
      closer: 'Every .value you don\'t type is one fewer place to mess up.',
    },
    {
      name: 'Solid',
      color: 'var(--c-track-7)',
      blurb: 'Runes are signals with implicit getters.',
      rows: [
        { from: 'const [c, setC] = createSignal(0)', to: 'let c = $state(0)' },
        { from: 'c()',          to: 'c' },
        { from: 'setC(c() + 1)', to: 'c++' },
      ],
      closer: 'Explicit () is defensible; brevity favors Svelte.',
    },
  ];
</script>

<div class="trans">
  {#each frameworks as fw}
    <article class="card" style="--c-fw: {fw.color}">
      <header class="card-head">
        <span class="card-dot" aria-hidden="true"></span>
        <span class="card-name">If you know {fw.name}…</span>
      </header>
      <p class="blurb">{fw.blurb}</p>
      <div class="rows">
        {#each fw.rows as r}
          <div class="row">
            <code class="from">{r.from}</code>
            <span class="arrow" aria-hidden="true">→</span>
            <code class="to">{r.to}</code>
          </div>
        {/each}
      </div>
      <footer class="closer">{fw.closer}</footer>
    </article>
  {/each}
</div>

<style>
  .trans {
    margin: var(--sp-5) 0;
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
  .card {
    background: var(--c-card);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-md);
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .card-head { display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-2); }
  .card-dot {
    width: 9px; height: 9px;
    border-radius: 50%;
    background: var(--c-fw);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--c-fw) 25%, transparent);
  }
  .card-name {
    color: var(--c-fw);
    font-weight: 700;
    font-size: var(--fs-md);
  }
  .blurb {
    margin: 0 0 var(--sp-3);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.5;
  }
  .rows {
    display: grid;
    gap: var(--sp-2);
    margin-bottom: var(--sp-3);
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 14px 1fr;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2);
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    min-width: 0;
  }
  .row code {
    background: transparent;
    border: none;
    padding: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
  .from { color: var(--c-text-faint); }
  .to { color: var(--c-track, var(--c-accent)); font-weight: 600; }
  .arrow { color: var(--c-text-faint); text-align: center; font-size: var(--fs-xs); }

  .closer {
    margin-top: auto;
    padding-top: var(--sp-3);
    border-top: 1px dashed var(--c-border);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    line-height: 1.5;
    font-style: italic;
  }
</style>
