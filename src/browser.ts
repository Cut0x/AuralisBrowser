import { invoke }  from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { setNavLoading, setNavState } from './ui.js';
import { HistManager } from './browser-history.js';
import { initBrowserEvents } from './browser-events.js';

export interface NavigationState {
  url: string; title: string; favicon: string;
  canBack: boolean; canForward: boolean;
}
type NavCallback    = (state: NavigationState) => void;
type NewTabCallback = (url: string) => void;

export class BrowserEngine {
  readonly hist     = new HistManager();
  readonly newtabPage: HTMLElement;
  readonly urlbar:  HTMLInputElement;
  _activeTabId:     string | null = null;
  readonly _created = new Set<string>();
  _showingNewtab    = true;
  _overlayActive    = false;
  _webviewVisible   = false;
  _navPending       = false;
  _lastUrl          = '';
  _onNavigate!:     NavCallback;
  _onNewTab?:       NewTabCallback;
  _onPwDetected?:   (u: string, p: string) => void;

  constructor(onNavigate: NavCallback) {
    this.newtabPage  = document.getElementById('newtab-page')!;
    this.urlbar      = document.getElementById('urlbar') as HTMLInputElement;
    this._onNavigate = onNavigate;
    document.getElementById('btn-open-external')?.addEventListener('click', () => {
      const url = this.currentUrl();
      if (url && url !== 'about:newtab') openUrl(url).catch(console.error);
    });
    window.addEventListener('resize', () => { void this.updateBounds(this._webviewVisible); });
    const chrome = document.getElementById('browser-chrome');
    if (chrome) new ResizeObserver(() => {
      if (!this._showingNewtab && !this._overlayActive) void this.updateBounds(true);
    }).observe(chrome);
    void initBrowserEvents(this);
  }

  setNewTabCallback(fn: NewTabCallback): void { this._onNewTab = fn; }
  setPwDetectedCallback(fn: (u: string, p: string) => void): void { this._onPwDetected = fn; }
  setActiveTabId(id: string): void { this._activeTabId = id; }

  loadUrl(url: string): void {
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
      // Le WebView est créé hors-écran ; updateBounds sera appelé depuis content-navigated
      invoke<void>('tab_webview_create', { tabId, url }).catch(err => { console.error('[Auralis]', err); setNavLoading(false); this._created.delete(tabId); });
    } else {
      void this.updateBounds(true);
      invoke<void>('tab_webview_navigate', { tabId, url }).catch(err => { console.error('[Auralis]', err); setNavLoading(false); });
    }
  }

  showTabUrl(tabId: string, url: string): void {
    const prevId = this._activeTabId;
    if (prevId && prevId !== tabId && this._created.has(prevId))
      invoke<void>('tab_webview_hide', { tabId: prevId }).catch(() => {});
    this._activeTabId = tabId;
    if (!url || url === 'about:newtab') { this.showNewtab(); return; }
    this._showingNewtab = false;
    this.newtabPage.classList.remove('active'); this.urlbar.value = url;
    if (this._created.has(tabId)) {
      void this.updateBounds(true);
      const hist = this.hist.getOrCreate(tabId);
      setNavState(hist.navIdx > 0, hist.navIdx < hist.navHistory.length - 1);
    } else {
      setNavLoading(true); this._navPending = true; this._lastUrl = '';
      const hist = this.hist.getOrCreate(tabId);
      if (!hist.navHistory.includes(url)) { hist.navHistory.push(url); hist.navIdx = hist.navHistory.length - 1; }
      this._created.add(tabId);
      // Le WebView est créé hors-écran ; updateBounds sera appelé depuis content-navigated
      invoke<void>('tab_webview_create', { tabId, url }).catch(err => { console.error('[Auralis]', err); setNavLoading(false); this._created.delete(tabId); });
    }
  }

  closeTabWebview(tabId: string): void {
    if (!this._created.has(tabId)) return;
    this._created.delete(tabId); this.hist.delete(tabId);
    invoke<void>('tab_webview_close', { tabId }).catch(() => {});
  }

  goBack(): void {
    const tabId = this._activeTabId; if (!tabId) return;
    const url = this.hist.back(tabId); if (!url) return;
    this.urlbar.value = url; setNavLoading(true); this._navPending = true; this._lastUrl = '';
    invoke<void>('tab_webview_navigate', { tabId, url }).catch(console.error);
  }

  goForward(): void {
    const tabId = this._activeTabId; if (!tabId) return;
    const url = this.hist.forward(tabId); if (!url) return;
    this.urlbar.value = url; setNavLoading(true); this._navPending = true; this._lastUrl = '';
    invoke<void>('tab_webview_navigate', { tabId, url }).catch(console.error);
  }

  reload(): void {
    const tabId = this._activeTabId; if (!tabId) return;
    if (!this.currentUrl() || this.currentUrl() === 'about:newtab') return;
    setNavLoading(true); this._navPending = true; this._lastUrl = '';
    invoke<void>('tab_webview_reload', { tabId }).catch(console.error);
  }

  showNewtab(): void {
    this._showingNewtab = true; this.newtabPage.classList.add('active');
    void this.updateBounds(false); this.urlbar.value = '';
    const hist = this._activeTabId ? this.hist.getOrCreate(this._activeTabId) : null;
    this._onNavigate({ url: 'about:newtab', title: 'Nouvel onglet', favicon: '',
      canBack: (hist?.navIdx ?? 0) > 0, canForward: hist ? hist.navIdx < hist.navHistory.length - 1 : false });
  }

  eval(js: string): void {
    const tabId = this._activeTabId; if (!tabId) return;
    invoke<void>('tab_webview_eval', { tabId, js }).catch(() => {});
  }

  currentUrl(): string {
    if (!this._activeTabId) return 'about:newtab';
    const h = this.hist.get(this._activeTabId);
    return h?.navHistory[h.navIdx] ?? 'about:newtab';
  }

  canGoBack():    boolean { return this.hist.canBack(this._activeTabId ?? ''); }
  canGoForward(): boolean { return this.hist.canForward(this._activeTabId ?? ''); }
  get canShiftForOverlay(): boolean { return this._webviewVisible && !this._showingNewtab; }

  parkForOverlay(): void { this._overlayActive = true; void this.updateBounds(false); }
  restoreFromOverlay(): void { this._overlayActive = false; if (!this._showingNewtab) void this.updateBounds(true); }

  async shiftBoundsTop(newTop: number): Promise<void> {
    this._overlayActive = true;
    const tabId = this._activeTabId; if (!tabId) return;
    this._webviewVisible = true;
    await invoke<void>('tab_webview_show', { tabId, top: newTop, width: window.innerWidth, height: Math.max(1, window.innerHeight - newTop) }).catch(() => {});
  }

  async updateBounds(visible: boolean): Promise<void> {
    const chrome = document.getElementById('browser-chrome'); if (!chrome) return;
    this._webviewVisible = visible;
    const tabId = this._activeTabId;
    if (!tabId || !this._created.has(tabId)) return;
    if (!visible) { await invoke<void>('tab_webview_hide', { tabId }).catch(e => console.error('[Auralis] hide:', e)); return; }
    const top = chrome.getBoundingClientRect().bottom;
    await invoke<void>('tab_webview_show', { tabId, top, width: window.innerWidth, height: Math.max(1, window.innerHeight - top) }).catch(e => console.error('[Auralis] show:', e));
  }
}
