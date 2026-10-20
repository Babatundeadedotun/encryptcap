/// <reference types="vite/client" />

/**
 * Everything here is compiled into the public bundle. Only put values here that
 * are safe for anyone to read — secrets belong in backend/.env.
 */
interface ImportMetaEnv {
  /** Absolute API base. Empty means "same origin", which keeps the cookie first-party. */
  readonly VITE_API_BASE?: string;

  /** Brand details, overridable without a code change. */
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_COMPANY_RC?: string;
  readonly VITE_COMPANY_ADDRESS?: string;
  readonly VITE_CONTACT_PHONE?: string;
  readonly VITE_WHATSAPP_URL?: string;
  readonly VITE_SITE_URL?: string;

  /** Footer social links. Omitted from the UI when blank. */
  readonly VITE_TWITTER_URL?: string;
  readonly VITE_LINKEDIN_URL?: string;
  readonly VITE_INSTAGRAM_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
