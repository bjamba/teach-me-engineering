// The demos page imports Tone.js-using components that touch `window` in their
// module-level reactivity setup. Skip SSR so they only render in the browser.
export const ssr = false;
