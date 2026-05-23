import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { setNavLoading, setNavState, toast, displayHostname, faviconFor } from './ui.js';
import { HistManager } from './browser-history.js';
import { initBrowserEvents } from './browser-events.js';
import { logError } from './logger.js';
import { isInternalUrl } from './internal-pages.js';

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
  _showingNewtab = true;
  _overlayActive = false;
  _webviewVisible = false;
  _navPending = false;
  _lastUrl = '';
  _activeContentTabId: string | null = null;
  _contentUrlByTab = new Map<string, string>();
  _knownWebviews = new Set<string>();
  _loadGuardTimer: number | null = null;
  _onNavigate!: NavCallback;
  _onNewTab?: NewTabCallback;
  _onPwDetected?: (u: string, p: string) => void;
  private readonly _eventsReady: Promise<void>;

  constructor(onNavigate: NavCallback) {
    this.newtabPage = document.getElementById('newtab-page')!;
    this.urlbar = document.getElementById('urlbar') as HTMLInputElement;
    this._onNavigate = onNavigate;

    document.getElementById('btn-open-external')?.addEventListener('click', () => {
      try {
        const url = this.currentUrl();
        if (url && url !== 'about:newtab' && !isInternalUrl(url)) {
          openUrl(url).catch(err => {
            logError('browser.openExternal', 'Ouverture externe impossible', { url, err: String(err) });
          });
        }
      } catch (err) {
        logError('browser.openExternal', 'Erreur inattendue pendant ouverture externe', { err: String(err) });
      }
    });

    window.addEventListener('resize', () => {
      try {
        void this.updateBounds(this._webviewVisible);
      } catch (err) {
        logError('browser.resize', 'Mise a jour des bounds impossible', { err: String(err) });
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

    this._eventsReady = initBrowserEvents(this).catch(err => {
      logError('browser.events.init', 'Initialisation des evenements navigateur echouee', { err: String(err) });
    });
  }

  setNewTabCallback(fn: NewTabCallback): void { this._onNewTab = fn; }
  setPwDetectedCallback(fn: (u: string, p: string) => void): void { this._onPwDetected = fn; }
  setActiveTabId(id: string): void { this._activeTabId = id; }
  async ensureEventsReady(): Promise<void> { await this._eventsReady; }

  loadUrl(url: string): void {
    try {
      if (!url || url === 'about:newtab') { this.showNewtab(); return; }
      if (isInternalUrl(url)) return;
      this.navigateToExternal(url, true);
    } catch (err) {
      setNavLoading(false);
      logError('browser.loadUrl', 'Erreur inattendue pendant loadUrl', { url, err: String(err) });
    }
  }

  showTabUrl(tabId: string, url: string): void {
    try {
      this._activeTabId = tabId;
      if (!url || url === 'about:newtab') { this.showNewtab(); return; }
      if (isInternalUrl(url)) {
        this.clearLoadingGuard();
        this._navPending = false;
        setNavLoading(false);
        return;
      }

      const hist = this.hist.getOrCreate(tabId);
      setNavState(hist.navIdx > 0, hist.navIdx < hist.navHistory.length - 1);
      this.urlbar.value = url;
      this._showingNewtab = false;
      this._overlayActive = false;
      this.newtabPage.classList.remove('active');
      this.clearLoadingGuard();
      this._navPending = false;
      this._lastUrl = url;
      setNavLoading(false);

      const top = Math.max(0, Math.round(document.getElementById('browser-chrome')!.getBoundingClientRect().bottom));
      const width = Math.max(1, Math.round(window.innerWidth));
      const height = Math.max(1, Math.round(window.innerHeight - top));
      invoke<void>('content_tab_activate', { tabId, top, width, height }).then(() => {
        this._activeContentTabId = tabId;
        this._knownWebviews.add(tabId);
        void this.updateBounds(true);
      }).catch(err => {
        logError('browser.showTabUrl.activate', 'Activation de la WebView onglet impossible', { tabId, err: String(err) });
      });

      if (this._contentUrlByTab.get(tabId) !== url) {
        this.navigateToExternal(url, false);
      }
    } catch (err) {
      setNavLoading(false);
      logError('browser.showTabUrl', 'Erreur inattendue pendant showTabUrl', { tabId, url, err: String(err) });
    }
  }

  closeTabWebview(tabId: string): void {
    try {
      this.hist.delete(tabId);
      this._contentUrlByTab.delete(tabId);
      this._knownWebviews.delete(tabId);
      if (this._activeContentTabId === tabId) this._activeContentTabId = null;
      invoke<void>('content_tab_close', { tabId }).catch(err => {
        logError('browser.closeTabWebview.close', 'Fermeture WebView onglet impossible', { tabId, err: String(err) });
      });
    } catch (err) {
      logError('browser.closeTabWebview', 'Erreur inattendue pendant closeTabWebview', { tabId, err: String(err) });
    }
  }

  goBack(): void {
    try {
      const tabId = this._activeTabId; if (!tabId) return;
      const url = this.hist.back(tabId); if (!url) return;
      this.urlbar.value = url;
      this.navigateToExternal(url, false);
    } catch (err) {
      setNavLoading(false);
      logError('browser.goBack', 'Erreur inattendue pendant goBack', { err: String(err) });
    }
  }

  goForward(): void {
    try {
      const tabId = this._activeTabId; if (!tabId) return;
      const url = this.hist.forward(tabId); if (!url) return;
      this.urlbar.value = url;
      this.navigateToExternal(url, false);
    } catch (err) {
      setNavLoading(false);
      logError('browser.goForward', 'Erreur inattendue pendant goForward', { err: String(err) });
    }
  }

  reload(): void {
    try {
      const tabId = this._activeTabId;
      if (!tabId) return;
      const url = this.currentUrl();
      if (!url || url === 'about:newtab' || isInternalUrl(url)) return;
      setNavLoading(true);
      this._navPending = true;
      this._lastUrl = '';
      this.startLoadingGuard(url);
      invoke<void>('content_reload', { tabId }).catch(err => {
        this.reportWebviewFailure('browser.reload', 'Rechargement impossible', url, err);
      });
    } catch (err) {
      setNavLoading(false);
      logError('browser.reload', 'Erreur inattendue pendant reload', { err: String(err) });
    }
  }

  showNewtab(): void {
    try {
      this._showingNewtab = true;
      this.clearLoadingGuard();
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
      const tabId = this._activeTabId;
      if (!tabId) return;
      invoke<void>('content_eval', { tabId, js }).catch(err => {
        logError('browser.eval', 'Injection JS impossible', { jsLength: js.length, err: String(err) });
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

  clearLoadingGuard(): void {
    if (this._loadGuardTimer != null) {
      window.clearTimeout(this._loadGuardTimer);
      this._loadGuardTimer = null;
    }
  }

  private startLoadingGuard(url: string): void {
    this.clearLoadingGuard();
    this._loadGuardTimer = window.setTimeout(() => {
      if (!this._navPending) return;
      this._navPending = false;
      setNavLoading(false);
      logError('browser.loadingGuard.timeout', 'Aucun event de navigation recu dans le delai', { url });
    }, 12000);
  }

  private markNavigationObserved(tabId: string, url: string): void {
    this._contentUrlByTab.set(tabId, url);
    this._navPending = false;
    this._lastUrl = url;
    this.clearLoadingGuard();
    setNavLoading(false);

    if (this._activeTabId !== tabId || this._showingNewtab) return;
    const hist = this.hist.getOrCreate(tabId);
    const canBack = hist.navIdx > 0;
    const canForward = hist.navIdx < hist.navHistory.length - 1;
    setNavState(canBack, canForward);
    this.urlbar.value = url;
    this._onNavigate({ url, title: displayHostname(url), favicon: faviconFor(url), canBack, canForward });
  }

  parkForOverlay(): void { this._overlayActive = true; void this.updateBounds(false); }
  restoreFromOverlay(): void { this._overlayActive = false; if (!this._showingNewtab) void this.updateBounds(true); }

  async shiftBoundsTop(newTop: number): Promise<void> {
    try {
      this._overlayActive = true;
      this._webviewVisible = true;
      const safeTop = Math.max(0, Math.min(Math.round(newTop), Math.max(0, Math.round(window.innerHeight) - 1)));
      const safeWidth = Math.max(1, Math.round(window.innerWidth));
      const safeHeight = Math.max(1, Math.round(window.innerHeight - safeTop));
      await invoke<void>('content_set_bounds', {
        top: safeTop,
        width: safeWidth,
        height: safeHeight,
      }).catch(err => {
        logError('browser.shiftBoundsTop', 'Impossible de decaler la zone WebView', { top: safeTop, err: String(err) });
      });
    } catch (err) {
      logError('browser.shiftBoundsTop', 'Erreur inattendue pendant shiftBoundsTop', { top: newTop, err: String(err) });
    }
  }

  async updateBounds(visible: boolean): Promise<void> {
    try {
      const chrome = document.getElementById('browser-chrome'); if (!chrome) return;
      this._webviewVisible = visible;
      if (!visible) {
        await invoke<void>('content_set_bounds', { top: 9999, width: 0, height: 1 }).catch(err => {
          logError('browser.updateBounds.hide', 'Impossible de masquer la WebView', { err: String(err) });
        });
        return;
      }
      const top = Math.max(0, Math.round(chrome.getBoundingClientRect().bottom));
      const width = Math.max(1, Math.round(window.innerWidth));
      const height = Math.max(1, Math.round(window.innerHeight - top));
      await invoke<void>('content_set_bounds', {
        top,
        width,
        height,
      }).catch(err => {
        logError('browser.updateBounds.show', 'Impossible d afficher la WebView', { top, err: String(err) });
      });
    } catch (err) {
      logError('browser.updateBounds', 'Erreur inattendue pendant updateBounds', { visible, err: String(err) });
    }
  }

  private navigateToExternal(url: string, pushHistory: boolean): void {
    const tabId = this._activeTabId;
    if (!tabId) return;

    this._showingNewtab = false;
    this._overlayActive = false;
    this.newtabPage.classList.remove('active');
    this.urlbar.value = url;
    setNavLoading(true);
    this._navPending = true;
    this._lastUrl = '';
    this.startLoadingGuard(url);

    if (pushHistory) {
      const hist = this.hist.getOrCreate(tabId);
      if (hist.navIdx < hist.navHistory.length - 1) {
        hist.navHistory = hist.navHistory.slice(0, hist.navIdx + 1);
      }
      hist.navHistory.push(url);
      hist.navIdx = hist.navHistory.length - 1;
    }

    const top = Math.max(0, Math.round(document.getElementById('browser-chrome')!.getBoundingClientRect().bottom));
    const width = Math.max(1, Math.round(window.innerWidth));
    const height = Math.max(1, Math.round(window.innerHeight - top));
    void this.updateBounds(true);
    invoke<void>('content_tab_activate', { tabId, top, width, height })
      .then(() => {
        this._activeContentTabId = tabId;
        this._knownWebviews.add(tabId);
        void this.updateBounds(true);
        this.markNavigationObserved(tabId, url);
        return invoke<void>('content_navigate', { tabId, url });
      })
      .catch(err => {
        this.reportWebviewFailure('browser.navigateToExternal', 'Navigation WebView impossible', url, err);
      });
  }

  private reportWebviewFailure(source: string, message: string, url: string, err: unknown): void {
    this._navPending = false;
    this.clearLoadingGuard();
    setNavLoading(false);
    const errorText = String(err);
    logError(source, message, { tabId: this._activeTabId, url, err: errorText });
    const runtimeMissing =
      errorText.toLowerCase().includes('webview2') ||
      errorText.includes('0x80070002') ||
      errorText.toLowerCase().includes('runtime(createwebview');
    if (runtimeMissing) {
      toast('WebView2 absent: installe Auralis avec le fichier setup.exe.', 'error');
      return;
    }
    toast('Navigation impossible. Verifie la console Auralis pour le detail.', 'error');
  }
}
