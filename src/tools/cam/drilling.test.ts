import { describe, expect, it } from 'vitest'
import { defaultDesign } from '../../lib/design'
import { defaultCamSettings, generateDrillingNc } from './drilling'
import { generateAssemblyStep } from '../cad/step'

describe('manufacturing exports', () => {
  it('creates a metric drilling cycle for both pull handle centres', () => {
    const nc = generateDrillingNc(defaultDesign, defaultCamSettings)
    expect(nc).toContain('G21 G17 G90')
    expect(nc).toContain('X-150.000')
    expect(nc).toContain('X150.000')
    expect(nc).toContain('G81 Z-50')
    expect(nc).toContain('M30')
  })
  it('uses one spindle drilling point for a lever', () => {
    const nc = generateDrillingNc({ ...defaultDesign, type: 'lever' }, defaultCamSettings)
    expect(nc.match(/G98 G81/g)).toHaveLength(1)
  })
  it('creates STEP reference geometry with a square spindle', () => {
    const step = generateAssemblyStep(defaultDesign)
    expect(step).toContain('ISO-10303-21')
    expect(step).toContain('SQUARE_SPINDLE')
    expect(step).toContain('END-ISO-10303-21')
  })
})
