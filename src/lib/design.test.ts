import { describe, expect, it } from 'vitest'
import { defaultDesign, validateDesign } from './design'
import { createHandleGroup } from './geometry'

describe('handle design', () => {
  it('accepts the default pull handle', () => expect(validateDesign(defaultDesign)).toBeNull())
  it('rejects dimensions outside the manufacturing range', () => expect(validateDesign({ ...defaultDesign, length: 10 })).toContain('length'))
  it('rejects a rose smaller than the bar', () => expect(validateDesign({ ...defaultDesign, roseDiameter: 25, diameter: 30 })).toContain('Rose'))
  it('creates a pull handle with two roses and three bar segments', () => {
    const model = createHandleGroup(defaultDesign)
    expect(model.children.map((part) => part.name)).toContain('Exterior handle')
    expect(model.children.map((part) => part.name)).toContain('Interior handle')
    expect(model.children.map((part) => part.name)).toContain('M6 back-to-back fixing 1')
    expect(model.children.map((part) => part.name)).toContain('M6 back-to-back fixing 2')
    expect(model.children.map((part) => part.name)).not.toContain('8 mm square spindle')
    expect(model.name).toBe('Linear 01')
  })
  it('creates a lever handle with one rose', () => {
    const model = createHandleGroup({ ...defaultDesign, type: 'lever', length: 130, roseDiameter: 52 })
    expect(model.children.map((part) => part.name)).toContain('Interior handle')
    expect(model.children.map((part) => part.name)).toContain('8 mm square spindle')
    expect(model.children.map((part) => part.name)).toContain('Keyhole detail')
  })
})
