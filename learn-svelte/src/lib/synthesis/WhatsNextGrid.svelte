<!--
  Six numbered action cards instead of a single ordered list. Each card is
  one move the reader can pick up after the curriculum ends.
-->
<script lang="ts">
  type Step = { n: number; title: string; tag: string; body: string };

  const steps: Step[] = [
    { n: 1, title: 'Build something you\'d use',  tag: 'scratch your own itch', body: 'A small tool that solves a problem you have. The friction of "I want this feature" is the only thing that keeps a side project alive past weekend one.' },
    { n: 2, title: 'Read the Svelte source',     tag: 'one level deeper',     body: 'packages/svelte/src/internal/client/runtime.js — ~1000 lines of well-commented signal-graph implementation. An afternoon.' },
    { n: 3, title: 'Contribute to a library',     tag: 'first PR is hardest',  body: 'Bits UI, Threlte, Skeleton, MDsveX, Superforms. Pick one you actually use — you already know what\'s broken.' },
    { n: 4, title: 'Stay current',                tag: 'quarterly is enough',  body: 'Svelte changelog and the #announcements channel in the Svelte Discord. Quarterly check-in catches everything.' },
    { n: 5, title: 'Teach it',                    tag: 'explanation = depth',  body: 'Write a blog post. Help someone on the Discord. Explaining is the fastest path to deeper understanding.' },
    { n: 6, title: 'Try another framework',       tag: 'one week, not commit', body: 'A week in React or Solid or Qwik. Not to switch — to calibrate. You\'ll come back appreciating Svelte\'s choices specifically.' },
  ];
</script>

<div class="grid">
  {#each steps as s}
    <article class="card">
      <header class="card-head">
        <span class="num lcd">{s.n.toString().padStart(2, '0')}</span>
        <span class="tag">{s.tag}</span>
      </header>
      <h3 class="title">{s.title}</h3>
      <p class="body">{s.body}</p>
    </article>
  {/each}
</div>

<style>
  .grid {
    margin: var(--sp-5) 0;
    display: grid;
    gap: var(--sp-3);
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }
  .card {
    background: var(--c-card);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
    border-left: 3px solid var(--c-track, var(--c-accent));
    transition: transform 160ms, border-color 160ms;
  }
  .card:hover {
    border-color: var(--c-border-strong);
    transform: translateY(-1px);
  }
  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--sp-2);
    gap: var(--sp-2);
  }
  .num {
    color: var(--c-track, var(--c-accent));
    font-size: var(--fs-md);
    font-weight: 700;
  }
  .tag {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    text-transform: lowercase;
  }
  .title {
    margin: 0 0 var(--sp-2);
    color: var(--c-text);
    font-size: var(--fs-md);
    font-weight: 700;
    line-height: 1.3;
  }
  .body {
    margin: 0;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.55;
  }
</style>
