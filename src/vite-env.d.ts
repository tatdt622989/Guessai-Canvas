/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
  /** The old API domain's handoff path, e.g. https://api.6yuwei.com/guessai_canvas/handoff; empty turns it off. */
  readonly VITE_HANDOFF_URL?: string;
  readonly VITE_SOCKET_PATH?: string;
  readonly VITE_SOCKET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
