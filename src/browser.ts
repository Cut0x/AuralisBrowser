/**
 * browser.ts — Moteur de navigation multi-onglets via des WebView2 enfants Tauri.
 *
 * Architecture : chaque onglet possède son propre WebView2 enfant (label "tab-{id}").
 * Changer d'onglet = afficher/masquer des WebViews, SANS recharger les pages.
 * Le WebView actif est positionné dans la zone de contenu ; les autres sont hors-écran.
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

interface TabHistory { navHistory: string[]; navIdx: number; }

export class BrowserEngine {
  private newtabPage:     HTMLElement;
  private urlbar:         HTMLInputElement;

  // Onglet actif (ID Tauri tab)
  private _activeTabId:   string | null = null;

  // Historique de navigation par onglet (back/forward JS-side)
  private _tabHistories   = new Map<string, TabHistory>();

  // Onglets dont le WebView a déjà été créé côté Rust
  private _createdWebviews = new Set<string>();

  private isShowingNewtab  = true;
  private _overlayActive   = false;
  private _webviewVisible  = false;
  private _navPending      = false;
  private _lastUrl         = '';

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

    window.addEventListener('resize', () => { void this.updateBounds(this._webviewVisible); });

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

  /** Définit l'onglet actif sans navigation (appelé lors d'un switch d'onglet). */
  setActiveTabId(tabId: string): void { this._activeTabId = tabId; }

  /** Navigue l'onglet actif vers une URL (crée son WebView si nécessaire). */
  loadUrl(url: string): void {
    if (!url || url === 'about:newtab') { this.showNewtab(); return; }
    const tabId = this._activeTabId;
    if (!tabId) return;

    this.isShowingNewtab = false;
    this._overlayActive  = false;
    this.newtabPage.classList.remove('active');
    setNavLoading(true);
    this._navPending = true;
    this._lastUrl    = '';
    this.urlbar.value = url;

    const hist = this._getOrCreateHistory(tabId);
    if (hist.navIdx < hist.navHistory.length - 1)
      hist.navHistory = hist.navHistory.slice(0, hist.navIdx + 1);
    hist.navHistory.push(url);
    hist.navIdx = hist.navHistory.length - 1;

    void this.updateBounds(true);

    if (!this._createdWebviews.has(tabId)) {
      // Crée le WebView et navigue d'emblée vers l'URL
      this._createdWebviews.add(tabId);
      invoke<void>('tab_webview_create', { tabId, url }).catch(err => {
        console.error('[Auralis] création webview:', err); setNavLoading(false);
      });
    } else {
      invoke<void>('tab_webview_navigate', { tabId, url }).catch(err => {
        console.error('[Auralis] navigation:', err); setNavLoading(false);
      });
    }
  }

  /**
   * Bascule vers un onglet existant.
   * Si le WebView de cet onglet est déjà chargé → simple affichage, PAS de rechargement.
   * Si l'onglet n'a pas encore de WebView (about:newtab) → affiche la page nouvel onglet.
   */
  showTabUrl(tabId: string, url: string): void {
    // Masque le WebView de l'onglet précédent
    const prevId = this._activeTabId;
    if (prevId && prevId !== tabId && this._createdWebviews.has(prevId)) {
      invoke<void>('tab_webview_hide', { tabId: prevId }).catch(() => {});
    }

    this._activeTabId = tabId;

    if (!url || url === 'about:newtab') {
      this.showNewtab();
      return;
    }

    this.isShowingNewtab = false;
    this._overlayActive  = false;
    this.newtabPage.classList.remove('active');
    this.urlbar.value = url;

    if (this._createdWebviews.has(tabId)) {
      // WebView déjà créé → juste l'afficher (aucun rechargement)
      void this.updateBounds(true);
      const hist = this._getOrCreateHistory(tabId);
      const canBack    = hist.navIdx > 0;
      const canForward = hist.navIdx < hist.navHistory.length - 1;
      setNavState(canBack, canForward);
    } else {
      // Premier affichage de cet onglet avec une vraie URL → créer le WebView
      setNavLoading(true);
      this._navPending = true;
      this._lastUrl    = '';
      const hist = this._getOrCreateHistory(tabId);
      if (!hist.navHistory.includes(url)) {
        hist.navHistory.push(url);
        hist.navIdx = hist.navHistory.length - 1;
      }
      void this.updateBounds(true);
      this._createdWebviews.add(tabId);
      invoke<void>('tab_webview_create', { tabId, url }).catch(err => {
        console.error('[Auralis] création webview:', err); setNavLoading(false);
      });
    }
  }

  /** Ferme et détruit le WebView d'un onglet. */
  closeTabWebview(tabId: string): void {
    if (this._createdWebviews.has(tabId)) {
      this._createdWebviews.delete(tabId);
      this._tabHistories.delete(tabId);
      invoke<void>('tab_webview_close', { tabId }).catch(() => {});
    }
  }

  goBack(): void {
    const tabId = this._activeTabId; if (!tabId) return;
    const hist = this._getOrCreateHistory(tabId);
    if (hist.navIdx <= 0) return;
    hist.navIdx--;
    const url = hist.navHistory[hist.navIdx];
    this.urlbar.value = url;
    setNavLoading(true); this._navPending = true; this._lastUrl = '';
    invoke<void>('tab_webview_navigate', { tabId, url }).catch(console.error);
  }

  goForward(): void {
    const tabId = this._activeTabId; if (!tabId) return;
    const hist = this._getOrCreateHistory(tabId);
    if (hist.navIdx >= hist.navHistory.length - 1) return;
    hist.navIdx++;
    const url = hist.navHistory[hist.navIdx];
    this.urlbar.value = url;
    setNavLoading(true); this._navPending = true; this._lastUrl = '';
    invoke<void>('tab_webview_navigate', { tabId, url }).catch(console.error);
  }

  reload(): void {
    const tabId = this._activeTabId; if (!tabId) return;
    if (!this.currentUrl() || this.currentUrl() === 'about:newtab') return;
    setNavLoading(true); this._navPending = true; this._lastUrl = '';
    invoke<void>('tab_webview_reload', { tabId }).catch(console.error);
  }

  showNewtab(): void {
    this.isShowingNewtab = true;
    this.newtabPage.classList.add('active');
    void this.updateBounds(false);
    this.urlbar.value = '';
    const hist = this._activeTabId ? this._getOrCreateHistory(this._activeTabId) : null;
    this.onNavigate({
      url: 'about:newtab', title: 'Nouvel onglet', favicon: '',
      canBack:    (hist?.navIdx ?? 0) > 0,
      canForward: hist ? hist.navIdx < hist.navHistory.length - 1 : false,
    });
  }

  eval(js: string): void {
    const tabId = this._activeTabId; if (!tabId) return;
    invoke<void>('tab_webview_eval', { tabId, js }).catch(() => {});
  }

  currentUrl(): string {
    if (!this._activeTabId) return 'about:newtab';
    const hist = this._tabHistories.get(this._activeTabId);
    return hist?.navHistory[hist.navIdx] ?? 'about:newtab';
  }

  canGoBack():    boolean {
    if (!this._activeTabId) return false;
    const h = this._tabHistories.get(this._activeTabId);
    return (h?.navIdx ?? 0) > 0;
  }
  canGoForward(): boolean {
    if (!this._activeTabId) return false;
    const h = this._tabHistories.get(this._activeTabId);
    return h ? h.navIdx < h.navHistory.length - 1 : false;
  }

  get canShiftForOverlay(): boolean {
    return this._webviewVisible && !this.isShowingNewtab;
  }

  parkForOverlay(): void {
    this._overlayActive = true;
    void this.updateBounds(false);
  }

  async shiftBoundsTop(newTop: number): Promise<void> {
    this._overlayActive = true;
    const tabId = this._activeTabId; if (!tabId) return;
    const width  = window.innerWidth;
    const height = Math.max(1, window.innerHeight - newTop);
    this._webviewVisible = true;
    await invoke<void>('tab_webview_show', { tabId, top: newTop, width, height }).catch(() => {});
  }

  restoreFromOverlay(): void {
    this._overlayActive = false;
    if (!this.isShowingNewtab) void this.updateBounds(true);
  }

  async updateBounds(visible: boolean): Promise<void> {
    const chrome = document.getElementById('browser-chrome');
    if (!chrome) return;
    this._webviewVisible = visible;
    const tabId = this._activeTabId;
    if (!tabId || !this._createdWebviews.has(tabId)) return;
    if (!visible) {
      await invoke<void>('tab_webview_hide', { tabId }).catch(() => {});
      return;
    }
    const top    = chrome.getBoundingClientRect().bottom;
    const width  = window.innerWidth;
    const height = Math.max(1, window.innerHeight - top);
    await invoke<void>('tab_webview_show', { tabId, top, width, height }).catch(() => {});
  }

  // ─── Privé ───────────────────────────────────────────────────────────────────

  private _getOrCreateHistory(tabId: string): TabHistory {
    if (!this._tabHistories.has(tabId))
      this._tabHistories.set(tabId, { navHistory: [], navIdx: -1 });
    return this._tabHistories.get(tabId)!;
  }

  private async init(): Promise<void> {
    // content-navigated : payload = { tabId, url }
    await listen<{ tabId: string; url: string }>('content-navigated', e => {
      const { tabId, url } = e.payload;
      if (!url || url === 'about:blank') return;
      if (tabId !== this._activeTabId) return; // onglet en arrière-plan, ignore

      if (!this._navPending && url === this._lastUrl) return;
      this._navPending = false; this._lastUrl = url;

      setNavLoading(false);
      const hist     = this._getOrCreateHistory(tabId);
      const canBack  = hist.navIdx > 0;
      const canForward = hist.navIdx < hist.navHistory.length - 1;
      setNavState(canBack, canForward);
      this.urlbar.value = url;
      this.onNavigate({ url, title: displayHostname(url), favicon: faviconFor(url), canBack, canForward });

      invoke<void>('tab_webview_eval', { tabId, js: NEW_TAB_SCRIPT }).catch(() => {});
      invoke<void>('tab_webview_eval', { tabId, js: FORM_CAPTURE_SCRIPT }).catch(() => {});
    });

    // content-title : payload = { tabId, url, title }
    await listen<{ tabId: string; url: string; title: string }>('content-title', e => {
      const { tabId, url, title } = e.payload;
      if (tabId !== this._activeTabId) return;
      const hist = this._getOrCreateHistory(tabId);
      const canBack    = hist.navIdx > 0;
      const canForward = hist.navIdx < hist.navHistory.length - 1;
      this.onNavigate({ url, title, favicon: faviconFor(url), canBack, canForward });
    });

    // content-open-new-tab : payload = url string (intercepté via auralis-open.invalid)
    await listen<string>('content-open-new-tab', e => {
      if (e.payload && this.onNewTab) this.onNewTab(e.payload);
    });

    // content-pw-detected : payload = base64 JSON (intercepté via auralis-pw.invalid)
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
