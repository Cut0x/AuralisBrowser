import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { setNavLoading, setNavState } from './ui.js';
import { HistManager } from './browser-history.js';
import { initBrowserEvents } from './browser-events.js';
import { logError } from './logger.js';

export interface NavigationState {
  url: string; title: string; favicon: string;
  canBack: boolean; canForward: boolean;
}
type NavCallback = (state: NavigationState) => void;
type NewTabCallback = (url: string) => void;

export class BrowserEngine {
  readonly hist = new HistManager();
  readonly newtabPage: HTMLElement;
  readonly urlbar: HTMLInputElement;
  _activeTabId: string | null = null;
  readonly _created = new Set<string>();
  _showingNewtab = true;
  _overlayActive = false;
  _webviewVisible = false;
  _navPending = false;
  _lastUrl = '';
  _onNavigate!: NavCallback;
  _onNewTab?: NewTabCallback;
  _onPwDetected?: (u: string, p: string) => void;

  constructor(onNavigate: NavCallback) {
    this.newtabPage = document.getElementById('newtab-page')!;
    this.urlbar = document.getElementById('urlbar') as HTMLInputElement;
    this._onNavigate = onNavigate;

    document.getElementById('btn-open-external')?.addEventListener('click', () => {
      try {
        const url = this.currentUrl();
        if (url && url !== 'about:newtab') {
          openUrl(url).catch(err => {
            logError('browser.openExternal', 'Ouverture externe impossible', { url, err: String(err) });
          });
        }
      } catch (err) {
        logError('browser.openExternal', 'Erreur inattendue pendant l’ouverture externe', { err: String(err) });
      }
    });

    window.addEventListener('resize', () => {
      try {
        void this.updateBounds(this._webviewVisible);
      } catch (err) {
        logError('browser.resize', 'Mise à jour des bounds impossible', { err: String(err) });
      }
    });

    const chrome = document.getElementById('browser-chrome');
    if (chrome) {
      new ResizeObserver(() => {
        try {
          if (!this._showingNewtab && !this._overlayActive) void this.updateBounds(true);
        } catch (err) {
          logError('browser.resizeObserver', 'ResizeObserver en erreur', { err: String(err) });
        }
      }).observe(chrome);
    }

    void initBrowserEvents(this).catch(err => {
      logError('browser.events.init', 'Initialisation des événements navigateur échouée', { err: String(err) });
    });
  }

  setNewTabCallback(fn: NewTabCallback): void { this._onNewTab = fn; }
  setPwDetectedCallback(fn: (u: string, p: string) => void): void { this._onPwDetected = fn; }
  setActiveTabId(id: string): void { this._activeTabId = id; }

  loadUrl(url: string): void {
    try {
      if (!url || url === 'about:newtab') { this.showNewtab(); return; }
      const tabId = this._activeTabId; if (!tabId) return;
      this._showingNewtab = false;
      this.newtabPage.classList.remove('active');
      setNavLoading(true); this._navPending = true; this._lastUrl = '';
      this.urlbar.value = url;
      const hist = this.hist.getOrCreate(tabId);
      if (hist.navIdx < hist.navHistory.length - 1) hist.navHistory = hist.navHistory.slice(0, hist.navIdx + 1);
      hist.navHistory.push(url); hist.navIdx = hist.navHistory.length - 1;

      if (!this._created.has(tabId)) {
        this._created.add(tabId);
        invoke<void>('tab_webview_create', { tabId, url }).catch(err => {
          logError('browser.loadUrl.create', 'Échec de création du WebView', { tabId, url, err: String(err) });
          setNavLoading(false);
          this._created.delete(tabId);
        });
      } else {
        void this.updateBounds(true);
        invoke<void>('tab_webview_navigate', { tabId, url }).catch(err => {
          logError('browser.loadUrl.navigate', 'Échec de navigation du WebView', { tabId, url, err: String(err) });
          setNavLoading(false);
        });
      }
    } catch (err) {
      setNavLoading(false);
      logError('browser.loadUrl', 'Erreur inattendue pendant loadUrl', { url, err: String(err) });
    }
  }

