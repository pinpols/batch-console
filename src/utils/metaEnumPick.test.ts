import { describe, it, expect } from 'vitest'
import { pickMetaEnumGroup } from './metaEnumPick'

describe('pickMetaEnumGroup', () => {
  const enums = {
    triggerType: [
      { label: 'Cron', value: 'CRON' },
      { label: 'Event', value: 'EVENT' },
    ],
    instanceStatus: [{ label: 'Running', value: 'RUNNING' }],
    emptyGroup: [],
  }

  it('returns first matching non-empty group', () => {
    expect(pickMetaEnumGroup(enums, 'triggerType')).toEqual(enums.triggerType)
  })

  it('skips missing keys and returns first hit', () => {
    expect(pickMetaEnumGroup(enums, 'noSuchKey', 'instanceStatus')).toEqual(enums.instanceStatus)
  })

  it('skips empty arrays', () => {
    expect(pickMetaEnumGroup(enums, 'emptyGroup', 'triggerType')).toEqual(enums.triggerType)
  })

  it('returns [] when no key matches', () => {
    expect(pickMetaEnumGroup(enums, 'a', 'b', 'c')).toEqual([])
  })

  it('returns [] for undefined input', () => {
    expect(pickMetaEnumGroup(undefined)).toEqual([])
  })

  it('returns [] for null input', () => {
    expect(pickMetaEnumGroup(null)).toEqual([])
  })

  it('returns [] when called with no keys', () => {
    expect(pickMetaEnumGroup(enums)).toEqual([])
  })
})
