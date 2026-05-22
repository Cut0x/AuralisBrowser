/**
 * import.ts - Import/export de favoris au format Netscape Bookmark File
 * (HTML généré par Chrome, Firefox, Edge, Safari). Préserve l'arborescence
 * de dossiers. Fournit aussi l'ouverture d'un sélecteur de fichier natif.
 */

import type { BookmarkItem, BookmarkLink, BookmarkFolder } from './storage.js';

/** Parse un fichier de favoris HTML Netscape et retourne un arbre de favoris. */
export function parseNetscapeBookmarks(html: string): BookmarkItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rootDL = doc.querySelector('dl');
  if (!rootDL) {
    const items: BookmarkItem[] = [];
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') ?? '';
      if (href.startsWith('http://') || href.startsWith('https://')) {
        items.push({ id: crypto.randomUUID(), type: 'link', title: a.textContent?.trim() || href, url: href, createdAt: Date.now() });
      }
    });
    return items;
  }
  return parseDL(rootDL);
}

function parseDL(dl: Element): BookmarkItem[] {
  const items: BookmarkItem[] = [];
  const children = Array.from(dl.children);

  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.tagName !== 'DT') continue;

    // Important: ':scope > x' permet de cibler uniquement les enfants directs de DT.
    // Le parseur HTML5 place le <DL> du dossier a l interieur du <DT> comme enfant
    // (not as a sibling). Without ':scope >', querySelector('a') would recurse
    // dans les dossiers imbriques et les confondre avec des liens.
    const a  = node.querySelector(':scope > a');
    const h3 = node.querySelector(':scope > h3');

    if (a) {
      const href = a.getAttribute('href') ?? '';
      if (href.startsWith('http://') || href.startsWith('https://')) {
        const addDate = a.getAttribute('add_date');
        items.push({
          id: crypto.randomUUID(),
          type: 'link',
          title: a.textContent?.trim() || href,
          url: href,
          createdAt: addDate ? parseInt(addDate) * 1000 : Date.now(),
        } satisfies BookmarkLink);
      }
    } else if (h3) {
      // Le <DL> du dossier est en general un ENFANT DIRECT du <DT> (parseur HTML5
      // behaviour). Fallback to sibling search for non-standard parsers.
      const childDL: Element | null =
        node.querySelector(':scope > dl') ??
        (() => {
          for (let j = i + 1; j < children.length; j++) {
            if (children[j].tagName === 'DL') return children[j];
            if (children[j].tagName === 'DT') break;
          }
          return null;
        })();

      const addDate = h3.getAttribute('add_date');
      items.push({
        id: crypto.randomUUID(),
        type: 'folder',
        name: h3.textContent?.trim() || 'Dossier',
        children: childDL ? parseDL(childDL) : [],
        createdAt: addDate ? parseInt(addDate) * 1000 : Date.now(),
      } satisfies BookmarkFolder);
    }
  }
  return items;
}

/** Ouvre une boite de dialogue fichier et retourne le contenu sous forme de texte. */
export function openFileDialog(accept: string): Promise<string | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsText(file, 'UTF-8');
    };
    input.click();
  });
}

/** Exporte l'arbre des favoris en HTML Netscape et declenche le telechargement. */
export function exportBookmarks(bookmarks: BookmarkItem[]): void {
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Auralis Bookmarks</TITLE>',
    '<H1>Auralis Bookmarks</H1>',
  ];
  renderDL(bookmarks, lines, 0);

  const blob = new Blob([lines.join('\n')], { type: 'text/html;charset=UTF-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'auralis_bookmarks.html';
  a.click();
  URL.revokeObjectURL(url);
}

function renderDL(items: BookmarkItem[], lines: string[], depth: number): void {
  const pad = '    '.repeat(depth);
  lines.push(`${pad}<DL><p>`);
  for (const item of items) {
    if (item.type === 'link') {
      const ts = Math.floor(item.createdAt / 1000);
      lines.push(`${pad}    <DT><A HREF="${escapeHtml(item.url)}" ADD_DATE="${ts}">${escapeHtml(item.title)}</A>`);
    } else {
      lines.push(`${pad}    <DT><H3>${escapeHtml(item.name)}</H3>`);
      renderDL(item.children, lines, depth + 1);
    }
  }
  lines.push(`${pad}</DL><p>`);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
