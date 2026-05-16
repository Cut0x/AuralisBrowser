/**
 * browser.ts — Moteur de navigation via la child webview native Tauri (WebView2).
 *
 * Architecture clé : la webview "content" est un contrôle natif Windows qui se
 * superpose TOUJOURS au-dessus du HTML de la fenêtre principale, quels que soient
 * les z-index CSS. Pour afficher un panneau HTML par-dessus la zone de contenu,
 * appeler parkForOverlay() avant et restoreFromOverlay() après.
 */

import { invoke }  from '@tauri-apps/api/core';
import { listen }  from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import { setNavLoading, setNavState, faviconFor, displayHostname } from './ui.js';
import { FORM_CAPTURE_SCRIPT, NEW_TAB_SCRIPT } from './browser-scripts.js';

export interface NavigationState {
  url: string; title: string; favicon: string;
  canBack: boolean; canForward: boolean;
}

type NavCallback    = (state: NavigationState) => void;
type NewTabCallback = (url: string) => void;

export class BrowserEngine {
  private newtabPage:        HTMLElement;
  private urlbar:            HTMLInputElement;
  private navHistory:        string[] = [];
  private navIdx             = -1;
  private isShowingNewtab    = true;
  private _navPending        = false;   // vrai entre un loadUrl et la réception de content-navigated
  private _lastUrl           = '';      // dernière URL émise — sert à dédupliquer
  private _overlayActive     = false;   // vrai quand un panneau masque la webview
  private _webviewVisible    = false;   // état courant appliqué à content_set_bounds
  private _contentUrl        = '';      // dernière URL réellement chargée dans la webview

  private onNavigate:    NavCallback;
  private onNewTab?:     NewTabCallback;
  private onPwDetected?: (u: string, p: string) => void;

  constructor(onNavigate: NavCallback) {
    this.newtabPage = document.getElementById('newtab-page')!;
    this.urlbar     = document.getElementById('urlbar') as HTMLInputElement;
    this.onNavigate = onNavigate;

    document.getElementById('btn-open-external')?.addEventListener('click', () => {
      const url = this.currentUrl();
      if (url && url !== 'about:newtab') openUrl(url).catch(console.error);
    });

    // Redimensionner la webview à chaque redimensionnement de la fenêtre
    window.addEventListener('resize', () => { void this.updateBounds(this._webviewVisible); });

    // ResizeObserver sur le chrome : ajuste automatiquement les bornes si la hauteur
    // du chrome change (bannière de MAJ, barre prompt MDP, barre des favoris…)
    const chrome = document.getElementById('browser-chrome');
    if (chrome) {
      new ResizeObserver(() => {
        if (!this.isShowingNewtab && !this._overlayActive) void this.updateBounds(true);
      }).observe(chrome);
    }

    void this.init();
  }

  // ─── API publique ────────────────────────────────────────────────────────────

  setNewTabCallback(fn: NewTabCallback): void { this.onNewTab = fn; }
  setPwDetectedCallback(fn: (u: string, p: string) => void): void { this.onPwDetected = fn; }

  loadUrl(url: string): void {
    if (!url || url === 'about:newtab') { this.showNewtab(); return; }
    this.isShowingNewtab = false;
    this._overlayActive  = false;
    this.newtabPage.classList.remove('active');
    setNavLoading(true);
    this._navPending = true;
    this._lastUrl    = '';
    if (this.navIdx < this.navHistory.length - 1)
      this.navHistory = this.navHistory.slice(0, this.navIdx + 1);
    this.navHistory.push(url);
    this.navIdx = this.navHistory.length - 1;
    this.urlbar.value = url;
    void this.updateBounds(true);
    invoke<void>('content_navigate', { url }).catch(err => {
      console.error('[Auralis] erreur navigation:', err); setNavLoading(false);
    });
  }

  goBack():    void { if (this.navIdx <= 0) return; this.navIdx--; this.loadDirect(this.navHistory[this.navIdx]); }
  goForward(): void { if (this.navIdx >= this.navHistory.length - 1) return; this.navIdx++; this.loadDirect(this.navHistory[this.navIdx]); }

  /**
   * Affiche l'URL d'un onglet existant sans créer d'entrée d'historique navigateur.
   * Utilisé lors du switch d'onglet pour éviter un rechargement forcé de logique.
   */
  showTabUrl(url: string): void {
    if (!url || url === 'about:newtab') { this.showNewtab(); return; }
    if (this._contentUrl === url) {
      this.isShowingNewtab = false;
      this._overlayActive  = false;
      this.newtabPage.classList.remove('active');
      this.urlbar.value = url;
      void this.updateBounds(true);
      return;
    }
    if (!this.isShowingNewtab && this.currentUrl() === url) return;
    this.loadDirect(url);
  }

