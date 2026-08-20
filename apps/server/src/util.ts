export function nowIso(): string {
  return new Date().toISOString();
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function newId(prefix: string): string {
  return `${prefix}_${randomHex(8)}`;
}

export function newApiKey(): string {
  return `pa_${randomHex(24)}`;
}

export function newSecret(): string {
  return `sk_${randomHex(24)}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 決定的なハンドシード。セッションシードとハンド番号から混ぜる */
export function mixSeed(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** bb/100 と 95% 信頼区間(半幅)を求める */
export function computeRating(
  hands: number,
  netChips: number,
  sumSqBb: number,
  chipsPerBb: number,
): { bb100: number; ci95: number | null } {
  if (hands <= 0) return { bb100: 0, ci95: null };
  const meanBb = netChips / chipsPerBb / hands;
  const bb100 = meanBb * 100;
  if (hands < 100) return { bb100, ci95: null };
  const variance = Math.max(0, sumSqBb / hands - meanBb * meanBb);
  const stderr = Math.sqrt(variance / hands);
  return { bb100, ci95: 1.96 * stderr * 100 };
}
