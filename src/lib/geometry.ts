import * as THREE from 'three'
import { finishes, type HandleDesign } from './design'
import { applyAssemblyView, createAssemblyParts } from '../tools/geometry/assembly'

export function createHandleGroup(design: HandleDesign) {
  const group = new THREE.Group()
  group.name = design.name
  const finish = finishes.find((item) => item.id === design.finish) ?? finishes[0]
  const material = new THREE.MeshStandardMaterial({ color: finish.color, metalness: finish.metalness, roughness: finish.roughness })
  if (design.finish === 'marble') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512
    const context = canvas.getContext('2d')!; context.fillStyle = '#deded7'; context.fillRect(0, 0, 512, 512)
    let seed = 41; const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (let i = 0; i < 24; i++) { context.beginPath(); context.moveTo(-40, random() * 600); context.bezierCurveTo(150, random() * 512, 280, random() * 512, 560, random() * 512); context.strokeStyle = `rgba(80,88,82,${0.04 + random() * 0.13})`; context.lineWidth = 0.5 + random() * 2; context.stroke() }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; material.map = texture
  }
  if (design.finish === 'oak') {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 512
    const context = canvas.getContext('2d')!; context.fillStyle = '#b18d60'; context.fillRect(0, 0, 256, 512)
    for (let i = 0; i < 90; i++) { context.beginPath(); context.moveTo(i * 3, 0); context.bezierCurveTo(i * 3 + 8, 150, i * 3 - 6, 350, i * 3 + 3, 512); context.strokeStyle = `rgba(75,48,25,${0.025 + (i % 5) * 0.015})`; context.lineWidth = 1; context.stroke() }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; material.map = texture
  }
  const addMesh = (geometry: THREE.BufferGeometry, position: THREE.Vector3, quaternion?: THREE.Quaternion) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)
    if (quaternion) mesh.quaternion.copy(quaternion)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
  if (design.productType === 'door') {
    const width = (design.width ?? 900) / 1000, height = (design.height ?? 2100) / 1000, depth = (design.thickness ?? 40) / 1000
    const corner = Math.min((design.cornerRadius ?? 0) / 1000, width / 2, height / 2)
    const shape = new THREE.Shape(); shape.moveTo(-width / 2 + corner, 0); shape.lineTo(width / 2 - corner, 0); shape.quadraticCurveTo(width / 2, 0, width / 2, corner); shape.lineTo(width / 2, height - corner); shape.quadraticCurveTo(width / 2, height, width / 2 - corner, height); shape.lineTo(-width / 2 + corner, height); shape.quadraticCurveTo(-width / 2, height, -width / 2, height - corner); shape.lineTo(-width / 2, corner); shape.quadraticCurveTo(-width / 2, 0, -width / 2 + corner, 0)
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 3, curveSegments: 24 }); geometry.translate(0, -height / 2, -depth / 2)
    addMesh(geometry, new THREE.Vector3())
    group.rotation.set(0, -0.35, 0)
    return group
  }
  const length = design.length / 1000
  const projection = design.projection / 1000
  const radius = design.diameter / 2000
  const roseRadius = design.roseDiameter / 2000
  const isPull = design.type === 'pull'
  const points: [number, number, number][] = design.shape === 'half-circle'
    ? Array.from({ length: 33 }, (_, index) => { const angle = Math.PI - index * Math.PI / 32; return [Math.cos(angle) * length / 2, Math.sin(angle) * length / 2, projection] as [number, number, number] })
    : isPull
    ? [[-length / 2, 0, 0], [-length / 2, 0, projection], [length / 2, 0, projection], [length / 2, 0, 0]]
    : [[0, 0, 0], [0, 0, projection * 0.72], [Math.sin(design.returnAngle * Math.PI / 180) * length * 0.25, 0, projection], [length, 0, projection]]
  points.slice(0, -1).forEach((point, index) => {
    const a = new THREE.Vector3(...point)
    const b = new THREE.Vector3(...points[index + 1])
    const direction = b.clone().sub(a)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())
    const geometry = design.profile === 'round'
      ? new THREE.CylinderGeometry(radius, radius, direction.length(), 48)
      : new THREE.BoxGeometry(radius * 1.8, direction.length(), radius * (design.profile === 'soft' ? 1.65 : 1.8))
    addMesh(geometry, a.clone().add(b).multiplyScalar(0.5), quaternion)
  })
  ;(isPull ? [-length / 2, length / 2] : [0]).forEach((x) => {
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))
    addMesh(new THREE.CylinderGeometry(roseRadius, roseRadius, 0.009, 64), new THREE.Vector3(x, 0, 0), quaternion)
    addMesh(new THREE.CylinderGeometry(radius * 1.35, radius * 1.35, 0.012, 48), new THREE.Vector3(x, 0, 0.006), quaternion)
  })
  if (design.shape !== 'half-circle') points.slice(1, -1).forEach((point) => addMesh(new THREE.SphereGeometry(radius * (design.profile === 'round' ? 1 : 0.93), 32, 24), new THREE.Vector3(...point)))
  if (design.ornament === 'bird') {
    const bird = new THREE.Shape(); bird.moveTo(-0.065, 0); bird.quadraticCurveTo(-0.025, 0.055, 0, 0.012); bird.quadraticCurveTo(0.035, 0.065, 0.075, 0.045); bird.quadraticCurveTo(0.045, 0.025, 0.025, -0.005); bird.lineTo(0.055, -0.025); bird.lineTo(0.015, -0.018); bird.quadraticCurveTo(-0.025, -0.04, -0.065, 0)
    const geometry = new THREE.ExtrudeGeometry(bird, { depth: 0.004, bevelEnabled: true, bevelSize: 0.001, bevelThickness: 0.001, bevelSegments: 2 })
    addMesh(geometry, new THREE.Vector3(0, design.shape === 'half-circle' ? length / 2 : 0, projection + radius))
  }
  const assembly = new THREE.Group()
  assembly.name = design.name
  const parts = createAssemblyParts(design, group)
  applyAssemblyView(parts, design.assemblyView)
  parts.forEach((part) => assembly.add(part.object))
  assembly.rotation.set(0.12, -0.35, isPull ? -0.08 : 0)
  return assembly
}
