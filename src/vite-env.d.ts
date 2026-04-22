/// <reference types="vite/client" />

/** Chromium PWA install prompt (not all browsers support this). */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare module '*.png' { const src: string; export default src }
declare module '*.jpg' { const src: string; export default src }

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
