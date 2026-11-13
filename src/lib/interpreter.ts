import { defaultDesign } from './design'
import type { HandleDesign } from './design'

type ProductType = NonNullable<HandleDesign['productType']>
type Finish = HandleDesign['finish']
type WorkingDesign = HandleDesign

export interface InterpretationResult {
  design: HandleDesign
  summary: string[]
  assumptions: string[]
}

type DimensionField =
  | 'length'
  | 'projection'
  | 'diameter'
  | 'roseDiameter'
  | 'width'
  | 'height'
  | 'thickness'
  | 'cornerRadius'

interface DimensionChange {
  field: DimensionField
  value: number
}

const dimensionLabels: Record<DimensionField, string> = {
  length: 'length',
  projection: 'projection',
  diameter: 'bar diameter',
  roseDiameter: 'rose diameter',
  width: 'width',
  height: 'height',
  thickness: 'thickness',
  cornerRadius: 'corner radius',
}

function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function initialDesign(current?: HandleDesign): WorkingDesign {
  const design = { ...defaultDesign, ...current } as WorkingDesign
  return {
    ...design,
    productType: design.productType ?? 'handle',
    shape: design.shape ?? 'straight',
    ornament: design.ornament ?? 'none',
  }
}

function finishName(finish: Finish): string {
  return finish.charAt(0).toUpperCase() + finish.slice(1)
}

function designName(design: WorkingDesign): string {
  if (design.productType === 'door') {
    const profile = design.profile === 'soft' ? 'Rounded' : design.profile === 'square' ? 'Square' : ''
    return [profile, finishName(design.finish), 'Door'].filter(Boolean).join(' ')
  }

  const shape = design.shape === 'half-circle' ? 'Half Circle' : ''
  const type = design.type === 'lever' ? 'Lever' : 'Pull'
  return [shape, finishName(design.finish), type].filter(Boolean).join(' ')
}

function productDescription(design: WorkingDesign): string {
  if (design.productType === 'door') {
    const profile = design.profile === 'soft' ? 'rounded ' : design.profile === 'square' ? 'square ' : ''
    return `${profile}${design.finish} door`
  }

  const shape = design.shape === 'half-circle' ? 'half-circle ' : ''
  return `${shape}${design.finish} ${design.type} handle`
}

function toMillimetres(value: number, unit: string): number {
  const factor = unit === 'm' || unit.startsWith('meter') || unit.startsWith('metre')
    ? 1000
    : unit === 'cm' || unit.startsWith('centimeter') || unit.startsWith('centimetre')
      ? 10
      : 1
  return Math.round(value * factor * 1000) / 1000
}

function readDimensions(text: string, design: WorkingDesign) {
  const changes: DimensionChange[] = []
  const generic: DimensionChange[] = []
  let diameterAsLength = false
  const pattern = /(\d+(?:\.\d+)?|\.\d+)\s*(millimeters?|millimetres?|mm|centimeters?|centimetres?|cm|meters?|metres?|m)\b/g

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    const before = text.slice(Math.max(0, index - 36), index)
    const after = text.slice(index + match[0].length, index + match[0].length + 28)
    const value = toMillimetres(Number(match[1]), match[2])
    const beforeLabel = before.match(/([a-z]+(?:\s+[a-z]+)?)\s*$/)?.[1] ?? ''
    const afterLabel = after.match(/^\s*(?:in\s+)?([a-z]+(?:\s+[a-z]+)?)/)?.[1] ?? ''
    const label = `${beforeLabel} ${afterLabel}`
    let field: DimensionField | undefined

    if (/\b(?:corner\s*radius|corner|radius)\b/.test(label)) {
      field = 'cornerRadius'
    } else if (/\brose\b/.test(label) && /\b(?:diameter|dia\.?)\b/.test(label)) {
      field = 'roseDiameter'
    } else if (/\b(?:thickness|thick|depth)\b/.test(label)) {
      field = 'thickness'
    } else if (/\b(?:width|wide)\b/.test(label)) {
      field = design.productType === 'door' ? 'width' : 'length'
    } else if (/\b(?:height|high|tall)\b/.test(label)) {
      field = design.productType === 'door' ? 'height' : 'length'
    } else if (/\b(?:projection|projecting|standoff)\b/.test(label)) {
      field = 'projection'
    } else if (/\b(?:length|long)\b/.test(label)) {
      field = 'length'
    } else if (/\b(?:diameter|dia\.?)\b/.test(label)) {
      if (/\b(?:bar|tube|rod)\b/.test(label)) {
        field = 'diameter'
      } else if (design.productType === 'handle' && design.shape === 'half-circle') {
        field = 'length'
        diameterAsLength = true
      } else {
        field = 'diameter'
      }
    } else if (/\bacross\b/.test(label)) {
      field = design.productType === 'door' ? 'width' : 'length'
    }

    const change = { field: field ?? (design.productType === 'door' ? 'width' : 'length'), value }
    if (field) changes.push(change)
    else generic.push(change)
  }

  if (design.productType === 'door' && generic.length > 1) {
    const fields: DimensionField[] = ['width', 'height', 'thickness']
    generic.forEach((change, index) => {
      changes.push({ field: fields[index] ?? 'thickness', value: change.value })
    })
  } else {
    changes.push(...generic)
  }

  return { changes, diameterAsLength }
}

/**
 * Interpret a small, deterministic product-design vocabulary without network access.
 * All parsed dimensions are stored in millimetres.
 */
