// Bookmark import/export — parses the Netscape Bookmark File Format
// used by Chrome, Firefox, Edge, and Safari.

import type { Bookmark } from './storage.js';

/** Parse a Netscape HTML bookmark file and return a flat list of bookmarks. */
export function parseNetscapeBookmarks(html: string): Omit<Bookmark, 'id' | 'createdAt'>[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const results: Omit<Bookmark, 'id' | 'createdAt'>[] = [];

  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') ?? '';
    const title = a.textContent?.trim() ?? href;
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      results.push({ url: href, title: title || href });
    }
  });

  return results;
}

/** Trigger a file-open dialog and return the file content as a string. */
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

/** Export bookmarks to a Netscape HTML file and trigger download. */
export function exportBookmarks(bookmarks: Bookmark[]): void {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Auralis Bookmarks</TITLE>',
    '<H1>Auralis Bookmarks</H1>',
    '<DL><p>',
    ...bookmarks.map(b =>
      `    <DT><A HREF="${escapeHtml(b.url)}" ADD_DATE="${Math.floor(b.createdAt / 1000)}">${escapeHtml(b.title)}</A>`
    ),
    '</DL><p>',
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/html;charset=UTF-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'auralis_bookmarks.html';
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
