<!--
  CompileSandbox — the live demo of "your source becomes that JS, which renders that DOM."
  Three panels:
    1. Editor:    write Svelte 5 source.
    2. Compiled:  read the JS the Svelte compiler emitted (recompiled on every edit).
    3. Preview:   the compiled component, mounted in an iframe.

  How it works:
    - We dynamically import the Svelte compiler from esm.sh (works in dev and on Pages).
    - On every (debounced) keystroke, compile the source.
    - For the preview, we hand the iframe a full HTML document via srcdoc that uses
      an importmap to resolve 'svelte/internal/client' → esm.sh, then mounts the
      compiled component module.

  Caveats called out in the lesson next to the embed:
    - Syntax highlighting on the compiled-output panel is intentionally absent
      so you can see the raw text exactly as the compiler produced it.
    - Errors in your source surface in the compiled-output panel as compiler
      diagnostics, and runtime errors surface from the iframe via postMessage.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { audio } from '$lib/audio/audio.svelte';
  import Led from '$lib/components/Led.svelte';

  type Props = {
    initialSource?: string;
    height?: string;
  };

  const DEFAULT_SRC = `<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
<\/script>

<button onclick={() => count++}>
  clicked {count} {count === 1 ? 'time' : 'times'}
<\/button>

<p>doubled is {doubled}<\/p>

<style>
  button {
    background: #ff3e00;
    color: white;
    border: 0;
    padding: 10px 16px;
    border-radius: 8px;
    font: inherit;
    cursor: pointer;
  }
  p { color: #555; font-family: system-ui; }
<\/style>
`;

  let { initialSource = DEFAULT_SRC, height = '520px' }: Props = $props();

  // Capture the initial prop value once for the editable textarea.
  // We intentionally don't track later changes to `initialSource`.
  let source = $state(untrack(() => initialSource));
  let compiledJs = $state<string>('');
  let compileError = $state<string | null>(null);
  let runtimeError = $state<string | null>(null);
  let compilerReady = $state(false);
  let activeTab = $state<'compiled' | 'preview'>('preview');
  let iframeEl = $state<HTMLIFrameElement | undefined>();

  // Hold the compiler reference once loaded.
  let svelteCompiler: { compile: (src: string, opts: any) => any } | null = null;

  // Same compiler version pinned for both compile-time and runtime imports.
  // Bump this in one place if upgrading.
  const SVELTE_VERSION = '5.16.0';

  onMount(async () => {
    try {
      const mod: any = await import(
        /* @vite-ignore */ `https://esm.sh/svelte@${SVELTE_VERSION}/compiler`
      );
      svelteCompiler = mod;
      compilerReady = true;
      compile(source);
    } catch (err) {
      compileError = `Could not load the Svelte compiler from esm.sh: ${(err as Error).message}`;
    }

    // Surface runtime errors from inside the preview iframe.
    function onMessage(e: MessageEvent) {
      if (e?.data?.kind === 'svelte-sandbox-error') {
        runtimeError = String(e.data.message || 'unknown runtime error');
      } else if (e?.data?.kind === 'svelte-sandbox-ok') {
        runtimeError = null;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  });

  // Debounced recompile on source change.
  let debounce: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const next = source;
    if (!compilerReady) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => compile(next), 220);
  });

  function compile(src: string) {
    if (!svelteCompiler) return;
    try {
      const result = svelteCompiler.compile(src, {
        generate: 'client',
        dev: false,
        runes: true,
        css: 'injected',
        filename: 'App.svelte'
      });
      const wasError = compileError !== null;
      compiledJs = result.js.code;
      compileError = null;
      runtimeError = null;
      renderPreview(result.js.code);
      // Only ping when the sandbox recovers from an error state, not on
      // every successful keystroke (would be exhausting).
      if (wasError) audio.play('pip');
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      compileError = msg;
      compiledJs = `// compile error\n// ${msg.split('\n').join('\n// ')}`;
    }
  }

  function renderPreview(js: string) {
    if (!iframeEl) return;

    // Rewrite bare-specifier `from 'svelte/...'` and `import 'svelte/...'`
    // (side-effect imports) to fully-qualified esm.sh URLs so the inlined
    // module resolves without a bundler or importmap.
    const SV = `https://esm.sh/svelte@${SVELTE_VERSION}`;
    let rewritten = js
      .replace(/from\s+['"]svelte\/internal\/client['"]/g, `from '${SV}/internal/client'`)
      .replace(/from\s+['"]svelte['"]/g, `from '${SV}'`)
      .replace(/from\s+['"]svelte\/([^'"]+)['"]/g, (_m, sub) => `from '${SV}/${sub}'`)
      .replace(/import\s+['"]svelte\/([^'"]+)['"]/g, (_m, sub) => `import '${SV}/${sub}'`)
      .replace(/import\s+['"]svelte['"]/g, `import '${SV}'`);

    // Strip the default export so we can inline the module body directly
    // into a <script type="module"> tag and reference the component name
    // to mount it. Svelte 5 emits any of three forms.
    let componentName = 'App';
    const inlineFn = rewritten.match(/\bexport\s+default\s+function\s+(\w+)\s*\(/);
    const inlineClass = rewritten.match(/\bexport\s+default\s+class\s+(\w+)\b/);
    const refExport = rewritten.match(/\bexport\s+default\s+(\w+)\s*;?/);
    const namedExport = rewritten.match(/\bexport\s*\{\s*(\w+)\s+as\s+default[^}]*\}\s*;?/);
    if (inlineFn) {
      componentName = inlineFn[1];
      rewritten = rewritten.replace(/\bexport\s+default\s+(function\s+\w+\s*\()/, '$1');
    } else if (inlineClass) {
      componentName = inlineClass[1];
      rewritten = rewritten.replace(/\bexport\s+default\s+(class\s+\w+\b)/, '$1');
    } else if (refExport) {
      componentName = refExport[1];
      rewritten = rewritten.replace(/\bexport\s+default\s+\w+\s*;?/, '');
    } else if (namedExport) {
      componentName = namedExport[1];
      rewritten = rewritten.replace(/\bexport\s*\{[^}]+\}\s*;?/, '');
    }

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 16px; font-family: system-ui; background: #fafafa; color: #111; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module">
      window.addEventListener('error', (e) => {
        parent.postMessage({ kind: 'svelte-sandbox-error', message: e.message }, '*');
      });
      window.addEventListener('unhandledrejection', (e) => {
        parent.postMessage({ kind: 'svelte-sandbox-error', message: e.reason?.message || String(e.reason) }, '*');
      });

${rewritten}

      try {
        const { mount } = await import('${SV}');
        mount(${componentName}, { target: document.getElementById('app') });
        parent.postMessage({ kind: 'svelte-sandbox-ok' }, '*');
      } catch (err) {
        parent.postMessage({ kind: 'svelte-sandbox-error', message: err?.message || String(err) }, '*');
      }
    <\/script>
  </body>
</html>`;

    iframeEl.srcdoc = html;
  }
</script>

<div class="sandbox" style="height: {height}">
  <header class="sandbox-head">
    <Led
      variant={!compilerReady ? 'loading' : (compileError || runtimeError) ? 'error' : 'live'}
      label={!compilerReady ? 'LOAD' : compileError ? 'ERR' : runtimeError ? 'RUN' : 'LIVE'}
    />
    <span class="head-title">Live Svelte 5 Sandbox</span>
    <span class="head-meta lcd">
      {#if !compilerReady}
        loading compiler
      {:else if compileError}
        compile error
      {:else if runtimeError}
        runtime error
      {:else}
        compiling on edit · runes mode
      {/if}
    </span>
  </header>

  <div class="grid">
    <section class="pane editor-pane">
      <div class="pane-tab">
        <span class="lang-pill svelte">Source · App.svelte</span>
      </div>
      <textarea
        spellcheck="false"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        bind:value={source}
        aria-label="Svelte source code"
      ></textarea>
    </section>

    <section class="pane right-pane">
      <div class="tabs">
        <button
          class="tab"
          class:active={activeTab === 'preview'}
          onclick={() => (activeTab = 'preview')}
        >
          ▶ Preview
        </button>
        <button
          class="tab"
          class:active={activeTab === 'compiled'}
          onclick={() => (activeTab = 'compiled')}
        >
          {'{ }'} Compiled JS
        </button>
        {#if compiledJs}
          <span class="byte-count lcd">{compiledJs.length.toLocaleString()} B</span>
        {/if}
      </div>

      <div class="tab-body">
        <div class="pane-stack" class:show={activeTab === 'preview'}>
          {#if runtimeError}
            <div class="error-box">{runtimeError}</div>
          {/if}
          <iframe
            bind:this={iframeEl}
            title="Svelte preview"
            sandbox="allow-scripts"
          ></iframe>
        </div>

        <div class="pane-stack" class:show={activeTab === 'compiled'}>
          {#if compileError}
            <div class="error-box">{compileError}</div>
          {/if}
          <pre class="compiled"><code>{compiledJs || '// compiling…'}</code></pre>
        </div>
      </div>
    </section>
  </div>
</div>

<style>
  .sandbox {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-lg);
    background: var(--c-bg-card);
    box-shadow: var(--shadow-card);
    overflow: hidden;
    margin: var(--sp-5) 0;
  }

  .sandbox-head {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-4);
    background: color-mix(in srgb, var(--c-bg-raised) 60%, transparent);
    border-bottom: 1px solid var(--c-border);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    color: var(--c-text-muted);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .head-title { color: var(--c-text); font-weight: 600; }
  .head-meta { margin-left: auto; opacity: 0.7; text-transform: none; letter-spacing: 0; }

  .grid {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 0;
  }
  @media (max-width: 720px) {
    .grid { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
  }

  .pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }
  .editor-pane { border-right: 1px solid var(--c-border); }
  @media (max-width: 720px) {
    .editor-pane { border-right: 0; border-bottom: 1px solid var(--c-border); }
  }

  .pane-tab {
    display: flex;
    align-items: center;
    padding: var(--sp-2) var(--sp-4);
    background: var(--c-bg-raised);
    border-bottom: 1px solid var(--c-border);
  }
  .lang-pill {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    letter-spacing: 0.04em;
  }
  .lang-pill.svelte::before {
    content: '▲ ';
    color: var(--c-accent);
  }

  textarea {
    flex: 1;
    border: 0;
    outline: none;
    resize: none;
    background: var(--c-bg-code);
    color: #f1ebe6;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    line-height: 1.55;
    padding: var(--sp-4);
    tab-size: 2;
    caret-color: var(--c-accent);
  }

  .tabs {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    background: var(--c-bg-raised);
    border-bottom: 1px solid var(--c-border);
  }
  .tab {
    background: transparent;
    border: 0;
    color: var(--c-text-muted);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 4px 10px;
    border-radius: var(--r-sm);
    cursor: pointer;
    transition: background var(--d-fast), color var(--d-fast);
  }
  .tab.active {
    color: var(--c-text);
    background: var(--c-bg-card);
    box-shadow: inset 0 0 0 1px var(--c-border);
  }
  .byte-count {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    font-feature-settings: 'tnum';
  }

  .tab-body { flex: 1; position: relative; min-height: 0; min-width: 0; }
  .pane-stack {
    position: absolute;
    inset: 0;
    display: none;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }
  .pane-stack.show { display: flex; }

  iframe {
    flex: 1;
    border: 0;
    width: 100%;
    background: white;
  }

  .compiled {
    flex: 1;
    margin: 0;
    padding: var(--sp-4);
    overflow: auto;
    background: var(--c-bg-code);
    color: #f1ebe6;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    line-height: 1.55;
    border: 0;
    border-radius: 0;
  }

  .error-box {
    padding: var(--sp-3) var(--sp-4);
    background: rgba(255, 80, 80, 0.12);
    color: #ff8a8a;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    border-bottom: 1px solid rgba(255, 80, 80, 0.3);
    white-space: pre-wrap;
  }
</style>