export function interpretPrompt(prompt: string, current?: HandleDesign): InterpretationResult {
  const text = normalizePrompt(prompt)
  const design = initialDesign(current)
  const summary: string[] = []
  const assumptions: string[] = []
  const originalProduct = design.productType

  const mentionsHandle = /\b(?:door\s+)?handles?\b/.test(text)
  const mentionsDoor = /\bdoor\b/.test(text) && !mentionsHandle && !/\bdoor\s+(?:pull|lever)\b/.test(text)
  const mentionsType = /\b(?:lever|pull)\b/.test(text)
  const requestedProduct: ProductType | undefined = mentionsHandle || mentionsType
    ? 'handle'
    : mentionsDoor
      ? 'door'
      : undefined
  const productChanged = requestedProduct !== undefined && requestedProduct !== originalProduct

  if (requestedProduct) design.productType = requestedProduct

  if (/\blever\b/.test(text)) design.type = 'lever'
  else if (/\bpull\b/.test(text)) design.type = 'pull'

  const halfCircle = /\bhalf[\s-]*(?:circle|round)\b|\bsemi[\s-]*circle\b/.test(text)
  const fullCircle = !halfCircle && /\b(?:circle|circular)\b/.test(text)
  const straight = /\bstraight\b/.test(text)
  if (halfCircle || fullCircle) design.shape = 'half-circle'
  else if (straight) design.shape = 'straight'
  if (fullCircle) assumptions.push('Interpreted the circular request as the available half-circle shape.')

  const rounded = /\b(?:rounded|soft|round[\s-]*corners?)\b/.test(text)
  const square = /\b(?:square|squared|angular)\b/.test(text)
  if (rounded) design.profile = 'soft'
  else if (square) design.profile = 'square'
  else if (/\bround\b/.test(text) && !halfCircle && !fullCircle) design.profile = 'round'

  const finishMatch = text.match(/\b(graphite|steel|bronze|black|marble|oak|gold|golf)\b/)
  if (finishMatch) {
    design.finish = finishMatch[1] === 'golf' ? 'gold' : finishMatch[1] as Finish
    if (finishMatch[1] === 'golf') assumptions.push('Interpreted "golf" as "gold".')
  }

  const noOrnament = /\b(?:none|plain)\b|\bno\s+(?:ornament|bird)\b|\bwithout\s+(?:an?\s+)?(?:ornament|bird)\b/.test(text)
  if (noOrnament) design.ornament = 'none'
  else if (/\bbird\b/.test(text)) design.ornament = 'bird'

  if (design.productType === 'door') {
    if (!current || productChanged) {
      design.width = 900
      design.height = 2100
      design.thickness = 40
    } else {
      design.width ??= 900
      design.height ??= 2100
      design.thickness ??= 40
    }

    if (rounded) design.cornerRadius = 120
    else if (square) design.cornerRadius = 0
    else design.cornerRadius ??= design.profile === 'soft' ? 120 : 0
  }

  const { changes, diameterAsLength } = readDimensions(text, design)
  for (const change of changes) design[change.field] = change.value
  if (diameterAsLength) {
    assumptions.push('Interpreted the diameter as the overall length of the half-circle handle.')
  }

  const hasProductNoun = mentionsHandle || mentionsDoor
  const createsProduct = (!current && hasProductNoun) || productChanged
  const hasDescriptor = Boolean(
    requestedProduct || mentionsType || halfCircle || fullCircle || straight || rounded || square ||
    finishMatch || noOrnament || /\bbird\b/.test(text) || changes.length,
  )

  if ((!current && hasDescriptor) || productChanged) design.name = designName(design)

  if (createsProduct) {
    summary.push(`${productChanged ? 'Changed the design to' : 'Created'} a ${productDescription(design)}.`)
    if (design.productType === 'door') {
      summary.push(`Set width to ${design.width} mm, height to ${design.height} mm, and thickness to ${design.thickness} mm.`)
      summary.push(`Set corner radius to ${design.cornerRadius} mm.`)
    }
  } else {
    if (mentionsType) summary.push(`Changed to a ${design.type} handle.`)
    if (halfCircle) summary.push('Set the shape to half-circle.')
    else if (fullCircle) summary.push('Set the shape to half-circle for the circular request.')
    else if (straight) summary.push('Set the shape to straight.')
    if (rounded) summary.push('Used a soft, rounded profile.')
    else if (square) summary.push('Used a square profile.')
  }

  if (finishMatch && !createsProduct) summary.push(`Set the finish to ${design.finish}.`)
  if ((noOrnament || /\bbird\b/.test(text)) && !createsProduct) {
    summary.push(design.ornament === 'bird' ? 'Added a bird ornament.' : 'Removed the ornament.')
  }

  if (!createsProduct || design.productType === 'handle') {
    for (const change of changes) {
      summary.push(`Set ${dimensionLabels[change.field]} to ${change.value} mm.`)
    }
  }

  if (createsProduct && design.productType === 'door') {
    const explicitFields = new Set(changes.map(change => change.field))
    const defaultDimensions = (['width', 'height', 'thickness'] as const)
      .filter(field => !explicitFields.has(field))
      .map(field => `${dimensionLabels[field]} ${design[field]} mm`)
    if (defaultDimensions.length) {
      assumptions.push(`Used standard values for unspecified door dimensions: ${defaultDimensions.join(', ')}.`)
    }
    if (!explicitFields.has('cornerRadius') && rounded) {
      assumptions.push('Used a 120 mm corner radius for the rounded door.')
    }
  }

  if (!summary.length) summary.push('No design changes were made.')

  return {
    design,
    summary,
    assumptions,
  }
}