  showTabUrl(tabId: string, url: string): void {
    try {
      const prevId = this._activeTabId;
      if (prevId && prevId !== tabId && this._created.has(prevId)) {
        invoke<void>('tab_webview_hide', { tabId: prevId }).catch(err => {
          logError('browser.showTabUrl.hidePrev', 'Impossible de masquer le WebView précédent', { prevId, err: String(err) });
        });
      }

      this._activeTabId = tabId;
      if (!url || url === 'about:newtab') { this.showNewtab(); return; }
      this._showingNewtab = false;
      this.newtabPage.classList.remove('active');
      this.urlbar.value = url;

      if (this._created.has(tabId)) {
        void this.updateBounds(true);
        const hist = this.hist.getOrCreate(tabId);
        setNavState(hist.navIdx > 0, hist.navIdx < hist.navHistory.length - 1);
      } else {
        setNavLoading(true); this._navPending = true; this._lastUrl = '';
        const hist = this.hist.getOrCreate(tabId);
        if (!hist.navHistory.includes(url)) { hist.navHistory.push(url); hist.navIdx = hist.navHistory.length - 1; }
        this._created.add(tabId);
        invoke<void>('tab_webview_create', { tabId, url }).catch(err => {
          logError('browser.showTabUrl.create', 'Échec de création du WebView', { tabId, url, err: String(err) });
          setNavLoading(false);
          this._created.delete(tabId);
        });
      }
    } catch (err) {
      setNavLoading(false);
      logError('browser.showTabUrl', 'Erreur inattendue pendant showTabUrl', { tabId, url, err: String(err) });
    }
  }

  closeTabWebview(tabId: string): void {
    try {
      if (!this._created.has(tabId)) return;
      this._created.delete(tabId);
      this.hist.delete(tabId);
      invoke<void>('tab_webview_close', { tabId }).catch(err => {
        logError('browser.closeTabWebview', 'Échec de fermeture du WebView', { tabId, err: String(err) });
      });
    } catch (err) {
      logError('browser.closeTabWebview', 'Erreur inattendue pendant closeTabWebview', { tabId, err: String(err) });
    }
  }

  goBack(): void {
    try {
      const tabId = this._activeTabId; if (!tabId) return;
      const url = this.hist.back(tabId); if (!url) return;
      this.urlbar.value = url; setNavLoading(true); this._navPending = true; this._lastUrl = '';
      invoke<void>('tab_webview_navigate', { tabId, url }).catch(err => {
        logError('browser.goBack', 'Navigation arrière impossible', { tabId, url, err: String(err) });
        setNavLoading(false);
      });
    } catch (err) {
      setNavLoading(false);
      logError('browser.goBack', 'Erreur inattendue pendant goBack', { err: String(err) });
    }
  }

  goForward(): void {
    try {
      const tabId = this._activeTabId; if (!tabId) return;
      const url = this.hist.forward(tabId); if (!url) return;
      this.urlbar.value = url; setNavLoading(true); this._navPending = true; this._lastUrl = '';
      invoke<void>('tab_webview_navigate', { tabId, url }).catch(err => {
        logError('browser.goForward', 'Navigation avant impossible', { tabId, url, err: String(err) });
        setNavLoading(false);
      });
    } catch (err) {
      setNavLoading(false);
      logError('browser.goForward', 'Erreur inattendue pendant goForward', { err: String(err) });
    }
  }

