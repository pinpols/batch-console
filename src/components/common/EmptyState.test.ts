// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import EmptyState from './EmptyState.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      empty: {
        default: '暂无数据',
        error: '加载失败',
        filterTitle: '无匹配结果',
        filterDescription: '请调整筛选条件',
        tenantTitle: '当前租户暂无数据',
        tenantDescription: '可切换租户查看',
        noPermissionTitle: '无权限',
        noPermissionDescription: '请联系管理员',
        serviceDownTitle: '服务不可用',
        serviceDownDescription: '请稍后重试',
      },
      error: {
        forbidden: '禁止访问',
        forbiddenSub: '无权访问该资源',
        subtitle: '请重试',
        networkTitle: '网络异常',
        networkSub: '请检查网络',
      },
    },
  },
})

function factory(slots?: Record<string, string>) {
  return mount(EmptyState, {
    props: { title: '选择业务日历', description: '选择后加载窗口' },
    slots,
    global: {
      plugins: [i18n],
      stubs: {
        ElEmpty: {
          props: ['imageSize'],
          template:
            '<div class="stub-empty"><slot name="image"/><slot name="description"/><slot/></div>',
        },
      },
    },
  })
}

describe('EmptyState', () => {
  it('展示传入的操作内容', () => {
    const wrapper = factory({ action: '<button class="load-action">加载窗口</button>' })

    expect(wrapper.find('.load-action').text()).toBe('加载窗口')
    expect(wrapper.find('.empty-state__action').exists()).toBe(true)
  })

  it('没有操作时不渲染空的操作容器', () => {
    const wrapper = factory()

    expect(wrapper.find('.empty-state__action').exists()).toBe(false)
  })
})
