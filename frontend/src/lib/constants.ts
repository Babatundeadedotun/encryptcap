/**
 * Brand constants shared across pages.
 *
 * Each one can be overridden from frontend/.env without touching code; the
 * fallbacks are the values from the design prototype, so an empty .env still
 * renders the site exactly as designed.
 */

const fromEnv = (value: string | undefined, fallback: string): string =>
  value && value.trim() ? value.trim() : fallback;

export const EMAIL = fromEnv(import.meta.env.VITE_CONTACT_EMAIL, 'invest@encryptcap.com');
export const RC = fromEnv(import.meta.env.VITE_COMPANY_RC, '7363337');
export const ADDRESS = fromEnv(
  import.meta.env.VITE_COMPANY_ADDRESS,
  'Post Service Estate, Ojo, Lagos, Nigeria',
);

/** Empty until a number is set — the About page says so rather than inventing one. */
export const PHONE = fromEnv(import.meta.env.VITE_CONTACT_PHONE, '');
export const WHATSAPP_URL = fromEnv(import.meta.env.VITE_WHATSAPP_URL, '');
export const SITE_URL = fromEnv(import.meta.env.VITE_SITE_URL, '');

export const SOCIAL_LINKS: Array<{ label: string; url: string }> = [
  { label: 'X / Twitter', url: fromEnv(import.meta.env.VITE_TWITTER_URL, '') },
  { label: 'LinkedIn', url: fromEnv(import.meta.env.VITE_LINKEDIN_URL, '') },
  { label: 'Instagram', url: fromEnv(import.meta.env.VITE_INSTAGRAM_URL, '') },
].filter((s) => s.url);

/** Colours needed in inline styles and SVG fills. Everything else uses tokens.css. */
export const C = {
  ink: '#0A2342',
  navySoft: '#1B4F8A',
  blue: '#2E9BD6',
  blueDeep: '#2B6CB0',
  gold: '#F2A900',
  goldDim: '#C98A00',
  red: '#E5392B',
  green: '#1F9D6B',
  textMute: '#5D6A78',
  textFaint: '#8D97A2',
  onDark: '#EAF1F8',
  onDarkMute: '#9FB4CA',
  line: '#E3D8C0',
  lineSoft: '#EFE7D4',
  surface: '#FFFDF7',
} as const;

export type TierId = 'x100' | 'consortium' | 'gold';

export interface Tier {
  id: TierId;
  label: string;
  short: string;
  min: number;
  cycleMo: number;
  cycle: string;
  accent: string;
  tag: string;
}

export const TIERS: Record<TierId, Tier> = {
  x100: {
    id: 'x100',
    label: '100X Portfolio',
    short: '100X',
    min: 1000,
    cycleMo: 12,
    cycle: '12-month',
    accent: C.blue,
    tag: 'Long-term growth',
  },
  consortium: {
    id: 'consortium',
    label: 'Consortium',
    short: 'Consortium',
    min: 2500,
    cycleMo: 3,
    cycle: 'Quarterly',
    accent: C.gold,
    tag: 'The steady compounder',
  },
  gold: {
    id: 'gold',
    label: 'Private / Gold',
    short: 'Private/Gold',
    min: 50000,
    cycleMo: 1,
    cycle: 'Monthly',
    accent: C.goldDim,
    tag: 'High-net-worth',
  },
};

export const TIER_LIST: Tier[] = [TIERS.x100, TIERS.consortium, TIERS.gold];

/** Which tier carries the "Most popular" badge. */
export const POPULAR_TIER: TierId | 'none' = 'consortium';

/** Risk-disclosure strip above the site header. */
export const SHOW_STRIP = true;

export const ARTICLE_CATEGORIES = [
  'All',
  'Markets',
  'Crypto',
  'Strategy',
  'Nigeria & the naira',
  'Fundamentals',
] as const;
