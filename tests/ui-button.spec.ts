import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PPButton from '~/components/ui/PPButton.vue'

describe('pPButton public primitive', () => {
  it('renders contract weight and size', () => {
    const wrapper = mount(PPButton, {
      props: { weight: 'dangerous', size: 'md' },
      slots: { default: '删除' },
    })
    expect(wrapper.text()).toBe('删除')
    const classes = wrapper.attributes('class') ?? ''
    expect(classes).toContain('bg-danger')
    expect(classes).toContain('h-9')
  })

  it('forwards type and disabled state', () => {
    const wrapper = mount(PPButton, {
      props: { type: 'submit', disabled: true },
      slots: { default: 'go' },
    })
    const el = wrapper.element as HTMLButtonElement
    expect(el.type).toBe('submit')
    expect(el.disabled).toBe(true)
  })

  it('emits click', async () => {
    const wrapper = mount(PPButton, { slots: { default: 'go' } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })
})
