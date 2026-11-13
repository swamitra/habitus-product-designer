export type HandleType = 'pull' | 'lever'
export type FinishId = 'graphite' | 'steel' | 'bronze' | 'black' | 'gold' | 'marble' | 'oak'
export type ProfileId = 'round' | 'square' | 'soft'
export type ProductType = 'handle' | 'door'
export type HandleShape = 'straight' | 'half-circle'
export type Ornament = 'none' | 'bird'

export interface HandleDesign {
  name: string
  type: HandleType
  finish: FinishId
  profile: ProfileId
  length: number
  projection: number
  diameter: number
  roseDiameter: number
  returnAngle: number
  productType?: ProductType
  shape?: HandleShape
  ornament?: Ornament
  width?: number
  height?: number
  thickness?: number
  cornerRadius?: number
}

export const finishes: { id: FinishId; name: string; color: string; metalness: number; roughness: number }[] = [
  { id: 'graphite', name: 'Graphite', color: '#555957', metalness: 0.85, roughness: 0.32 },
  { id: 'steel', name: 'Brushed steel', color: '#b9bdba', metalness: 0.95, roughness: 0.27 },
  { id: 'bronze', name: 'Dark bronze', color: '#75604b', metalness: 0.9, roughness: 0.34 },
  { id: 'black', name: 'Matt black', color: '#252827', metalness: 0.45, roughness: 0.58 },
  { id: 'gold', name: 'Brushed gold', color: '#b99b52', metalness: 0.88, roughness: 0.3 },
  { id: 'marble', name: 'White marble', color: '#d9d9d2', metalness: 0.02, roughness: 0.38 },
  { id: 'oak', name: 'Natural oak', color: '#a88458', metalness: 0, roughness: 0.65 },
]

export const defaultDesign: HandleDesign = {
  name: 'Linear 01', type: 'pull', finish: 'graphite', profile: 'round',
  length: 300, projection: 55, diameter: 19, roseDiameter: 38, returnAngle: 90,
}

export const presets: { name: string; description: string; design: HandleDesign }[] = [
  { name: 'Linear 01', description: 'Pull handle / 300 mm', design: defaultDesign },
  { name: 'Arc 02', description: 'Lever handle / 130 mm', design: { ...defaultDesign, name: 'Arc 02', type: 'lever', length: 130, projection: 52, diameter: 19, roseDiameter: 52, returnAngle: 12 } },
  { name: 'Frame 03', description: 'Pull handle / 450 mm', design: { ...defaultDesign, name: 'Frame 03', profile: 'soft', length: 450, projection: 65, diameter: 25, roseDiameter: 45 } },
]

export function validateDesign(design: HandleDesign) {
  if (design.productType === 'door') {
    if (!design.width || design.width < 500 || design.width > 1600) return 'Door width must be between 500 and 1600 mm.'
    if (!design.height || design.height < 1800 || design.height > 3000) return 'Door height must be between 1800 and 3000 mm.'
    return null
  }
  const limits = design.type === 'pull'
    ? { length: [150, 1200], projection: [35, 100], diameter: [12, 40], roseDiameter: [25, 80] }
    : { length: [90, 180], projection: [40, 75], diameter: [12, 30], roseDiameter: [40, 70] }
  for (const [key, [min, max]] of Object.entries(limits)) {
    const value = design[key as keyof typeof limits]
    if (value < min || value > max) return `${key} must be between ${min} and ${max} mm.`
  }
  if (design.roseDiameter < design.diameter) return 'Rose diameter must be greater than the bar diameter.'
  return null
}

export function downloadJson(design: HandleDesign) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${design.name.toLowerCase().replaceAll(' ', '-')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
