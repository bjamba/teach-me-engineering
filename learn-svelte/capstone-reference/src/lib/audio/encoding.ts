// URL-safe base64 encoding for pattern sharing. The encoded string ends up in
// the URL, so we replace the three base64 characters that are not URL-safe
// (`+`, `/`, `=`) with their URL-safe counterparts.

export type EncodedPayload = {
  pattern: Record<string, number[]>;
  bpm: number;
};

export function encodePattern(pattern: Record<string, number[]>, bpm: number): string {
  const data = { p: pattern, b: bpm };
  return btoa(JSON.stringify(data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decodePattern(encoded: string): EncodedPayload | null {
  try {
    // Restore standard base64 chars before atob.
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Re-pad to a multiple of 4 — atob requires it.
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const obj = JSON.parse(atob(b64));
    if (!obj || typeof obj !== 'object') return null;
    if (!obj.p || typeof obj.b !== 'number') return null;
    return { pattern: obj.p, bpm: obj.b };
  } catch {
    return null;
  }
}
