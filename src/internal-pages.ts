export type InternalSettingsSection =
  | 'apparence'
  | 'moteur'
  | 'demarrage'
  | 'favoris'
  | 'historique'
  | 'securite'
  | 'cache'
  | 'a-propos';

export type InternalRoute =
  | { kind: 'home' }
  | { kind: 'settings'; section: InternalSettingsSection };

const SETTINGS_SECTIONS = new Set<InternalSettingsSection>([
  'apparence',
  'moteur',
  'demarrage',
  'favoris',
  'historique',
  'securite',
  'cache',
  'a-propos',
]);

export const DEFAULT_SETTINGS_SECTION: InternalSettingsSection = 'apparence';
export const DEFAULT_INTERNAL_URL = 'auralis:home';

export function isInternalUrl(url: string): boolean {
  return /^auralis:(home|settings(?:\/.*)?)$/i.test(url.trim());
}

export function toInternalSettingsUrl(section: InternalSettingsSection = DEFAULT_SETTINGS_SECTION): string {
  return `auralis:settings/${section}`;
}

export function normalizeInternalUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_INTERNAL_URL;

  if (trimmed.startsWith('auralis::')) {
    const suffix = trimmed.slice('auralis::'.length).replace(/^\/+/, '');
    if (!suffix) return DEFAULT_INTERNAL_URL;
    if (suffix === 'settings') return 'auralis:settings';
    if (suffix.startsWith('settings/')) return `auralis:${suffix}`;
    return `auralis:${suffix}`;
  }

  if (trimmed.toLowerCase() === 'auralis:settings') return toInternalSettingsUrl();
  if (trimmed.toLowerCase() === 'auralis:home') return 'auralis:home';
  if (trimmed.toLowerCase().startsWith('auralis:settings/')) {
    const section = trimmed.slice('auralis:settings/'.length).toLowerCase() as InternalSettingsSection;
    return SETTINGS_SECTIONS.has(section) ? `auralis:settings/${section}` : toInternalSettingsUrl();
  }

  return trimmed;
}

export function parseInternalRoute(input: string): InternalRoute | null {
  const normalized = normalizeInternalUrl(input);
  if (normalized === 'auralis:home') return { kind: 'home' };
  if (normalized === 'auralis:settings') return { kind: 'settings', section: DEFAULT_SETTINGS_SECTION };
  if (normalized.startsWith('auralis:settings/')) {
    const section = normalized.slice('auralis:settings/'.length) as InternalSettingsSection;
    if (SETTINGS_SECTIONS.has(section)) return { kind: 'settings', section };
    return { kind: 'settings', section: DEFAULT_SETTINGS_SECTION };
  }
  return null;
}

export function internalTitle(url: string): string {
  const route = parseInternalRoute(url);
  if (!route) return 'Auralis';
  if (route.kind === 'home') return 'Auralis Home';
  if (route.section === 'a-propos') return 'Auralis - À propos';
  return `Auralis - ${route.section}`;
}
