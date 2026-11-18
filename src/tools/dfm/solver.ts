import type { HandleDesign } from '../../lib/design'

export type DfmSeverity = 'error' | 'warning' | 'info'
export interface DfmFinding { id: string; severity: DfmSeverity; title: string; detail: string; action?: string }
export interface DfmReport { status: 'passed' | 'review' | 'blocked'; findings: DfmFinding[]; checkedAt: string }

export function evaluateDfm(design: HandleDesign): DfmReport {
  const findings: DfmFinding[] = []
  const add = (finding: DfmFinding) => findings.push(finding)
  if (design.productType !== 'door') {
    const clearance = design.projection - design.diameter
    if (clearance < 38) add({ id: 'knuckle-clearance', severity: 'error', title: 'Not enough finger clearance', detail: `${clearance.toFixed(0)} mm is available behind the grip. Architectural pulls need at least 38 mm.`, action: `Increase projection to ${Math.ceil(design.diameter + 38)} mm.` })
    else add({ id: 'knuckle-clearance', severity: 'info', title: 'Grip clearance verified', detail: `${clearance.toFixed(0)} mm behind the grip meets the 38 mm minimum.` })
    const thickness = design.doorThickness ?? 44
    if (thickness < 38 || thickness > 98) add({ id: 'door-thickness', severity: 'error', title: 'Door thickness outside supported range', detail: 'The current hardware interface supports 38-98 mm doors.', action: 'Adjust door thickness or specify a custom fixing kit.' })
    const spindleLength = design.spindleLength ?? thickness + 56
    if (spindleLength < thickness + 40) add({ id: 'spindle-engagement', severity: 'error', title: 'Insufficient spindle engagement', detail: 'Allow at least 20 mm engagement on each side of the door.', action: `Use a spindle at least ${thickness + 40} mm long.` })
    if (design.type === 'lever' && design.spindleSize === 10) add({ id: 'spindle-standard', severity: 'warning', title: 'Non-standard lever spindle', detail: 'Most referenced lever systems use 7-9 mm spindles. Confirm lock compatibility before fabrication.' })
    if (design.finish === 'marble') add({ id: 'stone-inlay', severity: 'warning', title: 'Stone requires structural backing', detail: 'Use 6-8 mm stone only with continuous aluminum backing and an elastomeric bond.', action: 'Specify a 2 mm aluminum subplate and 0.5-1.5 mm isolation channel.' })
  } else {
    const thickness = design.thickness ?? 40
    if (design.finish === 'marble' && thickness < 18) add({ id: 'stone-thickness', severity: 'error', title: 'Unsupported stone is too thin', detail: 'Unbacked marble must be at least 18 mm thick.', action: 'Increase thickness or add continuous aluminum honeycomb backing.' })
    if (design.finish === 'marble') add({ id: 'hinge-load', severity: 'warning', title: 'Verify heavy-door hinge engineering', detail: 'Stone cladding requires a leaf-mass calculation and cladding-offset hinges.', action: 'Use a TECTUS A8-class detail for face cladding up to 8 mm after load verification.' })
    if (design.finish === 'oak') add({ id: 'timber-movement', severity: 'warning', title: 'Allow seasonal timber movement', detail: 'Wide timber panels need mechanical slip joints and a 2-4 mm perimeter expansion channel.' })
    if ((design.cornerRadius ?? 0) > 0 && (design.cornerRadius ?? 0) < 3) add({ id: 'internal-radius', severity: 'error', title: 'Internal corner is too sharp', detail: 'Stone and CNC-milled internal corners require a radius of at least 3 mm.' })
  }
  const status = findings.some((finding) => finding.severity === 'error') ? 'blocked' : findings.some((finding) => finding.severity === 'warning') ? 'review' : 'passed'
  return { status, findings, checkedAt: new Date().toISOString() }
}
