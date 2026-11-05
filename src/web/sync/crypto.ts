/*
 * The copy on GitHub is encrypted with a key made from the owner's own token, so the link to a
 * secret gist alone reveals nothing. The token never leaves the device except to GitHub itself.
 */

const SALT = new TextEncoder().encode('moi-plan-sync-v1');
const ROUNDS = 150_000;
const CHUNK = 0x8000;

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function keyFrom(token: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(token), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: SALT, iterations: ROUNDS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function seal(key: CryptoKey, bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  return JSON.stringify({ v: 1, iv: toBase64(iv), data: toBase64(data) });
}

export async function open(key: CryptoKey, sealed: string): Promise<Uint8Array> {
  const { iv, data } = JSON.parse(sealed) as { iv: string; data: string };
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(data)));
}

export const sealText = (key: CryptoKey, text: string) => seal(key, new TextEncoder().encode(text));
export const openText = async (key: CryptoKey, sealed: string) => new TextDecoder().decode(await open(key, sealed));
