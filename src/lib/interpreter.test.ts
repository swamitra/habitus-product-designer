import { describe, expect, it } from 'vitest'
import { defaultDesign } from './design'
import type { HandleDesign } from './design'
import { interpretPrompt } from './interpreter'

function extended(design: HandleDesign): HandleDesign {
  return design
}

describe('interpretPrompt', () => {
  it('interprets the rounded marble door example', () => {
    const result = interpretPrompt('i want a rounded marble door')
    const design = extended(result.design)

    expect(design).toMatchObject({
      productType: 'door',
      finish: 'marble',
      profile: 'soft',
      width: 900,
      height: 2100,
      thickness: 40,
      cornerRadius: 120,
    })
    expect(design.name).toMatch(/door/i)
    expect(design.name).toMatch(/marble/i)
    expect(result.summary.join(' ')).not.toContain('—')
    expect(result.assumptions.join(' ')).toContain('standard values')
  })

  it('interprets the half-circle handle example and the golf typo', () => {
    const result = interpretPrompt('i want a door handle half circle in 60cm diameter in golf finish with bird outlook')
    const design = extended(result.design)

    expect(design).toMatchObject({
      productType: 'handle',
      type: 'pull',
      shape: 'half-circle',
      length: 600,
      finish: 'gold',
      ornament: 'bird',
    })
    expect(result.assumptions).toContain('Interpreted "golf" as "gold".')
    expect(result.assumptions.join(' ')).toContain('diameter')
    expect(result.summary.join(' ')).not.toContain('—')
  })

  it.each([
    ['60 cm', 600],
    ['600 mm', 600],
    ['0.6 m', 600],
    ['60 centimeters', 600],
    ['600 millimetres', 600],
    ['0.6 metres', 600],
  ])('converts %s to millimetres', (prompt, length) => {
    expect(interpretPrompt(`make it ${prompt}`, defaultDesign).design.length).toBe(length)
  })

  it('supports decimal and fractional-looking unit spacing', () => {
    expect(interpretPrompt('make it 80 cm', defaultDesign).design.length).toBe(800)
    expect(interpretPrompt('make it 1.2 m', defaultDesign).design.length).toBe(1200)
    expect(interpretPrompt('make it 19.5 mm', defaultDesign).design.length).toBe(19.5)
  })

  it('changes only the requested finish on a follow-up', () => {
    const current = extended(interpretPrompt('i want a door handle half circle in 60cm diameter in golf finish with bird outlook').design)
    const result = interpretPrompt('make it gold', current)
    const design = extended(result.design)

    expect(design.finish).toBe('gold')
    expect(design.length).toBe(600)
    expect(design.shape).toBe('half-circle')
    expect(design.ornament).toBe('bird')
    expect(result.summary).toEqual(['Set the finish to gold.'])
  })

  it('changes only length on a dimension follow-up', () => {
    const current = { ...defaultDesign, finish: 'bronze' as const, projection: 70 }
    const result = interpretPrompt('make it 80 cm', current)

    expect(result.design.length).toBe(800)
    expect(result.design.finish).toBe('bronze')
    expect(result.design.projection).toBe(70)
    expect(result.summary).toEqual(['Set length to 800 mm.'])
  })

  it('supports lever and pull handle types', () => {
    expect(interpretPrompt('make it a lever', defaultDesign).design.type).toBe('lever')
    expect(interpretPrompt('make it a pull', { ...defaultDesign, type: 'lever' }).design.type).toBe('pull')
  })

  it('supports straight, half-circle, and circle requests', () => {
    expect(extended(interpretPrompt('make it straight', defaultDesign).design).shape).toBe('straight')
    expect(extended(interpretPrompt('make it half circle', defaultDesign).design).shape).toBe('half-circle')
    const circle = interpretPrompt('make it a circle', defaultDesign)
    expect(extended(circle.design).shape).toBe('half-circle')
    expect(circle.assumptions.join(' ')).toContain('half-circle')
  })

  it.each(['gold', 'steel', 'graphite', 'bronze', 'black', 'marble', 'oak'])('supports the %s finish', finish => {
    expect(interpretPrompt(`make it ${finish}`, defaultDesign).design.finish).toBe(finish)
  })

  it('supports bird and none ornament requests', () => {
    expect(extended(interpretPrompt('add a bird', defaultDesign).design).ornament).toBe('bird')
    expect(extended(interpretPrompt('no bird', extended(interpretPrompt('add a bird', defaultDesign).design)).design).ornament).toBe('none')
    expect(extended(interpretPrompt('make it plain', defaultDesign).design).ornament).toBe('none')
  })

  it('supports rounded and square profiles', () => {
    expect(interpretPrompt('make it rounded', defaultDesign).design.profile).toBe('soft')
    expect(interpretPrompt('make it square', defaultDesign).design.profile).toBe('square')
  })

  it('parses named handle dimensions independently', () => {
    const result = interpretPrompt('set projection to 70 mm and bar diameter to 25 mm', defaultDesign)
    expect(result.design.projection).toBe(70)
    expect(result.design.diameter).toBe(25)
    expect(result.design.length).toBe(defaultDesign.length)
  })

  it('parses door dimensions and preserves them on follow-ups', () => {
    const first = extended(interpretPrompt('i want a door 80 cm wide, 2 m high, 45 mm thick', defaultDesign).design)
    expect(first).toMatchObject({ productType: 'door', width: 800, height: 2000, thickness: 45 })

    const second = extended(interpretPrompt('make it oak', first).design)
    expect(second).toMatchObject({ finish: 'oak', width: 800, height: 2000, thickness: 45 })
  })

  it('does not mutate the current design', () => {
    const current = { ...defaultDesign }
    interpretPrompt('make it black and 80 cm', current)
    expect(current).toEqual(defaultDesign)
  })

  it('is deterministic and reports no changes for an unrelated prompt', () => {
    const first = interpretPrompt('make it gold', defaultDesign)
    const second = interpretPrompt('make it gold', defaultDesign)
    expect(first).toEqual(second)

    const unchanged = interpretPrompt('hello there', defaultDesign)
    expect(unchanged.design).toMatchObject(defaultDesign)
    expect(unchanged.summary).toEqual(['No design changes were made.'])
  })
})
