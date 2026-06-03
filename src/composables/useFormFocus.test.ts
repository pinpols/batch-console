// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { effectScope, ref, nextTick } from 'vue'
import { useFormFocus } from './useFormFocus'

function makeFormStub(html: string) {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return { $el: root }
}

describe('useFormFocus', () => {
  it('focusFirst:聚焦第一个可编辑 input', async () => {
    const scope = effectScope()
    await scope.run(async () => {
      const formRef = ref<unknown>(
        makeFormStub(`
          <div class="el-form">
            <input type="hidden" />
            <input id="first" />
            <input id="second" />
          </div>
        `),
      )
      const { focusFirst } = useFormFocus(formRef as never)
      focusFirst()
      expect(document.activeElement?.id).toBe('first')
    })
    scope.stop()
  })

  it('focusFirstError:聚焦第一个 .el-form-item.is-error 内的 input', async () => {
    const scope = effectScope()
    await scope.run(async () => {
      const formRef = ref<unknown>(
        makeFormStub(`
          <div class="el-form">
            <div class="el-form-item">
              <input id="ok" />
            </div>
            <div class="el-form-item is-error">
              <input id="bad" />
            </div>
          </div>
        `),
      )
      const { focusFirstError } = useFormFocus(formRef as never)
      focusFirstError()
      expect(document.activeElement?.id).toBe('bad')
    })
    scope.stop()
  })

  it('focusFirst:跳过 disabled / readonly', async () => {
    const scope = effectScope()
    await scope.run(async () => {
      const formRef = ref<unknown>(
        makeFormStub(`
          <div class="el-form">
            <input id="a" disabled />
            <input id="b" readonly />
            <input id="c" />
          </div>
        `),
      )
      const { focusFirst } = useFormFocus(formRef as never)
      focusFirst()
      expect(document.activeElement?.id).toBe('c')
    })
    scope.stop()
  })
})
