export type HandleType = 'pull' | 'lever'
export type FinishId = 'graphite' | 'steel' | 'bronze' | 'black'
export type ProfileId = 'round' | 'square' | 'soft'

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
}

export const finishes: { id: FinishId; name: string; color: string; metalness: number; roughness: number }[] = [
  { id: 'graphite', name: 'Graphite', color: '#555957', metalness: 0.85, roughness: 0.32 },
  { id: 'steel', name: 'Brushed steel', color: '#b9bdba', metalness: 0.95, roughness: 0.27 },
  { id: 'bronze', name: 'Dark bronze', color: '#75604b', metalness: 0.9, roughness: 0.34 },
  { id: 'black', name: 'Matt black', color: '#252827', metalness: 0.45, roughness: 0.58 },
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
