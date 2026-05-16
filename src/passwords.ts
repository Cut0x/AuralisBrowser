/**
 * passwords.ts — Gestionnaire de mots de passe chiffrés (AES-GCM 256 bits).
 * La clé maître est générée aléatoirement à l'installation et stockée dans
 * localStorage. Les mots de passe ne sont jamais persistés en clair.
 */

export interface SavedPassword {
  id: string;
  domain: string;
  username: string;
  encryptedPassword: string; // base64(iv + ciphertext)
  createdAt: number;
}

const KEY_STORAGE = 'auralis_master_key';
let _cachedKey: CryptoKey | null = null;

// ─── Key management ──────────────────────────────────────────────────────────

async function getMasterKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;

  const stored = localStorage.getItem(KEY_STORAGE);
  if (stored) {
    const raw = new Uint8Array(JSON.parse(stored) as number[]);
    _cachedKey = await crypto.subtle.importKey(
      'raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
    return _cachedKey;
  }

  // Generate and persist a new device key
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const exported = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem(KEY_STORAGE, JSON.stringify(Array.from(new Uint8Array(exported))));
  _cachedKey = key;
  return key;
}

// ─── Encrypt / Decrypt ───────────────────────────────────────────────────────

async function encrypt(plaintext: string): Promise<string> {
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  // Combine iv + ciphertext into one base64 string
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(b64: string): Promise<string> {
  const key = await getMasterKey();
  const combined = new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function savePassword(
  passwords: SavedPassword[],
  domain: string,
  username: string,
  password: string,
): Promise<SavedPassword[]> {
  const enc = await encrypt(password);
  const existing = passwords.findIndex(p => p.domain === domain && p.username === username);
  const entry: SavedPassword = {
    id:                existing >= 0 ? passwords[existing].id : crypto.randomUUID(),
    domain,
    username,
    encryptedPassword: enc,
    createdAt:         existing >= 0 ? passwords[existing].createdAt : Date.now(),
  };
  if (existing >= 0) {
    const next = [...passwords];
    next[existing] = entry;
    return next;
  }
  return [...passwords, entry];
}

export async function decryptPassword(entry: SavedPassword): Promise<string> {
  return decrypt(entry.encryptedPassword);
}

export function deletePassword(passwords: SavedPassword[], id: string): SavedPassword[] {
  return passwords.filter(p => p.id !== id);
}

export function findForDomain(passwords: SavedPassword[], url: string): SavedPassword[] {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return passwords.filter(p => p.domain.replace(/^www\./, '') === domain);
  } catch {
    return [];
  }
}

export function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}
