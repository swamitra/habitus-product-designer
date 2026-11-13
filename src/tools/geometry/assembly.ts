import * as THREE from 'three'
import type { HandleDesign } from '../../lib/design'

export interface AssemblyPart {
  id: string
  role: 'exterior' | 'interior' | 'spindle' | 'escutcheon' | 'fixing'
  object: THREE.Object3D
}

export function createAssemblyParts(design: HandleDesign, handle: THREE.Group): AssemblyPart[] {
  const parts: AssemblyPart[] = []
  const thickness = (design.doorThickness ?? 44) / 1000
  const spindle = design.spindleSize ?? 8
  const spindleLength = (design.spindleLength ?? thickness * 1000 + 56) / 1000
  const roseRadius = design.roseDiameter / 2000
  const material = handle.children[0] instanceof THREE.Mesh ? handle.children[0].material : new THREE.MeshStandardMaterial()
  const exterior = handle.clone(true)
  exterior.name = 'Exterior handle'
  exterior.position.z = thickness / 2
  parts.push({ id: 'exterior', role: 'exterior', object: exterior })

  if (design.includePair !== false) {
    const interior = handle.clone(true)
    interior.name = 'Interior handle'
    interior.rotation.y += Math.PI
    interior.position.z = -thickness / 2
    interior.children.forEach((child) => { child.position.x *= -1 })
    parts.push({ id: 'interior', role: 'interior', object: interior })
  }

  const plateDepth = 0.006
  const platePositions = design.type === 'pull' ? [-design.length / 2000, design.length / 2000] : [0]
  for (const side of design.includePair === false ? [1] : [1, -1]) {
    for (const [index, x] of platePositions.entries()) {
      const plate = new THREE.Group()
      plate.name = `${side > 0 ? 'Exterior' : 'Interior'} ${design.escutcheon === 'long-plate' ? 'long escutcheon' : 'round rose'} ${index + 1}`
      const geometry = design.escutcheon === 'long-plate'
        ? new THREE.BoxGeometry(roseRadius * 1.65, design.type === 'lever' ? 0.24 : 0.085, plateDepth)
        : new THREE.CylinderGeometry(roseRadius, roseRadius, plateDepth, 64)
      const mesh = new THREE.Mesh(geometry, material)
      if (design.escutcheon !== 'long-plate') mesh.rotation.x = Math.PI / 2
      plate.add(mesh)
      plate.position.set(side * x, 0, side * (thickness / 2 + plateDepth / 2))
      parts.push({ id: `${plate.name}`, role: 'escutcheon', object: plate })
    }
  }

  const fixingMaterial = new THREE.MeshStandardMaterial({ color: '#777d78', metalness: 0.9, roughness: 0.3 })
  if (design.type === 'pull') {
    // Pull handles are bolted through the door at each leg. Only levers turn on a spindle.
    for (const [index, x] of platePositions.entries()) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, thickness + 0.04, 24), fixingMaterial)
      bolt.name = `M6 back-to-back fixing ${index + 1}`
      bolt.rotation.x = Math.PI / 2
      bolt.position.x = x
      parts.push({ id: bolt.name, role: 'fixing', object: bolt })
    }
  } else {
    const spindleMesh = new THREE.Mesh(new THREE.BoxGeometry(spindle / 1000, spindle / 1000, spindleLength), fixingMaterial)
    spindleMesh.name = `${spindle} mm square spindle`
    parts.push({ id: 'spindle', role: 'spindle', object: spindleMesh })
  }

  if (design.type === 'lever') {
    const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.002, 32), new THREE.MeshStandardMaterial({ color: '#252a26', metalness: 0.4, roughness: 0.5 }))
    keyhole.name = 'Keyhole detail'
    keyhole.rotation.x = Math.PI / 2
    keyhole.position.set(0, -0.075, thickness / 2 + plateDepth + 0.001)
    parts.push({ id: 'keyhole', role: 'fixing', object: keyhole })
  }
  return parts
}

export function applyAssemblyView(parts: AssemblyPart[], view: HandleDesign['assemblyView']) {
  for (const part of parts) {
    part.object.visible = view !== 'exterior' || part.role === 'exterior' || part.role === 'escutcheon' && part.object.position.z > 0
    if (view === 'interior') part.object.visible = part.role === 'interior' || part.role === 'escutcheon' && part.object.position.z < 0
    if (view === 'exploded') {
      if (part.role === 'exterior') part.object.position.z += 0.12
      if (part.role === 'interior') part.object.position.z -= 0.12
      if (part.role === 'escutcheon') part.object.position.z += Math.sign(part.object.position.z) * 0.06
    }
  }
}
