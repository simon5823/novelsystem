/// <reference types="vite/client" />

export interface NovelAPI {
  invoke: (cmd: string, args?: unknown) => Promise<unknown>;
}

declare global {
  interface Window {
    novel: NovelAPI;
  }
}
