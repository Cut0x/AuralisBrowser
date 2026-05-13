// BrowserEngine — navigation via Tauri child webview (native WebView2, no iframe).
// The content webview is a separate native layer managed by Rust (lib.rs).

import { invoke }          from '@tauri-apps/api/core';
import { listen }          from '@tauri-apps/api/event';
import { openUrl }         from '@tauri-apps/plugin-opener';
import { setNavLoading, setNavState, faviconFor, displayHostname } from './ui.js';

export interface NavigationState {
  url:        string;
  title:      string;
  favicon:    string;
  canBack:    boolean;
  canForward: boolean;
}

type NavCallback    = (state: NavigationState) => void;
type NewTabCallback = (url: string) => void;

export class BrowserEngine {
  private newtabPage: HTMLElement;
  private urlbar:     HTMLInputElement;

  private navHistory: string[] = [];
  private navIdx     = -1;

  // True while the new-tab page is active — stale content-navigated events are ignored.
  private isShowingNewtab = true;

  // Dedup: prevents spurious WebView2 re-fires when window regains focus.
  private _navigationPending = false;
  private _lastHandledUrl    = '';

  private onNavigate:   NavCallback;
  private onNewTab?:    NewTabCallback;
  private onPwDetected?: (username: string, password: string) => void;

