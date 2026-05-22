// URL resolution and search engine logic.
// Decides whether a user's input is a URL, a domain, or a search query.

import type { SearchEngine } from './storage.js';
import { isInternalUrl, normalizeInternalUrl } from './internal-pages.js';

const SEARCH_URLS: Record<SearchEngine, string> = {
  google:     'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  brave:      'https://search.brave.com/search?q=',
  startpage:  'https://www.startpage.com/do/search?query=',
};

export function buildSearchUrl(query: string, engine: SearchEngine): string {
  return SEARCH_URLS[engine] + encodeURIComponent(query);
}

/** Returns true if the input looks like a fully-qualified URL. */
export function isUrl(input: string): boolean {
  if (input.startsWith('about:')) return true;
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Returns true if the input looks like a bare domain (e.g. "github.com"). */
export function isDomain(input: string): boolean {
  if (input.includes(' ')) return false;
  if (!input.includes('.')) return false;
  try {
    const url = new URL('https://' + input);
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname);
  } catch {
    return false;
  }
}

/** Ensures a URL has a scheme. */
export function normalizeUrl(input: string): string {
  if (input.startsWith('about:')) return input;
  if (/^https?:\/\//i.test(input)) return input;
  return 'https://' + input;
}

/**
 * The smart resolver: turns whatever the user typed into a navigable URL.
 * - Full URL  → navigate directly
 * - Domain    → prepend https://
 * - Anything else → search
 */
const INTERNAL_INVALID_PAGES: Record<string, string> = {
  'auralis-pw.invalid': 'auralis:settings/securite',
};

export function resolveInput(input: string, engine: SearchEngine): string {
  const trimmed = input.trim();
  if (!trimmed) return 'about:newtab';
  if (trimmed === 'about:newtab' || trimmed === 'about:blank') return trimmed;
  if (trimmed.startsWith('auralis::')) return normalizeInternalUrl(trimmed);
  if (isInternalUrl(trimmed)) return normalizeInternalUrl(trimmed);
  const bare = trimmed.replace(/^https?:\/\//, '');
  if (bare in INTERNAL_INVALID_PAGES) return INTERNAL_INVALID_PAGES[bare]!;
  if (isUrl(trimmed)) return normalizeUrl(trimmed);
  if (isDomain(trimmed)) return normalizeUrl(trimmed);
  return buildSearchUrl(trimmed, engine);
}
