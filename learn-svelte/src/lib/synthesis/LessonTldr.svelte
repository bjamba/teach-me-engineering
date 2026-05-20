<!--
  Top-of-lesson takeaway strip. Three short claims the lesson defends.
-->
<aside class="tldr">
  <div class="tldr-label">The synthesis, up front</div>
  <ol class="tldr-list">
    <li><strong>One architectural choice.</strong> Svelte is a compiler that targets a small runtime; consequences cascade from there.</li>
    <li><strong>Framework choice is a trade-off, not a winner.</strong> Five reactive frameworks can build your app. They differ in conventions, ecosystem, and bundle floor — not capability.</li>
    <li><strong>You learned reactive UI, with Svelte as the example.</strong> 80% of what you know transfers to React, Vue, Solid, Qwik.</li>
  </ol>
</aside>

<style>
  .tldr {
    margin: var(--sp-5) 0 var(--sp-6);
    padding: var(--sp-4) var(--sp-5) var(--sp-5);
    border: 1px solid var(--c-border-strong);
    border-left: 3px solid var(--c-track, var(--c-accent));
    border-radius: var(--r-md);
    background: var(--c-card);
  }
  .tldr-label {
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--c-track, var(--c-accent));
    margin-bottom: var(--sp-3);
  }
  .tldr-list {
    margin: 0;
    padding-left: 1.2em;
    display: grid;
    gap: var(--sp-2);
  }
  .tldr-list li {
    color: var(--c-text);
    font-size: var(--fs-md);
    line-height: 1.55;
  }
  .tldr-list strong { color: var(--c-text); font-weight: 600; }
</style>
