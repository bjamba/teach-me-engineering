// The DAW is browser-only. Disable SSR; prerender the root shell so static
// hosts have something to serve. The static adapter's `fallback: index.html`
// catches every other route (share/[encoded], embed, etc.) and lets the
// client router take over.
export const ssr = false;
export const prerender = true;
export const trailingSlash = 'always';
