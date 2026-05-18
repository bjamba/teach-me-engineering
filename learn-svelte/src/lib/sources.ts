/**
 * The single registry of every external source this curriculum draws from.
 * Lesson keys match the curriculum spine: `<module-slug>/<lesson-slug>`.
 */

export type SourceType =
  | 'docs' | 'blog' | 'talk' | 'paper' | 'repo' | 'tutorial' | 'spec' | 'book';

export type Source = {
  id: string;
  type: SourceType;
  title: string;
  authors?: string[];
  venue?: string;
  year?: string;
  url?: string;
  note?: string;
};

export const sources: Record<string, Source> = {
  // ── Svelte primary sources ──────────────────────────────────────────
  'svelte-docs': {
    id: 'svelte-docs',
    type: 'docs',
    title: 'Svelte documentation',
    venue: 'svelte.dev',
    url: 'https://svelte.dev/docs',
    note: 'The canonical reference for syntax, runes, and SvelteKit.'
  },
  'svelte-tutorial': {
    id: 'svelte-tutorial',
    type: 'tutorial',
    title: 'The official Svelte tutorial',
    venue: 'svelte.dev',
    url: 'https://svelte.dev/tutorial',
    note: 'Interactive walkthrough by the Svelte team.'
  },
  'svelte-blog-runes': {
    id: 'svelte-blog-runes',
    type: 'blog',
    title: 'Introducing runes',
    authors: ['Rich Harris'],
    venue: 'svelte.dev/blog',
    year: '2023',
    url: 'https://svelte.dev/blog/runes',
    note: 'Original announcement and rationale for the rune syntax.'
  },
  'svelte-blog-svelte-5-released': {
    id: 'svelte-blog-svelte-5-released',
    type: 'blog',
    title: 'Svelte 5 is alive',
    authors: ['Rich Harris'],
    venue: 'svelte.dev/blog',
    year: '2024',
    note: 'The 5.0 release post.'
  },
  'svelte-repo': {
    id: 'svelte-repo',
    type: 'repo',
    title: 'sveltejs/svelte',
    venue: 'GitHub',
    url: 'https://github.com/sveltejs/svelte',
    note: 'The compiler and runtime live here.'
  },
  'svelte-internal-client-src': {
    id: 'svelte-internal-client-src',
    type: 'repo',
    title: 'svelte/internal/client (compiled-output runtime)',
    venue: 'GitHub — sveltejs/svelte',
    url: 'https://github.com/sveltejs/svelte/tree/main/packages/svelte/src/internal/client',
    note: 'The runtime that compiled .svelte files import from.'
  },
  'rich-vdom-pure-overhead': {
    id: 'rich-vdom-pure-overhead',
    type: 'blog',
    title: 'Virtual DOM is pure overhead',
    authors: ['Rich Harris'],
    venue: 'svelte.dev/blog',
    year: '2018',
    note: 'The argument for the compile-time approach over reconciliation.'
  },
  'rich-rethinking-reactivity': {
    id: 'rich-rethinking-reactivity',
    type: 'talk',
    title: 'Rethinking Reactivity',
    authors: ['Rich Harris'],
    venue: 'YGLF 2019',
    year: '2019',
    note: "The talk that introduced Svelte 3's compile-time approach to a wide audience."
  },

  // ── Other framework primary sources ─────────────────────────────────
  'react-docs': {
    id: 'react-docs',
    type: 'docs',
    title: 'React documentation',
    venue: 'react.dev',
    url: 'https://react.dev'
  },
  'solid-docs': {
    id: 'solid-docs',
    type: 'docs',
    title: 'Solid.js documentation',
    venue: 'docs.solidjs.com',
    url: 'https://docs.solidjs.com'
  },
  'vue-reactivity-fundamentals': {
    id: 'vue-reactivity-fundamentals',
    type: 'docs',
    title: 'Vue 3: Reactivity Fundamentals',
    venue: 'vuejs.org',
    url: 'https://vuejs.org/guide/essentials/reactivity-fundamentals.html'
  },
  'preact-signals-announce': {
    id: 'preact-signals-announce',
    type: 'blog',
    title: 'Introducing Signals',
    authors: ['Preact team'],
    venue: 'preactjs.com/blog'
  },
  'react-fiber-architecture': {
    id: 'react-fiber-architecture',
    type: 'blog',
    title: 'React Fiber Architecture',
    authors: ['Andrew Clark'],
    venue: 'GitHub gist'
  },
  'react-without-memo-rfc': {
    id: 'react-without-memo-rfc',
    type: 'blog',
    title: 'React Compiler (formerly React Forget)',
    venue: 'react.dev/learn'
  },

  // ── Web platform & audio ────────────────────────────────────────────
  'mdn-modules': {
    id: 'mdn-modules',
    type: 'docs',
    title: 'JavaScript modules',
    venue: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules'
  },
  'mdn-source-maps': {
    id: 'mdn-source-maps',
    type: 'docs',
    title: 'Use a source map',
    venue: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/SourceMap'
  },
  'mdn-web-audio': {
    id: 'mdn-web-audio',
    type: 'docs',
    title: 'Web Audio API',
    venue: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API',
    note: 'The browser API that Tone.js wraps.'
  },
  'tone-docs': {
    id: 'tone-docs',
    type: 'docs',
    title: 'Tone.js documentation',
    venue: 'tonejs.github.io',
    url: 'https://tonejs.github.io',
    note: 'Music-aware wrapper around the Web Audio API.'
  },
  'wilson-two-clocks': {
    id: 'wilson-two-clocks',
    type: 'blog',
    title: 'A Tale of Two Clocks',
    authors: ['Chris Wilson'],
    venue: 'html5rocks',
    year: '2013',
    note: 'The canonical reference on Web Audio scheduling vs setInterval.'
  },

  // ── SvelteKit ───────────────────────────────────────────────────────
  'sveltekit-docs': {
    id: 'sveltekit-docs',
    type: 'docs',
    title: 'SvelteKit documentation',
    venue: 'kit.svelte.dev',
    url: 'https://kit.svelte.dev/docs'
  }
};

