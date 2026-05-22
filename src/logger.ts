import { invoke } from '@tauri-apps/api/core';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function stringifyDetails(details: unknown): string | null {
  if (details == null) return null;
  if (typeof details === 'string') return details;
  try { return JSON.stringify(details, null, 2); }
  catch { return String(details); }
}

export function logApp(level: LogLevel, source: string, message: string, details?: unknown): void {
  const payload = stringifyDetails(details);
  const line = `[Auralis:${source}] ${message}`;
  if (level === 'error') console.error(line, details ?? '');
  else if (level === 'warn') console.warn(line, details ?? '');
  else if (level === 'debug') console.debug(line, details ?? '');
  else console.log(line, details ?? '');
  invoke<void>('console_log', { level, source, message, details: payload }).catch(() => {});
}

export function logError(source: string, message: string, details?: unknown): void {
  logApp('error', source, message, details);
}
