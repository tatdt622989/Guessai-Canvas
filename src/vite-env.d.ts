/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  /** The old API domain's handoff path, e.g. https://api.6yuwei.com/guessai_canvas/handoff; empty turns it off. */
  readonly VITE_HANDOFF_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