export function getSources(ids: string[]): Source[] {
  return ids.map((id) => sources[id]).filter(Boolean);
}

export function allSources(): Source[] {
  return Object.values(sources).sort((a, b) => a.title.localeCompare(b.title));
}

// ── Lesson → source ID mapping ────────────────────────────────────────
export const lessonCitations: Record<string, string[]> = {
  '01-hello-svelte/01-hello-component': ['svelte-docs', 'svelte-tutorial'],
  '01-hello-svelte/02-state-and-counter': ['svelte-docs', 'svelte-blog-runes'],
  '01-hello-svelte/03-many-counters': ['svelte-docs', 'svelte-internal-client-src', 'rich-vdom-pure-overhead'],

  '02-tap-tempo-detective/01-first-tap': ['svelte-docs', 'svelte-blog-runes'],
  '02-tap-tempo-detective/02-list-of-taps': ['svelte-docs'],
  '02-tap-tempo-detective/03-derive-bpm': ['svelte-docs', 'preact-signals-announce', 'solid-docs'],
  '02-tap-tempo-detective/04-persist': ['svelte-docs', 'react-docs'],
  '02-tap-tempo-detective/05-guess-mode': ['svelte-docs'],

  '03-metronome-studio/01-first-tick': ['tone-docs', 'mdn-web-audio', 'wilson-two-clocks'],
  '03-metronome-studio/02-bpm-knob': ['svelte-docs', 'tone-docs'],
  '03-metronome-studio/03-components': ['svelte-docs'],
  '03-metronome-studio/04-subdivisions': ['svelte-docs', 'svelte-blog-svelte-5-released'],
  '03-metronome-studio/05-spring-and-style': ['svelte-docs'],

  '04-chord-player/01-play-a-chord': ['tone-docs'],
  '04-chord-player/02-progression': ['svelte-docs'],
  '04-chord-player/03-bindable': ['svelte-docs', 'vue-reactivity-fundamentals'],
  '04-chord-player/04-shared-state': ['svelte-docs', 'svelte-blog-svelte-5-released'],
  '04-chord-player/05-save-and-share': ['svelte-docs'],

  '05-practice-journal/01-routing': ['sveltekit-docs'],
  '05-practice-journal/02-load': ['sveltekit-docs'],
  '05-practice-journal/03-form-actions': ['sveltekit-docs'],
  '05-practice-journal/04-render-modes': ['sveltekit-docs'],
  '05-practice-journal/05-deploy': ['sveltekit-docs', 'svelte-docs'],

  '06-capstone-foundations/01-setup': ['sveltekit-docs', 'tone-docs'],
  '06-capstone-foundations/02-step-grid': ['svelte-docs'],
  '06-capstone-foundations/03-sequence': ['tone-docs', 'wilson-two-clocks', 'mdn-web-audio'],
  '06-capstone-foundations/04-patterns': ['svelte-docs'],
  '06-capstone-foundations/05-recording': ['mdn-web-audio'],

  '07-capstone-polish/01-effects': ['tone-docs', 'mdn-web-audio'],
  '07-capstone-polish/02-mixer': ['svelte-docs'],
  '07-capstone-polish/03-fft': ['mdn-web-audio', 'tone-docs'],
  '07-capstone-polish/04-pulses': ['svelte-docs', 'svelte-internal-client-src'],
  '07-capstone-polish/05-profile': ['svelte-docs'],

  '08-ship-and-synthesis/01-deploy-daw': ['sveltekit-docs'],
  '08-ship-and-synthesis/02-polish-share': ['svelte-docs'],
  '08-ship-and-synthesis/03-synthesis': [
    'svelte-docs', 'react-docs', 'vue-reactivity-fundamentals', 'solid-docs',
    'svelte-blog-svelte-5-released', 'rich-vdom-pure-overhead',
    'react-fiber-architecture', 'react-without-memo-rfc', 'preact-signals-announce'
  ]
};

export function citationsForLesson(key: string): Source[] {
  return getSources(lessonCitations[key] ?? []);
}

export function lessonsCiting(sourceId: string): string[] {
  return Object.entries(lessonCitations)
    .filter(([, ids]) => ids.includes(sourceId))
    .map(([k]) => k);
}
