import type { HandleDesign } from '../../lib/design'
import { evaluateDfm } from '../dfm/solver'

export function canonicalSpecification(design: HandleDesign) {
  const thickness = design.doorThickness ?? 44
  return {
    schema_version: '1.0',
    design_id: `aperture_${design.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    archetype: design.productType === 'door' ? 'architectural_door_leaf' : `${design.type}_${design.shape ?? 'straight'}_assembly`,
    units: 'mm',
    global_dimensions_mm: design.productType === 'door' ? {
      width: design.width ?? 900, height: design.height ?? 2100, thickness: design.thickness ?? 40, corner_radius: design.cornerRadius ?? 0,
    } : {
      overall_length: design.length, center_to_center_pitch: design.length,
      projection_depth: design.projection, knuckle_clearance: design.projection - design.diameter,
      grip_diameter: design.diameter, rose_diameter: design.roseDiameter,
    },
    door_interface: design.productType === 'door' ? null : {
      configuration: design.includePair === false ? 'single_sided' : 'back_to_back_pair',
      door_thickness_dt_mm: thickness,
      spindle: design.type === 'lever' ? { section: 'square', size_mm: design.spindleSize ?? 8, length_mm: design.spindleLength ?? thickness + 56 } : null,
      escutcheon: design.escutcheon ?? 'round-rose',
      fastener_spec: design.type === 'pull' ? 'M8_SS316_through_bolt_concealed' : 'concealed_rose_fixing',
      drilling_spec: { timber_flush_hole_dia_mm: 10, bushing_material: 'POM_Delrin_Isolator' },
    },
    material: { finish_id: design.finish, inventory_twin_id: null, status: 'generic_visual_material_not_factory_inventory' },
    sub_assemblies: design.productType === 'door' ? ['door_leaf'] : ['exterior_handle', 'interior_handle', 'escutcheons', 'spindle', 'fixings'],
    dfm_validation_report: evaluateDfm(design),
    manufacturing_status: 'concept_requires_engineering_approval',
  }
}
