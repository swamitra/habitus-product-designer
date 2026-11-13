import * as THREE from 'three'
import { finishes, type HandleDesign } from './design'

export function createHandleGroup(design: HandleDesign) {
  const group = new THREE.Group()
  group.name = design.name
  const finish = finishes.find((item) => item.id === design.finish) ?? finishes[0]
  const material = new THREE.MeshStandardMaterial({ color: finish.color, metalness: finish.metalness, roughness: finish.roughness })
  const length = design.length / 1000
  const projection = design.projection / 1000
  const radius = design.diameter / 2000
  const roseRadius = design.roseDiameter / 2000
  const isPull = design.type === 'pull'
  const points: [number, number, number][] = isPull
    ? [[-length / 2, 0, 0], [-length / 2, 0, projection], [length / 2, 0, projection], [length / 2, 0, 0]]
    : [[0, 0, 0], [0, 0, projection * 0.72], [Math.sin(design.returnAngle * Math.PI / 180) * length * 0.25, 0, projection], [length, 0, projection]]
  const addMesh = (geometry: THREE.BufferGeometry, position: THREE.Vector3, quaternion?: THREE.Quaternion) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)
    if (quaternion) mesh.quaternion.copy(quaternion)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
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
  points.slice(1, -1).forEach((point) => addMesh(new THREE.SphereGeometry(radius * (design.profile === 'round' ? 1 : 0.93), 32, 24), new THREE.Vector3(...point)))
  group.rotation.set(0.12, -0.35, isPull ? -0.08 : 0)
  return group
}
