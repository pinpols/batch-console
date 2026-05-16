/**
 * vue-i18n 9.x 类型 shim
 *
 * 背景:vue-tsc 5.x / TS 5.x + moduleResolution:bundler 在解析 vue-i18n 的
 * package.json `exports.types` 时偶发回退到 root `main: index.js` (CJS, 无类型),
 * 导致 `useI18n` 等命名导出被报"has no exported member"。
 * 运行时 / Vite 解析正常,只是 vue-tsc 类型解析路径不稳。
 *
 * 此处用 ambient module declaration **直接转发** dist 的全部类型,绕过解析边界。
 * (paths 映射在 vue-tsc 5.x 上不稳;shim 是更可靠的方案。)
 *
 * 升级到 vue-i18n 10 / vue-tsc 后再试着删本文件。
 */
declare module 'vue-i18n' {
  export * from 'vue-i18n/dist/vue-i18n.d.ts'
}
