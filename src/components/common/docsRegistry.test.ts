import { describe, it, expect, vi } from 'vitest'
import { DOC_REGISTRY, resolveDocUrl } from './docsRegistry'

describe('DOC_REGISTRY', () => {
  it('每个 docKey 对应 path + title 完整,path 不带前导斜杠', () => {
    for (const [key, entry] of Object.entries(DOC_REGISTRY)) {
      expect(entry.path, `${key}.path`).toBeTruthy()
      expect(entry.title, `${key}.title`).toBeTruthy()
      expect(entry.path.startsWith('/'), `${key} path 不应以 / 开头`).toBe(false)
    }
  })

  it('包含核心 5 个 doc-key', () => {
    const expected = [
      'adr-009-workflow-param-dsl',
      'adr-002-transactional-outbox',
      'workflow-dependency-guide',
      'pipeline-vs-workflow-boundary',
      'coding-conventions',
    ]
    for (const k of expected) {
      expect(DOC_REGISTRY[k]).toBeDefined()
    }
  })

  it('docKey 全为 kebab-case(避免 camelCase / snake_case 混用)', () => {
    for (const k of Object.keys(DOC_REGISTRY)) {
      expect(k).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })
})

describe('resolveDocUrl', () => {
  it('未知 docKey 返回空字符串(避免 iframe 加载未定义页)', () => {
    expect(resolveDocUrl('nope-not-registered')).toBe('')
  })

  it('已知 docKey 返回 base + path 完整 URL', () => {
    const url = resolveDocUrl('adr-009-workflow-param-dsl')
    expect(url).toContain('/docs/')
    expect(url).toContain('architecture/adr/ADR-009-workflow-param-dsl')
  })

  it('test 环境(DEV=false)走相对路径 /docs/', () => {
    vi.stubEnv('DEV', false as never)
    const url = resolveDocUrl('coding-conventions')
    expect(url).toMatch(/^\/docs\/coding-conventions$/)
    vi.unstubAllEnvs()
  })
})
