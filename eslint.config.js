import vue from 'eslint-plugin-vue'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import { readFileSync } from 'node:fs'

// 从 unplugin-auto-import 生成的 dts 解析自动注入的全局名,
// 让 no-undef 不误报 computed / ref / onMounted 等(它们在 SFC 里看似未声明)。
function parseAutoImports() {
  try {
    const txt = readFileSync('./src/types/auto-imports.d.ts', 'utf8')
    return Object.fromEntries(
      [...txt.matchAll(/^\s*const\s+(\w+):/gm)].map((m) => [m[1], 'readonly']),
    )
  } catch {
    return {}
  }
}
const autoImportGlobals = parseAutoImports()

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/types/auto-imports.d.ts',
      'src/types/components.d.ts',
      'tools/docs-bridge/**/.vitepress/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx,vue}'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.es2024,
        ...autoImportGlobals,
      },
    },
    plugins: {
      vue,
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...vue.configs['flat/recommended'].rules,
      ...prettier.rules,
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // 禁用原生 v-html：统一走 v-safe-html（内部用 DOMPurify 过滤）
      'vue/no-v-html': 'error',
    },
  },
  {
    // .vue 兜底:vue-tsc 在 <script setup> 漏检未声明引用
    // (例:ProTable :error="loadError" + loadError.value = null 但忘 const loadError = ref())
    // plain tsc 能抓但 vue-tsc 漏过的场景由 no-undef 兜住,避免再翻车成运行时 ReferenceError
    files: ['**/*.vue'],
    rules: {
      'no-undef': 'error',
    },
  },
]

