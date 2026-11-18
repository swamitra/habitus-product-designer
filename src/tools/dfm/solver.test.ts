import { describe, expect, it } from 'vitest'
import { defaultDesign } from '../../lib/design'
import { evaluateDfm } from './solver'
import { canonicalSpecification } from '../specification/canonical'
import { decodeDesign, encodeDesign } from '../specification/share'

describe('engineering pipeline', () => {
  it('passes the default handle grip clearance', () => expect(evaluateDfm(defaultDesign).status).toBe('passed'))
  it('blocks inadequate knuckle clearance with an actionable correction', () => {
    const report = evaluateDfm({ ...defaultDesign, projection: 40 })
    expect(report.status).toBe('blocked')
    expect(report.findings[0].action).toContain('57')
  })
  it('blocks insufficient spindle engagement', () => expect(evaluateDfm({ ...defaultDesign, spindleLength: 50 }).status).toBe('blocked'))
  it('requires backing for thin marble', () => expect(evaluateDfm({ ...defaultDesign, productType: 'door', finish: 'marble', thickness: 8 }).status).toBe('blocked'))
  it('uses one canonical specification for DFM and manufacturing', () => {
    const spec = canonicalSpecification(defaultDesign)
    expect(spec.global_dimensions_mm.knuckle_clearance).toBe(41)
    expect(spec.door_interface?.drilling_spec.timber_flush_hole_dia_mm).toBe(10)
  })
  it('round-trips a shareable design URL payload', () => expect(decodeDesign(encodeDesign(defaultDesign))).toEqual(defaultDesign))
})
