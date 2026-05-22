/**
 * ui.ts - Utilitaires d'interface partagés : thème, état de navigation,
 * toasts, favicon, troncature. Aucune dépendance vers les autres modules UI.
 */

import { t } from './i18n.js';

export function applyTheme(theme: 'dark' | 'light' | 'midnight'): void {
  document.documentElement.dataset.theme = theme;
}

export function setNavLoading(loading: boolean): void {
  document.getElementById('navbar')?.classList.toggle('is-loading', loading);
  const btn = document.getElementById('btn-reload') as HTMLButtonElement | null;
  btn?.classList.toggle('spinning', loading);
}

export function setNavState(canBack: boolean, canForward: boolean): void {
  (document.getElementById('btn-back')    as HTMLButtonElement).disabled = !canBack;
  (document.getElementById('btn-forward') as HTMLButtonElement).disabled = !canForward;
}

export function setBookmarkActive(active: boolean): void {
  const btn = document.getElementById('btn-bookmark');
  if (!btn) return;
  btn.classList.toggle('is-active', active);
  btn.title = active ? t('nav.bookmark_remove') : t('nav.bookmark_add');
}

export function setFavoritesBarVisible(visible: boolean): void {
  const bar = document.getElementById('favorites-bar');
  if (bar) bar.classList.toggle('hidden', !visible);
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export function faviconFor(pageUrl: string): string {
  try {
    const { origin } = new URL(pageUrl);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(origin)}&sz=32`;
  } catch { return ''; }
}

export function displayHostname(url: string): string {
  if (!url || url.startsWith('about:')) return url;
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch { return url; }
}

export function setStatusUrl(url: string | null): void {
  const el = document.getElementById('status-url');
  if (!el) return;
  if (!url) {
    el.textContent = '';
    el.classList.add('hidden');
    return;
  }
  el.textContent = url;
  el.classList.remove('hidden');
}

/** Affiche une notification courte en bas de l ecran. */
export function toast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  document.querySelector('.auralis-toast')?.remove();

  const el = document.createElement('div');
  el.className = `auralis-toast auralis-toast--${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);

  requestAnimationFrame(() => el.classList.add('is-visible'));

  setTimeout(() => {
    el.classList.remove('is-visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 2800);
}
