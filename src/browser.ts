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

type NavCallback = (state: NavigationState) => void;

export class BrowserEngine {
  private newtabPage: HTMLElement;
  private urlbar:     HTMLInputElement;

  // Client-side history stack (shared across tabs — real per-tab history lives in the webview).
  private navHistory: string[] = [];
  private navIdx     = -1;

  // When true, any incoming content-navigated / content-title events are stale
  // (fired for a page that was loaded in a tab that has since been closed or replaced).
  private isShowingNewtab = true;

  private onNavigate: NavCallback;

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

  loadUrl(url: string): void {
    if (!url || url === 'about:newtab') { this.showNewtab(); return; }

    this.isShowingNewtab = false;
    this.newtabPage.classList.remove('active');
    setNavLoading(true);

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

  /** Resize the content child webview to fill the area below the chrome.
   *  Call after layout changes: resize, favbar toggle, tab close. */
  async updateBounds(visible: boolean): Promise<void> {
    const chrome = document.getElementById('browser-chrome');
    if (!chrome) return;
    if (!visible) {
      // Park the webview off-screen so the newtab HTML shows through.
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
    // Fired by Rust (lib.rs) on every PageLoadEvent::Finished in the content webview.
    await listen<string>('content-navigated', e => {
      const url = e.payload;
      if (!url || url === 'about:blank') return;
      if (this.isShowingNewtab) return; // stale event — user already closed the tab

      setNavLoading(false);
      const canBack    = this.navIdx > 0;
      const canForward = this.navIdx < this.navHistory.length - 1;
      setNavState(canBack, canForward);

      // Update URL bar to the final URL after any redirects.
      this.urlbar.value = url;

      this.onNavigate({
        url, title: displayHostname(url), favicon: faviconFor(url),
        canBack, canForward,
      });
    });

    // Fired by Rust after fetch_title_inner resolves (can arrive seconds later).
    await listen<{ url: string; title: string }>('content-title', e => {
      const { url, title } = e.payload;
      // Guard 1: we've already moved to a new/different page.
      if (this.isShowingNewtab) return;
      // Guard 2: the title belongs to a URL that's no longer current.
      if (url !== this.currentUrl()) return;

      const canBack    = this.navIdx > 0;
      const canForward = this.navIdx < this.navHistory.length - 1;
      this.onNavigate({ url, title, favicon: faviconFor(url), canBack, canForward });
    });

    // Start with the content webview hidden (newtab HTML is shown instead).
    await this.updateBounds(false);
  }

  private loadWithoutHistory(url: string): void {
    this.isShowingNewtab = false;
    this.newtabPage.classList.remove('active');
    setNavLoading(true);
    this.urlbar.value = url;
    void this.updateBounds(true);
    invoke<void>('content_navigate', { url }).catch(console.error);
  }
}
