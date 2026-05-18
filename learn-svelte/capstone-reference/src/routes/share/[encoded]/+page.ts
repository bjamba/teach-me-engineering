import { error } from '@sveltejs/kit';
import { decodePattern } from '$lib/audio/encoding';

// Dynamic encoded segment — can't enumerate at build time. The static
// adapter's SPA fallback (index.html) catches these on the live host and
// lets the client router run this load function in the browser.
export const prerender = false;

export function load({ params }) {
  const decoded = decodePattern(params.encoded);
  if (!decoded) throw error(400, 'Invalid pattern URL');
  return decoded;
}
