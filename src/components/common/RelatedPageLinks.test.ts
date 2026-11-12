// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RelatedPageLinks from './RelatedPageLinks.vue'

const mocks = vi.hoisted(() => ({ openable: new Set<string>() }))
vi.mock('@/composables/useRouteAccess', () => ({
  useRouteAccess: () => ({ canOpenPath: (path: string) => mocks.openable.has(path) }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }

function render(paths: string[]) {
  return mount(RelatedPageLinks, { props: { paths }, global: { stubs: { RouterLink } } })
}

describe('RelatedPageLinks', () => {
  it('只列出当前角色能打开的页面，标题取页面词条', () => {
    mocks.openable = new Set(['/reports'])
    const wrapper = render(['/reports', '/ops/capacity-profile'])

    const links = wrapper.findAll('a')
    expect(links.map((link) => link.attributes('href'))).toEqual(['/reports'])
    expect(links[0].text()).toBe('page.reports.title')
  })

  it('没有可打开的页面时整行不渲染', () => {
    mocks.openable = new Set()
    const wrapper = render(['/reports'])

    expect(wrapper.find('nav').exists()).toBe(false)
  })
})
