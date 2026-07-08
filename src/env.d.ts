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
  /** 前端 telemetry 日志总开关。`'true'` 才启用；默认关闭。 */
  readonly VITE_TELEMETRY_ENABLED?: string
  readonly VITE_TELEMETRY_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** vue-i18n 类型增强:让 `$t` / `t()` 的 key 自动补全到中文文案表 */
declare module 'vue-i18n' {
  type AppMessages = typeof import('@/locales/zh-CN').default
  interface DefineLocaleMessage extends AppMessages {}
}

/** vite-plugin-pwa 注入的 virtual module:dev 下不存在,导入时 await catch 兜底。 */
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: unknown) => void
  }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}

/** vite define 注入的构建期版本号(见 vite.config.ts define）。全局环境常量。 */
declare const __APP_VERSION__: string
