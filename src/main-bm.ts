import { t }                                   from './i18n.js';
import { toast }                               from './ui.js';
import { saveSettings }                        from './storage.js';
import { addBookmark, removeBookmark,
         findBookmarkByUrl, countBookmarkLinks,
         mergeBookmarks }                      from './bookmarks-store.js';
import { parseNetscapeBookmarks, openFileDialog } from './import.js';
import { setBookmarkActive }                   from './ui.js';
import { browser, tabs, settings, updateSettings } from './state.js';
import { renderFavBar }                        from './ui-favbar.js';
import { renderNewtabFavs }                    from './ui-newtab.js';

export function initBookmarkHandlers(): void {
  let _pendingBmUrl = '', _pendingBmTitle = '';

  document.getElementById('btn-bookmark')?.addEventListener('click', () => {
    const url = browser.currentUrl(); if (!url || url === 'about:newtab') return;
    const existing = findBookmarkByUrl(settings.bookmarks, url);
    if (existing) {
      updateSettings(removeBookmark(settings, existing.id));
      saveSettings(settings); setBookmarkActive(false);
      renderFavBar(); renderNewtabFavs(); toast(t('toast.bookmark_removed'));
    } else {
      _pendingBmUrl   = url;
      _pendingBmTitle = tabs.getActive()?.title || url;
      const input = document.getElementById('bm-title-input') as HTMLInputElement;
      input.value = _pendingBmTitle;
      document.getElementById('bm-save-prompt')?.classList.remove('hidden');
      input.focus(); input.select();
    }
  });

  document.getElementById('bm-title-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter')  document.getElementById('btn-bm-save-confirm')?.click();
    if (e.key === 'Escape') document.getElementById('btn-bm-save-cancel')?.click();
  });

  document.getElementById('btn-bm-save-confirm')?.addEventListener('click', () => {
    const input = document.getElementById('bm-title-input') as HTMLInputElement;
    const title = input.value.trim() || _pendingBmTitle;
    if (_pendingBmUrl) {
      updateSettings(addBookmark(settings, title, _pendingBmUrl));
      saveSettings(settings); setBookmarkActive(true);
      renderFavBar(); renderNewtabFavs(); toast(t('toast.bookmark_added'), 'success');
    }
    document.getElementById('bm-save-prompt')?.classList.add('hidden');
    _pendingBmUrl = ''; _pendingBmTitle = '';
  });

  document.getElementById('btn-bm-save-cancel')?.addEventListener('click', () => {
    document.getElementById('bm-save-prompt')?.classList.add('hidden');
    _pendingBmUrl = ''; _pendingBmTitle = '';
  });

  document.getElementById('btn-favbar-import')?.addEventListener('click', async () => {
    const html = await openFileDialog('.html,.htm'); if (!html) return;
    const imported = parseNetscapeBookmarks(html);
    updateSettings(mergeBookmarks(settings, imported));
    saveSettings(settings); renderFavBar(); renderNewtabFavs();
    toast(`${t('toast.imported')} (${countBookmarkLinks(imported)})`, 'success');
  });
}
