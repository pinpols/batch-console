// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import CopyableText from './CopyableText.vue'

const copy = vi.hoisted(() => vi.fn())
const hide = vi.hoisted(() => vi.fn())
const scannedRoots = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useCopy', () => ({ useCopy: () => ({ copy }) }))
vi.mock('tabbable', () => ({
  tabbable: (root: HTMLElement) => {
    scannedRoots(root)
    return Array.from(
      root.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]'),
    )
  },
  isTabbable: (target: HTMLElement) =>
    !target.hasAttribute('disabled') && !target.closest('[hidden]'),
}))

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': { common: { copy: '复制', viewFullValue: '查看完整内容' } } },
})

function render(text: string, iconOnly = false, slot?: string) {
  return mount(CopyableText, {
    props: { text, iconOnly },
    slots: slot ? { default: slot } : undefined,
    global: {
      plugins: [i18n],
      stubs: {
        ElPopover: {
          name: 'ElPopover',
          setup(_props, { expose }) {
            expose({ hide })
          },
          template: '<div><slot name="reference" /><div class="el-popper"><slot /></div></div>',
        },
        ElButton: { template: '<button type="button"><slot /></button>' },
        ElIcon: { template: '<span><slot /></span>' },
      },
    },
  })
}

describe('CopyableText', () => {
  beforeEach(() => {
    copy.mockReset()
    hide.mockReset()
    scannedRoots.mockReset()
  })

  it('shows the complete value and copies the full text using keyboard or the explicit action', async () => {
    const value = 'workflow-request-very-long-1234567890'
    const wrapper = render(value)
    const display = wrapper.get('[role="button"]')
    expect(display.attributes('tabindex')).toBe('0')
    expect(wrapper.get('.copyable-text__full-value').text()).toBe(value)
    await display.trigger('keydown', { key: 'Enter' })
    expect(copy).toHaveBeenCalledWith(value)
    await wrapper.get('.copyable-text__copy').trigger('click')
    expect(copy).toHaveBeenCalledTimes(2)
  })

  it('provides an accessible full-value action beside links without duplicating the displayed value', () => {
    const wrapper = render('trace-123456789', true)
    expect(wrapper.find('.copyable-text__value').exists()).toBe(false)
    expect(wrapper.get('.copyable-text__inspect').attributes('aria-label')).toBe('查看完整内容')
    expect(wrapper.get('.copyable-text__full-value').text()).toBe('trace-123456789')
  })

  it('keeps a slotted button keyboard-compatible and copies when it is activated', async () => {
    const wrapper = render('queue-code', false, '<button type="button">Copy queue</button>')
    const button = wrapper.get('.copyable-text__value button')
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    button.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    await button.trigger('click')
    expect(copy).toHaveBeenCalledOnce()
    expect(copy).toHaveBeenCalledWith('queue-code')
  })

  it('does not copy when an embedded navigation link is activated', async () => {
    const wrapper = render('job-code', false, '<a href="#job">job-code</a>')
    await wrapper.setProps({ copyOnClick: false })
    await wrapper.get('a').trigger('click')
    expect(copy).not.toHaveBeenCalled()
    await wrapper.get('.copyable-text__copy').trigger('click')
    expect(copy).toHaveBeenCalledWith('job-code')
  })

  it('hides the eye when the displayed value already fits', async () => {
    const wrapper = render('short')
    const display = wrapper.get('.copyable-text__value').element as HTMLElement
    Object.defineProperty(display, 'clientWidth', { configurable: true, get: () => 160 })
    Object.defineProperty(display, 'scrollWidth', { configurable: true, get: () => 160 })
    await wrapper.setProps({ text: 'short!' })
    expect(wrapper.find('.copyable-text__inspect').exists()).toBe(false)
  })

  it('hides an icon-only eye when the text beside it already fits', async () => {
    const host = document.createElement('div')
    const label = document.createElement('a')
    label.textContent = 'JOB'
    document.body.appendChild(host)
    const wrapper = render('JOB', true)
    host.append(label, wrapper.element)
    Object.defineProperty(label, 'clientWidth', { configurable: true, get: () => 80 })
    Object.defineProperty(label, 'scrollWidth', { configurable: true, get: () => 80 })
    await wrapper.setProps({ text: 'JOB!' })
    expect(wrapper.find('.copyable-text__inspect').exists()).toBe(false)
    wrapper.unmount()
    host.remove()
  })

  it('keeps the eye when the displayed value is clipped', async () => {
    const wrapper = render('long')
    const display = wrapper.get('.copyable-text__value').element as HTMLElement
    Object.defineProperty(display, 'clientWidth', { configurable: true, get: () => 40 })
    Object.defineProperty(display, 'scrollWidth', { configurable: true, get: () => 200 })
    await wrapper.setProps({ text: 'long-value' })
    expect(wrapper.get('.copyable-text__inspect').attributes('aria-label')).toBe('查看完整内容')
  })

  it('does not expose an empty value as a keyboard or copy action', () => {
    const wrapper = render('')
    expect(wrapper.find('[role="button"]').exists()).toBe(false)
    expect(wrapper.find('.copyable-text__inspect').exists()).toBe(false)
    expect(wrapper.find('.copyable-text__copy').exists()).toBe(false)
  })

  it('shows an existing value on request without offering to copy in read-only mode', async () => {
    const wrapper = render('sensitive-reference')
    await wrapper.setProps({ copyable: false })
    expect(wrapper.get('.copyable-text__inspect').attributes('aria-label')).toBe('查看完整内容')
    expect(wrapper.get('.copyable-text__full-value').text()).toBe('sensitive-reference')
    expect(wrapper.find('.copyable-text__copy').exists()).toBe(false)
    expect(wrapper.find('[role="button"]').exists()).toBe(false)
    await wrapper.get('.copyable-text__value').trigger('click')
    expect(copy).not.toHaveBeenCalled()
  })

  it('closes the full-value popover with Escape from the trigger or its contents', async () => {
    const wrapper = render('long-value')
    const popover = wrapper.getComponent({ name: 'ElPopover' })
    await wrapper.get('.copyable-text__inspect').trigger('keydown', { key: 'Escape' })
    expect(hide).not.toHaveBeenCalled()
    popover.vm.$emit('before-enter')
    await wrapper.get('.copyable-text__inspect').trigger('keydown', { key: 'Escape' })
    popover.vm.$emit('before-enter')
    await wrapper.get('.copyable-text__details').trigger('keydown', { key: 'Escape' })
    expect(hide).toHaveBeenCalledTimes(2)
  })

  it('focuses readable popover content for keyboard users and closes when focus leaves', async () => {
    const wrapper = render('long-read-only-value')
    document.body.appendChild(wrapper.element)
    await wrapper.setProps({ copyable: false })
    const trigger = wrapper.get<HTMLButtonElement>('.copyable-text__inspect')
    trigger.element.focus()
    const popover = wrapper.getComponent({ name: 'ElPopover' })
    popover.vm.$emit('before-enter')
    popover.vm.$emit('after-enter')
    await wrapper.vm.$nextTick()
    const value = wrapper.get<HTMLElement>('.copyable-text__full-value')
    expect(document.activeElement).toBe(value.element)
    const nextButton = document.createElement('button')
    document.body.appendChild(nextButton)
    nextButton.focus()
    expect(hide).toHaveBeenCalledOnce()
    wrapper.unmount()
    nextButton.remove()
  })

  it('moves from a read-only preview to the next control and returns to its trigger on Shift+Tab', async () => {
    const host = document.createElement('div')
    const after = document.createElement('button')
    document.body.appendChild(host)
    const wrapper = render('full value')
    await wrapper.setProps({ copyable: false })
    host.append(wrapper.element, after)
    const trigger = wrapper.get<HTMLButtonElement>('.copyable-text__inspect')
    const value = wrapper.get<HTMLElement>('.copyable-text__full-value')
    const popover = wrapper.getComponent({ name: 'ElPopover' })
    trigger.element.focus()
    popover.vm.$emit('before-enter')
    popover.vm.$emit('after-enter')
    const nextEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    value.element.dispatchEvent(nextEvent)
    await wrapper.vm.$nextTick()
    expect(nextEvent.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(after)
    trigger.element.focus()
    popover.vm.$emit('after-enter')
    const previousEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    value.element.dispatchEvent(previousEvent)
    await wrapper.vm.$nextTick()
    expect(previousEvent.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
    host.remove()
  })

  it('returns to the trigger on Shift+Tab without scanning the page or modal', async () => {
    const modal = document.createElement('div')
    modal.className = 'el-overlay-dialog'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    document.body.appendChild(modal)
    const wrapper = render('full value')
    await wrapper.setProps({ copyable: false })
    modal.appendChild(wrapper.element)
    const trigger = wrapper.get<HTMLButtonElement>('.copyable-text__inspect')
    const value = wrapper.get<HTMLElement>('.copyable-text__full-value')
    trigger.element.focus()
    wrapper.getComponent({ name: 'ElPopover' }).vm.$emit('after-enter')
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    value.element.dispatchEvent(event)
    await wrapper.vm.$nextTick()
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(trigger.element)
    expect(scannedRoots).toHaveBeenCalledExactlyOnceWith(
      wrapper.get('.copyable-text__details').element,
    )
    wrapper.unmount()
    modal.remove()
  })

  it('wraps to the first control within a recognised modal and leaves unknown dialogs to their own focus manager', async () => {
    const modal = document.createElement('div')
    modal.className = 'el-overlay-dialog'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    const first = document.createElement('button')
    document.body.appendChild(modal)
    const wrapper = render('full value')
    await wrapper.setProps({ copyable: false })
    modal.append(first, wrapper.element)
    const trigger = wrapper.get<HTMLButtonElement>('.copyable-text__inspect')
    const value = wrapper.get<HTMLElement>('.copyable-text__full-value')
    const popover = wrapper.getComponent({ name: 'ElPopover' })
    trigger.element.focus()
    popover.vm.$emit('after-enter')
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    value.element.dispatchEvent(event)
    await wrapper.vm.$nextTick()
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
    modal.className = 'unknown-dialog'
    trigger.element.focus()
    popover.vm.$emit('after-enter')
    hide.mockClear()
    const unknownEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    value.element.dispatchEvent(unknownEvent)
    await wrapper.vm.$nextTick()
    expect(unknownEvent.defaultPrevented).toBe(false)
    expect(hide).not.toHaveBeenCalled()
    wrapper.unmount()
    modal.remove()
  })

  it('does not steal focus if another control receives it while the preview closes', async () => {
    const host = document.createElement('div')
    const after = document.createElement('button')
    const clicked = document.createElement('button')
    document.body.appendChild(host)
    const wrapper = render('full value')
    await wrapper.setProps({ copyable: false })
    host.append(wrapper.element, after, clicked)
    const trigger = wrapper.get<HTMLButtonElement>('.copyable-text__inspect')
    const value = wrapper.get<HTMLElement>('.copyable-text__full-value')
    const popover = wrapper.getComponent({ name: 'ElPopover' })
    trigger.element.focus()
    popover.vm.$emit('after-enter')
    hide.mockImplementationOnce(() => clicked.focus())
    value.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(clicked)
    wrapper.unmount()
    host.remove()
  })

  it('keeps Tab within a copyable preview before moving past its trigger', async () => {
    const host = document.createElement('div')
    const after = document.createElement('button')
    document.body.appendChild(host)
    const wrapper = render('copyable value')
    host.append(wrapper.element, after)
    const trigger = wrapper.get<HTMLButtonElement>('.copyable-text__inspect')
    const value = wrapper.get<HTMLElement>('.copyable-text__full-value')
    const copyButton = wrapper.get<HTMLButtonElement>('.copyable-text__copy')
    const popover = wrapper.getComponent({ name: 'ElPopover' })
    trigger.element.focus()
    popover.vm.$emit('after-enter')
    const internalTab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    value.element.dispatchEvent(internalTab)
    expect(internalTab.defaultPrevented).toBe(false)
    expect(hide).not.toHaveBeenCalled()
    copyButton.element.focus()
    const exitTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    copyButton.element.dispatchEvent(exitTab)
    await wrapper.vm.$nextTick()
    expect(exitTab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(after)
    wrapper.unmount()
    host.remove()
  })

  it('leaves the page-end and nested-popover focus behavior to Element Plus', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = render('full value')
    await wrapper.setProps({ copyable: false })
    host.append(wrapper.element)
    const trigger = wrapper.get<HTMLButtonElement>('.copyable-text__inspect')
    const value = wrapper.get<HTMLElement>('.copyable-text__full-value')
    const popover = wrapper.getComponent({ name: 'ElPopover' })
    trigger.element.focus()
    popover.vm.$emit('after-enter')
    const pageEnd = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    value.element.dispatchEvent(pageEnd)
    expect(pageEnd.defaultPrevented).toBe(false)
    expect(hide).not.toHaveBeenCalled()
    host.className = 'el-popper'
    host.appendChild(document.createElement('button'))
    const nested = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    value.element.dispatchEvent(nested)
    expect(nested.defaultPrevented).toBe(false)
    expect(hide).not.toHaveBeenCalled()
    wrapper.unmount()
    host.remove()
  })

  it('returns to the only focusable control in a recognised modal', async () => {
    const modal = document.createElement('div')
    modal.className = 'el-overlay-dialog'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    document.body.appendChild(modal)
    const wrapper = render('full value')
    await wrapper.setProps({ copyable: false })
    modal.appendChild(wrapper.element)
    const trigger = wrapper.get<HTMLButtonElement>('.copyable-text__inspect')
    const value = wrapper.get<HTMLElement>('.copyable-text__full-value')
    const popover = wrapper.getComponent({ name: 'ElPopover' })
    trigger.element.focus()
    popover.vm.$emit('after-enter')
    value.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
    modal.remove()
  })

  it('leaves focus management alone when the next control is in an unknown dialog', async () => {
    const host = document.createElement('div')
    const unknown = document.createElement('div')
    unknown.setAttribute('role', 'dialog')
    unknown.appendChild(document.createElement('button'))
    document.body.appendChild(host)
    const wrapper = render('full value')
    await wrapper.setProps({ copyable: false })
    host.append(wrapper.element, unknown)
    const trigger = wrapper.get<HTMLButtonElement>('.copyable-text__inspect')
    const value = wrapper.get<HTMLElement>('.copyable-text__full-value')
    const popover = wrapper.getComponent({ name: 'ElPopover' })
    trigger.element.focus()
    popover.vm.$emit('after-enter')
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    value.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(hide).not.toHaveBeenCalled()
    wrapper.unmount()
    host.remove()
  })

  it('does not focus a target removed while the preview closes', async () => {
    const host = document.createElement('div')
    const after = document.createElement('button')
    document.body.appendChild(host)
    const wrapper = render('full value')
    await wrapper.setProps({ copyable: false })
    host.append(wrapper.element, after)
    const trigger = wrapper.get<HTMLButtonElement>('.copyable-text__inspect')
    const value = wrapper.get<HTMLElement>('.copyable-text__full-value')
    const popover = wrapper.getComponent({ name: 'ElPopover' })
    trigger.element.focus()
    popover.vm.$emit('after-enter')
    hide.mockImplementationOnce(() => after.remove())
    value.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    await wrapper.vm.$nextTick()
    expect(document.activeElement).not.toBe(after)
    wrapper.unmount()
    host.remove()
  })

  it('does not focus a target disabled or moved into another dialog while closing', async () => {
    const host = document.createElement('div')
    const after = document.createElement('button')
    const unknown = document.createElement('div')
    unknown.setAttribute('role', 'dialog')
    document.body.appendChild(host)
    const wrapper = render('full value')
    await wrapper.setProps({ copyable: false })
    host.append(wrapper.element, after, unknown)
    const trigger = wrapper.get<HTMLButtonElement>('.copyable-text__inspect')
    const value = wrapper.get<HTMLElement>('.copyable-text__full-value')
    const popover = wrapper.getComponent({ name: 'ElPopover' })
    trigger.element.focus()
    popover.vm.$emit('after-enter')
    hide.mockImplementationOnce(() => {
      after.disabled = true
    })
    value.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    await wrapper.vm.$nextTick()
    expect(document.activeElement).not.toBe(after)
    after.disabled = false
    trigger.element.focus()
    popover.vm.$emit('after-enter')
    hide.mockImplementationOnce(() => unknown.appendChild(after))
    value.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    await wrapper.vm.$nextTick()
    expect(document.activeElement).not.toBe(after)
    wrapper.unmount()
    host.remove()
  })

  it('does not move focus after its trigger is unmounted while closing', async () => {
    const host = document.createElement('div')
    const after = document.createElement('button')
    document.body.appendChild(host)
    const wrapper = render('full value')
    await wrapper.setProps({ copyable: false })
    host.append(wrapper.element, after)
    const trigger = wrapper.get<HTMLButtonElement>('.copyable-text__inspect')
    const value = wrapper.get<HTMLElement>('.copyable-text__full-value')
    const popover = wrapper.getComponent({ name: 'ElPopover' })
    trigger.element.focus()
    popover.vm.$emit('after-enter')
    hide.mockImplementationOnce(() => wrapper.unmount())
    value.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    await wrapper.vm.$nextTick()
    expect(document.activeElement).not.toBe(after)
    host.remove()
  })
})
