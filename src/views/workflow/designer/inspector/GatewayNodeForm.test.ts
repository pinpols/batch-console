// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus, { ElMessageBox } from 'element-plus'
import { i18n } from '@/locales'
import GatewayNodeForm from './GatewayNodeForm.vue'
import { useDesignerStore } from '../store/useDesignerStore'

describe('GatewayNodeForm', () => {
  it('阈值草稿未处理时阻止切换汇聚方式，应用后可继续切换', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useDesignerStore()
    store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '' })
    store.reset({
      nodes: [
        { id: 'a', nodeCode: 'A', nodeName: 'A', nodeType: 'JOB', x: 0, y: 0 },
        { id: 'b', nodeCode: 'B', nodeName: 'B', nodeType: 'JOB', x: 0, y: 0 },
        {
          id: 'g',
          nodeCode: 'G',
          nodeName: 'G',
          nodeType: 'GATEWAY',
          x: 0,
          y: 0,
          attrs: { joinMode: 'N_OF', joinThreshold: 1 },
        },
      ],
      edges: [
        { id: 'a-g', source: 'a', target: 'g' },
        { id: 'b-g', source: 'b', target: 'g' },
      ],
    })
    const wrapper = mount(GatewayNodeForm, {
      props: { node: store.nodes[2]!, readonly: false },
      global: { plugins: [pinia, i18n, ElementPlus] },
    })
    try {
      const input = wrapper.get('.el-input-number input').element as HTMLInputElement
      input.value = '2'
      input.dispatchEvent(new InputEvent('input', { bubbles: true }))
      await wrapper.vm.$nextTick()
      expect(store.getInspectorDraft('gatewayThreshold', 'g')?.value).toBe('2')
      await wrapper.findAll('.el-radio-button')[1]!.get('input').setValue()
      expect(store.nodes[2]!.attrs).toMatchObject({ joinMode: 'N_OF', joinThreshold: 1 })
      expect(store.getInspectorDraft('gatewayThreshold', 'g')?.value).toBe('2')
      expect(wrapper.get('[data-testid="gateway-threshold-draft"]').text()).toContain(
        i18n.global.t('workflowDesignerMvp.drafts.resolveThresholdBeforeMode'),
      )
      await wrapper.get('[data-testid="gateway-threshold-apply"]').trigger('click')
      expect(store.nodes[2]!.attrs?.joinThreshold).toBe(2)
      expect(store.getInspectorDraft('gatewayThreshold', 'g')).toBeUndefined()
      await wrapper.findAll('.el-radio-button')[1]!.get('input').setValue()
      expect(store.nodes[2]!.attrs?.joinMode).toBe('ANY')
      expect(store.nodes[2]!.attrs?.joinThreshold).toBeUndefined()
      await wrapper.findAll('.el-radio-button')[2]!.get('input').setValue()
      const secondInput = wrapper.get('.el-input-number input').element as HTMLInputElement
      secondInput.value = '3'
      secondInput.dispatchEvent(new InputEvent('input', { bubbles: true }))
      await wrapper.vm.$nextTick()
      await wrapper.findAll('.el-radio-button')[0]!.get('input').setValue()
      expect(store.nodes[2]!.attrs?.joinMode).toBe('N_OF')
      expect(
        (wrapper.get('[data-testid="gateway-threshold-apply"]').element as HTMLButtonElement)
          .disabled,
      ).toBe(true)
      vi.spyOn(ElMessageBox, 'confirm').mockResolvedValueOnce(
        'confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>,
      )
      await wrapper.get('[data-testid="gateway-threshold-discard"]').trigger('click')
      await wrapper.vm.$nextTick()
      expect(store.getInspectorDraft('gatewayThreshold', 'g')).toBeUndefined()
      await wrapper.findAll('.el-radio-button')[0]!.get('input').setValue()
      expect(store.nodes[2]!.attrs?.joinMode).toBe('ALL')
      expect(store.nodes[2]!.attrs?.joinThreshold).toBeUndefined()
    } finally {
      wrapper.unmount()
      vi.restoreAllMocks()
    }
  })

  it('汇聚方式展示中文并保留提交枚举值', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useDesignerStore()
    store.setLock({ isMine: true, lockedBy: 'test', expiresAt: '2099-01-01' })
    store.reset({
      nodes: [
        { id: 'a', nodeCode: 'A', nodeName: '上游一', nodeType: 'JOB', x: 0, y: 0 },
        { id: 'b', nodeCode: 'B', nodeName: '上游二', nodeType: 'JOB', x: 0, y: 0 },
        {
          id: 'g',
          nodeCode: 'G',
          nodeName: '汇聚',
          nodeType: 'GATEWAY',
          x: 0,
          y: 0,
          attrs: { joinMode: 'ALL' },
        },
      ],
      edges: [
        { id: 'a-g', source: 'a', target: 'g' },
        { id: 'b-g', source: 'b', target: 'g' },
      ],
    })
    const previousLocale = i18n.global.locale.value
    i18n.global.locale.value = 'zh-CN'
    const wrapper = mount(GatewayNodeForm, {
      props: { node: store.nodes[2]!, readonly: false },
      global: { plugins: [pinia, i18n, ElementPlus] },
    })
    try {
      const buttons = wrapper.findAll('.el-radio-button')
      expect(buttons.map((button) => button.text())).toEqual(['全部', '任一', '指定数量'])
      await buttons[2]!.find('input').setValue()
      expect(store.nodes[2]!.attrs?.joinMode).toBe('N_OF')
    } finally {
      wrapper.unmount()
      i18n.global.locale.value = previousLocale
    }
  })
})
