import type { HandleDesign } from '../../lib/design'

export interface CamSettings {
  safeZ: number
  cutZ: number
  feedRate: number
  spindleSpeed: number
  toolNumber: number
}

export const defaultCamSettings: CamSettings = { safeZ: 5, cutZ: -50, feedRate: 180, spindleSpeed: 6000, toolNumber: 1 }

export function generateDrillingNc(design: HandleDesign, settings: CamSettings) {
  const thickness = design.doorThickness ?? 44
  const points = design.type === 'pull'
    ? [[-design.length / 2, 0], [design.length / 2, 0]]
    : [[0, 0]]
  const lines = [
    '%', '(APERTURE - DRILLING CONCEPT ONLY)', '(VERIFY MACHINE, POST, MATERIAL, TOOL AND WORK OFFSET)',
    `(DOOR THICKNESS ${thickness} MM)`, '(METRIC / ABSOLUTE / DRILL CANNED CYCLE)',
    'G21 G17 G90 G94', `T${settings.toolNumber} M6`, `S${settings.spindleSpeed} M3`, 'G54', `G0 Z${settings.safeZ}`,
  ]
  for (const [x, y] of points) {
    lines.push(`G0 X${x.toFixed(3)} Y${y.toFixed(3)}`)
    lines.push(`G98 G81 Z${settings.cutZ} R${settings.safeZ} F${settings.feedRate}`)
  }
  lines.push('G80', `G0 Z${settings.safeZ}`, 'M5', 'G0 Z50', 'M30', '%')
  return lines.join('\n') + '\n'
}