  constructor(onNavigate: NavCallback) {
    this.newtabPage = document.getElementById('newtab-page')!;
    this.urlbar     = document.getElementById('urlbar') as HTMLInputElement;
    this.onNavigate = onNavigate;

    document.getElementById('btn-open-external')?.addEventListener('click', () => {
      const url = this.currentUrl();
      if (url && url !== 'about:newtab') openUrl(url).catch(console.error);
    });

    window.addEventListener('resize', () => { void this.updateBounds(true); });

    void this.init();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  setNewTabCallback(fn: NewTabCallback): void {
    this.onNewTab = fn;
  }

  setPwDetectedCallback(fn: (username: string, password: string) => void): void {
    this.onPwDetected = fn;
  }

  loadUrl(url: string): void {
    if (!url || url === 'about:newtab') { this.showNewtab(); return; }

    this.isShowingNewtab = false;
    this.newtabPage.classList.remove('active');
    setNavLoading(true);
    this._navigationPending = true;
    this._lastHandledUrl    = '';

    if (this.navIdx < this.navHistory.length - 1) {
      this.navHistory = this.navHistory.slice(0, this.navIdx + 1);
    }
    this.navHistory.push(url);
    this.navIdx = this.navHistory.length - 1;
    this.urlbar.value = url;

    void this.updateBounds(true);
    invoke<void>('content_navigate', { url }).catch(err => {
      console.error('[Auralis] navigation error:', err);
      setNavLoading(false);
    });
  }

  goBack(): void {
    if (this.navIdx <= 0) return;
    this.navIdx--;
    this.loadWithoutHistory(this.navHistory[this.navIdx]);
  }

  goForward(): void {
    if (this.navIdx >= this.navHistory.length - 1) return;
    this.navIdx++;
    this.loadWithoutHistory(this.navHistory[this.navIdx]);
  }

  reload(): void {
    const url = this.currentUrl();
    if (!url || url === 'about:newtab') return;
    setNavLoading(true);
    this._navigationPending = true;
    this._lastHandledUrl    = '';
    invoke<void>('content_eval', { js: 'location.reload()' }).catch(console.error);
  }

  showNewtab(): void {
    this.isShowingNewtab = true;
    this.newtabPage.classList.add('active');
    void this.updateBounds(false);
    invoke<void>('content_navigate', { url: 'about:blank' }).catch(() => {});
    this.urlbar.value = '';
    this.onNavigate({
      url: 'about:newtab', title: 'Nouvel onglet', favicon: '',
      canBack: this.navIdx > 0, canForward: this.navIdx < this.navHistory.length - 1,
    });
  }

  currentUrl(): string {
    return this.navHistory[this.navIdx] ?? 'about:newtab';
  }

  canGoBack(): boolean    { return this.navIdx > 0; }
  canGoForward(): boolean { return this.navIdx < this.navHistory.length - 1; }

  async updateBounds(visible: boolean): Promise<void> {
    const chrome = document.getElementById('browser-chrome');
    if (!chrome) return;
    if (!visible) {
      await invoke<void>('content_set_bounds', { top: 9999, width: 0, height: 1 })
        .catch(() => {});
      return;
    }
    const top    = chrome.getBoundingClientRect().bottom;
    const width  = window.innerWidth;
    const height = Math.max(1, window.innerHeight - top);
    await invoke<void>('content_set_bounds', { top, width, height }).catch(() => {});
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async init(): Promise<void> {
    await listen<string>('content-navigated', e => {
      const url = e.payload;
      if (!url || url === 'about:blank') return;
      if (this.isShowingNewtab) return;

      // Skip spurious WebView2 re-fires (window focus events) when we didn't initiate nav
      if (!this._navigationPending && url === this._lastHandledUrl) return;
      this._navigationPending = false;
      this._lastHandledUrl    = url;

      setNavLoading(false);
      const canBack    = this.navIdx > 0;
      const canForward = this.navIdx < this.navHistory.length - 1;
      setNavState(canBack, canForward);

      this.urlbar.value = url;

      this.onNavigate({
        url, title: displayHostname(url), favicon: faviconFor(url),
        canBack, canForward,
      });

      // Inject interceptors after each real page load
      void this.injectNewTabScript();
      void this.injectFormListener();
    });

    await listen<{ url: string; title: string }>('content-title', e => {
      const { url, title } = e.payload;
      if (this.isShowingNewtab) return;
      if (url !== this.currentUrl()) return;

      const canBack    = this.navIdx > 0;
      const canForward = this.navIdx < this.navHistory.length - 1;
      this.onNavigate({ url, title, favicon: faviconFor(url), canBack, canForward });
    });

    // Rust fires this when the injected script routes a target="_blank" link
    await listen<string>('content-open-new-tab', e => {
      const url = e.payload;
      if (url && this.onNewTab) this.onNewTab(url);
    });

    // Rust fires this when a password form is submitted via sentinel URL
    await listen<string>('content-pw-detected', e => {
      try {
        const decoded = decodeURIComponent(e.payload);
        const { u, p } = JSON.parse(atob(decoded)) as { u: string; p: string };
        if (p && this.onPwDetected) this.onPwDetected(u || '', p);
      } catch { /* ignore malformed payload */ }
    });

    await this.updateBounds(false);
  }

  private loadWithoutHistory(url: string): void {
    this.isShowingNewtab = false;
    this.newtabPage.classList.remove('active');
    setNavLoading(true);
    this._navigationPending = true;
    this._lastHandledUrl    = '';
    this.urlbar.value = url;
    void this.updateBounds(true);
    invoke<void>('content_navigate', { url }).catch(console.error);
  }

  /** Inject a form submit interceptor to auto-detect password logins.
   *  On form submit with a password field: encodes credentials, navigates to sentinel URL.
   *  Rust intercepts, decodes, emits content-pw-detected, cancels navigation.
   *  The form then re-submits normally via setTimeout. */
  private async injectFormListener(): Promise<void> {
    const js = `(function(){
if(window.__a_pwpatch)return;
window.__a_pwpatch=true;
document.addEventListener('submit',function(e){
  var form=e.target;
  if(!form||form.tagName!=='FORM')return;
  var pw=form.querySelector('input[type="password"]');
  if(!pw||!pw.value)return;
  if(form.__auralis_sub)return;
  var uf=form.querySelector('input[type="email"],input[type="text"],[name*="user"],[name*="email"],[name*="login"],[id*="user"],[id*="email"],[id*="login"]');
  var u=uf?uf.value:'';
  form.__auralis_sub=true;
  e.preventDefault();
  try{
    var d=btoa(unescape(encodeURIComponent(JSON.stringify({u:u,p:pw.value}))));
    window.location.href='http://auralis-pw.invalid/save?d='+encodeURIComponent(d);
  }catch(err){}
  setTimeout(function(){form.__auralis_sub=false;form.submit();},200);
},true);
})();`;
    await invoke<void>('content_eval', { js }).catch(() => {});
  }

  /** Inject a tiny script that intercepts window.open() and target="_blank" clicks,
   *  routing them through our sentinel URL so Rust can emit content-open-new-tab. */
  private async injectNewTabScript(): Promise<void> {
    const js = `(function(){
  if(window.__a_ntpatch)return;
  window.__a_ntpatch=true;
  const _open=window.open.bind(window);
  window.open=function(url,target,f){
    if(url&&typeof url==='string'&&(url.startsWith('http://')||url.startsWith('https://'))){
      if(!target||target==='_blank'||target==='_new'||target==='_tab'){
        window.location.href='http://auralis-open.invalid/?url='+encodeURIComponent(url);
        return{closed:false,close:function(){},focus:function(){}};
      }
    }
    return _open(url,target,f);
  };
  document.addEventListener('click',function(e){
    let el=e.target;
    while(el&&el.tagName!=='A')el=el.parentElement;
    if(!el)return;
    const t=el.getAttribute('target');
    if(t&&t!=='_self'&&t!=='_top'&&t!=='_parent'){
      const h=el.href||el.getAttribute('href');
      if(h&&(h.startsWith('http://')||h.startsWith('https://'))){
        e.preventDefault();e.stopImmediatePropagation();
        window.location.href='http://auralis-open.invalid/?url='+encodeURIComponent(h);
      }
    }
  },true);
})();`;
    await invoke<void>('content_eval', { js }).catch(() => {});
  }
}
