import type { HandleDesign } from '../../lib/design'

function boxStep(name: string, x: number, y: number, z: number, dx: number, dy: number, dz: number, start: number) {
  const points = [[0,0,0],[dx,0,0],[dx,dy,0],[0,dy,0],[0,0,dz],[dx,0,dz],[dx,dy,dz],[0,dy,dz]]
  const lines: string[] = []
  let id = start
  const pointIds = points.map(([px, py, pz]) => { lines.push(`#${id}=CARTESIAN_POINT('${name}',(${x+px},${y+py},${z+pz}));`); return id++ })
  const faces = [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
  for (const face of faces) {
    const loop = `#${id++}`
    lines.push(`${loop}=POLY_LOOP('',(${face.map((index) => `#${pointIds[index]}`).join(',')}));`)
    const bound = `#${id++}`
    lines.push(`${bound}=FACE_OUTER_BOUND('',${loop},.T.);`)
    lines.push(`#${id++}=FACE('',(${bound}));`)
  }
  return { lines, nextId: id }
}

export function generateAssemblyStep(design: HandleDesign) {
  const thickness = design.doorThickness ?? 44
  const spindle = design.spindleSize ?? 8
  const spindleLength = design.spindleLength ?? thickness + 56
  const boxes = [
    { name: 'SQUARE_SPINDLE', x: -spindle/2, y: -spindle/2, z: -spindleLength/2, dx: spindle, dy: spindle, dz: spindleLength },
    { name: 'EXTERIOR_ROSE', x: -design.roseDiameter/2, y: -design.roseDiameter/2, z: thickness/2, dx: design.roseDiameter, dy: design.roseDiameter, dz: 6 },
    { name: 'INTERIOR_ROSE', x: -design.roseDiameter/2, y: -design.roseDiameter/2, z: -thickness/2-6, dx: design.roseDiameter, dy: design.roseDiameter, dz: 6 },
  ]
  let id = 10
  const entities: string[] = []
  for (const box of boxes) { const result = boxStep(box.name, box.x, box.y, box.z, box.dx, box.dy, box.dz, id); entities.push(...result.lines); id = result.nextId }
  return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('Aperture assembly reference geometry'),'2;1');\nFILE_NAME('${design.name}.step','${new Date().toISOString()}',('Aperture'),('Aperture'),'Aperture STEP writer','Aperture','Concept only');\nFILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));\nENDSEC;\nDATA;\n${entities.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`
}
