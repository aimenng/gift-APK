/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_BASE_URL_WEB?: string;
  readonly VITE_API_BASE_URL_MOBILE?: string;
  // VITE_* values are baked into the client bundle, so set this in the Vercel dashboard or
  // in .env.production.local (gitignored) — never in a committed .env file.
  readonly VITE_DEVELOPER_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
