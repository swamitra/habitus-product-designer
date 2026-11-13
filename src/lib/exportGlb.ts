import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { createHandleGroup } from './geometry'
import type { HandleDesign } from './design'

export async function exportGlb(design: HandleDesign) {
  const model = createHandleGroup(design)
  model.rotation.set(0, 0, 0)
  const result = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true })
  return URL.createObjectURL(new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' }))
}
