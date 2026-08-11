import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UButton from '~/components/ui/UButton.vue'

describe('uButton (local HeroUI wrapper)', () => {
  it('renders slot content with HeroUI variant classes', () => {
    const wrapper = mount(UButton, {
      props: { variant: 'primary', size: 'md' },
      slots: { default: '登录' },
    })
    expect(wrapper.text()).toBe('登录')
    const classes = wrapper.attributes('class') ?? ''
    expect(classes).toContain('button')
    expect(classes).toContain('button--primary')
    expect(classes).toContain('button--md')
  })

  it('forwards type and disabled state', () => {
    const wrapper = mount(UButton, {
      props: { type: 'submit', disabled: true },
      slots: { default: 'go' },
    })
    const el = wrapper.element as HTMLButtonElement
    expect(el.type).toBe('submit')
    expect(el.disabled).toBe(true)
  })

  it('emits click', async () => {
    const wrapper = mount(UButton, { slots: { default: 'go' } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })
})
