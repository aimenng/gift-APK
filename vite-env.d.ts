/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_BASE_URL_WEB?: string;
  readonly VITE_API_BASE_URL_MOBILE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