  reload(): void {
    if (!this.currentUrl() || this.currentUrl() === 'about:newtab') return;
    setNavLoading(true); this._navPending = true; this._lastUrl = '';
    invoke<void>('content_reload').catch(console.error);
  }

  showNewtab(): void {
    this.isShowingNewtab = true;
    this.newtabPage.classList.add('active');
    void this.updateBounds(false);
    this.urlbar.value = '';
    this.onNavigate({ url: 'about:newtab', title: 'Nouvel onglet', favicon: '',
      canBack: this.navIdx > 0, canForward: this.navIdx < this.navHistory.length - 1 });
  }

  eval(js: string): void {
    invoke<void>('content_eval', { js }).catch(() => {});
  }

  currentUrl():   string  { return this.navHistory[this.navIdx] ?? 'about:newtab'; }
  canGoBack():    boolean { return this.navIdx > 0; }
  canGoForward(): boolean { return this.navIdx < this.navHistory.length - 1; }

  /** Masque la webview pour afficher un panneau HTML plein-écran (ex: panneau MDP). */
  parkForOverlay(): void {
    this._overlayActive = true;
    void this.updateBounds(false);
  }

  /**
   * Pousse le webview sous newTop sans le masquer.
   * Utilisé par le popover de dossier : la page reste visible sous le popover.
   * newTop = bas du popover en pixels depuis le haut de la fenêtre.
   */
  async shiftBoundsTop(newTop: number): Promise<void> {
    this._overlayActive = true;
    const width  = window.innerWidth;
    const height = Math.max(1, window.innerHeight - newTop);
    this._webviewVisible = true;
    await invoke<void>('content_set_bounds', { top: newTop, width, height }).catch(() => {});
  }

  /** Restaure la webview après fermeture d'un panneau ou d'un popover. */
  restoreFromOverlay(): void {
    this._overlayActive = false;
    if (!this.isShowingNewtab) void this.updateBounds(true);
  }

  async updateBounds(visible: boolean): Promise<void> {
    const chrome = document.getElementById('browser-chrome');
    if (!chrome) return;
    this._webviewVisible = visible;
    if (!visible) {
      await invoke<void>('content_set_bounds', { top: 9999, width: 0, height: 1 }).catch(() => {});
      return;
    }
    const top    = chrome.getBoundingClientRect().bottom;
    const width  = window.innerWidth;
    const height = Math.max(1, window.innerHeight - top);
    await invoke<void>('content_set_bounds', { top, width, height }).catch(() => {});
  }

  // ─── Privé ───────────────────────────────────────────────────────────────────

  private loadDirect(url: string): void {
    this.isShowingNewtab = false; this._overlayActive = false;
    this.newtabPage.classList.remove('active');
    setNavLoading(true); this._navPending = true; this._lastUrl = '';
    this.urlbar.value = url;
    void this.updateBounds(true);
    invoke<void>('content_navigate', { url }).catch(console.error);
  }

  private async init(): Promise<void> {
    await listen<string>('content-navigated', e => {
      const url = e.payload;
      if (!url || url === 'about:blank' || this.isShowingNewtab) return;
      if (!this._navPending && url === this._lastUrl) return; // déduplique les re-fires WebView2
      this._navPending = false; this._lastUrl = url; this._contentUrl = url;
      setNavLoading(false);
      const canBack = this.navIdx > 0, canForward = this.navIdx < this.navHistory.length - 1;
      setNavState(canBack, canForward);
      this.urlbar.value = url;
      this.onNavigate({ url, title: displayHostname(url), favicon: faviconFor(url), canBack, canForward });
      void invoke<void>('content_eval', { js: NEW_TAB_SCRIPT }).catch(() => {});
      void invoke<void>('content_eval', { js: FORM_CAPTURE_SCRIPT }).catch(() => {});
    });

    await listen<{ url: string; title: string }>('content-title', e => {
      const { url, title } = e.payload;
      if (this.isShowingNewtab || url !== this.currentUrl()) return;
      const canBack = this.navIdx > 0, canForward = this.navIdx < this.navHistory.length - 1;
      this.onNavigate({ url, title, favicon: faviconFor(url), canBack, canForward });
    });

    await listen<string>('content-open-new-tab', e => {
      if (e.payload && this.onNewTab) this.onNewTab(e.payload);
    });

    await listen<string>('content-pw-detected', e => {
      try {
        const bytes = Uint8Array.from(atob(e.payload), c => c.charCodeAt(0));
        const { u, p } = JSON.parse(new TextDecoder().decode(bytes)) as { u: string; p: string };
        if (p && this.onPwDetected) this.onPwDetected(u || '', p);
      } catch { /* payload malformé */ }
    });

    await this.updateBounds(false);
  }
}
