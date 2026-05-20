<!--
  Concept 7's decision rules as two opposing columns: "Default to Svelte"
  vs "Don't pick Svelte." Reads as a quick-reference sheet.
-->
<script lang="ts">
  type Rule = string;

  const yes: Rule[] = [
    'Greenfield project with no existing framework investment.',
    'Developer velocity matters more than a large hiring pool.',
    'Web-only — no React-Native-level mobile requirement.',
    'App-shaped (interactive) more than content-shaped.',
    'Bundle size matters (marketing site, mobile-first, embedded widgets).',
    'Solo or small team where training cost is small relative to velocity.',
    'Interaction-heavy: forms, sliders, drag handles, real-time updates.',
  ];

  const no: Rule[] = [
    'You need React Native or another React renderer.',
    'You depend on a React-only library central to the product.',
    'Team is deeply React; switching cost exceeds the velocity gain.',
    'You need RSC for a content + interactivity streaming model.',
    'You’re hiring at scale (10+ frontend engineers fast).',
    'Local market is dominated by Vue or Angular.',
    'Project is primarily a content site — Astro is cleaner, Qwik on slow networks.',
  ];
</script>

<section class="rules">
  <header class="rules-head">
    <span class="rules-label">Decision rules</span>
    <span class="rules-sub">Apply honestly; you'll recommend React for some projects and Svelte for others.</span>
  </header>
  <div class="cols">
    <div class="col col-yes">
      <div class="col-head">
        <span class="chip chip-yes">Default to Svelte</span>
      </div>
      <ul>
        {#each yes as r}<li><span class="mark mark-yes" aria-hidden="true">✓</span>{r}</li>{/each}
      </ul>
    </div>
    <div class="col col-no">
      <div class="col-head">
        <span class="chip chip-no">Don't pick Svelte</span>
      </div>
      <ul>
        {#each no as r}<li><span class="mark mark-no" aria-hidden="true">×</span>{r}</li>{/each}
      </ul>
    </div>
  </div>
</section>

<style>
  .rules {
    margin: var(--sp-5) 0;
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-md);
    background: var(--c-card);
    overflow: hidden;
  }
  .rules-head {
    padding: var(--sp-3) var(--sp-4);
    background: color-mix(in srgb, var(--c-surface) 50%, transparent);
    border-bottom: 1px solid var(--c-border);
    display: flex;
    align-items: baseline;
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .rules-label {
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--c-text);
    font-weight: 700;
  }
  .rules-sub { color: var(--c-text-muted); font-size: var(--fs-sm); }

  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .col {
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
  }
  .col-yes {
    border-right: 1px solid var(--c-border);
    background: color-mix(in srgb, var(--c-track-4) 5%, transparent);
  }
  .col-no {
    background: color-mix(in srgb, var(--c-track-9) 5%, transparent);
  }
  .col-head { margin-bottom: var(--sp-3); }
  .chip {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 700;
  }
  .chip-yes {
    color: var(--c-track-4);
    background: color-mix(in srgb, var(--c-track-4) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-track-4) 45%, transparent);
  }
  .chip-no {
    color: var(--c-text-muted);
    background: color-mix(in srgb, var(--c-track-9) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-track-9) 45%, transparent);
  }

  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-2); }
  li {
    display: grid;
    grid-template-columns: 18px 1fr;
    gap: var(--sp-2);
    color: var(--c-text);
    font-size: var(--fs-sm);
    line-height: 1.55;
  }
  .mark {
    font-family: var(--font-lcd);
    font-weight: 700;
    text-align: center;
    line-height: 1.4;
  }
  .mark-yes { color: var(--c-track-4); }
  .mark-no { color: var(--c-text-faint); }

  @media (max-width: 600px) {
    .cols { grid-template-columns: 1fr; }
    .col-yes { border-right: none; border-bottom: 1px solid var(--c-border); }
  }
</style>
