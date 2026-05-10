/// <reference types="vite/client" />

/** View Transitions API：部分 TS lib 尚未收录 */
interface ViewTransition {
  readonly finished: Promise<void>
  readonly ready: Promise<void>
  readonly updateCallbackDone: Promise<void>
  skipTransition(): void
}

interface Document {
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransition
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_DEV_PROXY_TARGET?: string
  readonly VITE_APP_TITLE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** vue-i18n 类型增强:让 `$t` / `t()` 的 key 自动补全到中文文案表 */
declare module 'vue-i18n' {
  type AppMessages = typeof import('@/locales/zh-CN').default
  interface DefineLocaleMessage extends AppMessages {}
}
