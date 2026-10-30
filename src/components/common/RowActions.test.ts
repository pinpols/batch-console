// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createI18n } from 'vue-i18n'
import messages from '@/locales/zh-CN'
import RowActions from './RowActions.vue'

enableAutoUnmount(afterEach)

describe('RowActions', () => {
  it('打开更多菜单及执行菜单动作不会触发行详情', async () => {
    const openRow = vi.fn()
    const reject = vi.fn()
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h('div', { onClick: openRow }, [
            h(RowActions, {
              inlineLimit: 1,
              actions: [
                { key: 'detail', label: '查看详情', onClick: openRow },
                { key: 'reject', label: '拒绝', danger: true, onClick: reject },
              ],
            }),
          ]),
      }),
      {
        attachTo: document.body,
        global: {
          plugins: [
            ElementPlus,
            createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': messages } }),
          ],
          directives: { 'track-click': () => {} },
        },
      },
    )
    await wrapper.get('.row-actions__more').trigger('click')
    expect(openRow).not.toHaveBeenCalled()
    const item = document.body.querySelector<HTMLElement>('[role="menuitem"]')!
    item.click()
    await vi.waitFor(() => expect(reject).toHaveBeenCalledOnce())
    expect(openRow).not.toHaveBeenCalled()
  })
})