  reload(): void {
    try {
      const tabId = this._activeTabId; if (!tabId) return;
      const url = this.currentUrl();
      if (!url || url === 'about:newtab') return;
      setNavLoading(true); this._navPending = true; this._lastUrl = '';
      invoke<void>('tab_webview_reload', { tabId }).catch(err => {
        logError('browser.reload', 'Rechargement impossible', { tabId, url, err: String(err) });
        setNavLoading(false);
      });
    } catch (err) {
      setNavLoading(false);
      logError('browser.reload', 'Erreur inattendue pendant reload', { err: String(err) });
    }
  }

  showNewtab(): void {
    try {
      this._showingNewtab = true;
      this.newtabPage.classList.add('active');
      void this.updateBounds(false);
      this.urlbar.value = '';
      const hist = this._activeTabId ? this.hist.getOrCreate(this._activeTabId) : null;
      this._onNavigate({
        url: 'about:newtab',
        title: 'Nouvel onglet',
        favicon: '',
        canBack: (hist?.navIdx ?? 0) > 0,
        canForward: hist ? hist.navIdx < hist.navHistory.length - 1 : false,
      });
    } catch (err) {
      logError('browser.showNewtab', 'Erreur inattendue pendant showNewtab', { err: String(err) });
    }
  }

  eval(js: string): void {
    try {
      const tabId = this._activeTabId; if (!tabId) return;
      invoke<void>('tab_webview_eval', { tabId, js }).catch(err => {
        logError('browser.eval', 'Injection JS impossible', { tabId, jsLength: js.length, err: String(err) });
      });
    } catch (err) {
      logError('browser.eval', 'Erreur inattendue pendant eval', { jsLength: js.length, err: String(err) });
    }
  }

  currentUrl(): string {
    if (!this._activeTabId) return 'about:newtab';
    const h = this.hist.get(this._activeTabId);
    return h?.navHistory[h.navIdx] ?? 'about:newtab';
  }

  canGoBack(): boolean { return this.hist.canBack(this._activeTabId ?? ''); }
  canGoForward(): boolean { return this.hist.canForward(this._activeTabId ?? ''); }
  get canShiftForOverlay(): boolean { return this._webviewVisible && !this._showingNewtab; }

  parkForOverlay(): void { this._overlayActive = true; void this.updateBounds(false); }
  restoreFromOverlay(): void { this._overlayActive = false; if (!this._showingNewtab) void this.updateBounds(true); }

  async shiftBoundsTop(newTop: number): Promise<void> {
    try {
      this._overlayActive = true;
      const tabId = this._activeTabId; if (!tabId) return;
      this._webviewVisible = true;
      await invoke<void>('tab_webview_show', {
        tabId,
        top: newTop,
        width: window.innerWidth,
        height: Math.max(1, window.innerHeight - newTop),
      }).catch(err => {
        logError('browser.shiftBoundsTop', 'Impossible de décaler la zone WebView', { tabId, top: newTop, err: String(err) });
      });
    } catch (err) {
      logError('browser.shiftBoundsTop', 'Erreur inattendue pendant shiftBoundsTop', { top: newTop, err: String(err) });
    }
  }

  async updateBounds(visible: boolean): Promise<void> {
    try {
      const chrome = document.getElementById('browser-chrome'); if (!chrome) return;
      this._webviewVisible = visible;
      const tabId = this._activeTabId;
      if (!tabId || !this._created.has(tabId)) return;
      if (!visible) {
        await invoke<void>('tab_webview_hide', { tabId }).catch(err => {
          logError('browser.updateBounds.hide', 'Impossible de masquer la WebView', { tabId, err: String(err) });
        });
        return;
      }
      const top = chrome.getBoundingClientRect().bottom;
      await invoke<void>('tab_webview_show', {
        tabId,
        top,
        width: window.innerWidth,
        height: Math.max(1, window.innerHeight - top),
      }).catch(err => {
        logError('browser.updateBounds.show', 'Impossible d’afficher la WebView', { tabId, top, err: String(err) });
      });
    } catch (err) {
      logError('browser.updateBounds', 'Erreur inattendue pendant updateBounds', { visible, err: String(err) });
    }
  }
}

