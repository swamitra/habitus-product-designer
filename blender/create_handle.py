import bpy
import math
import json
from mathutils import Vector

# Aperture sends a validated design as a JSON literal before this script.
design = DESIGN_JSON
collection_name = 'Aperture | ' + design['name']
old_collection = bpy.data.collections.get(collection_name)
if old_collection:
    for obj in list(old_collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old_collection)
collection = bpy.data.collections.new(collection_name)
bpy.context.scene.collection.children.link(collection)

finish_colors = {
    'graphite': ((0.095, 0.108, 0.098, 1), 0.85, 0.32),
    'steel': ((0.48, 0.52, 0.49, 1), 0.95, 0.27),
    'bronze': ((0.18, 0.12, 0.075, 1), 0.9, 0.34),
    'black': ((0.018, 0.022, 0.019, 1), 0.45, 0.58),
    'gold': ((0.42, 0.29, 0.09, 1), 0.88, 0.3),
    'marble': ((0.65, 0.66, 0.62, 1), 0.02, 0.38),
    'oak': ((0.32, 0.19, 0.08, 1), 0.0, 0.65),
}
color, metalness, roughness = finish_colors[design['finish']]
material = bpy.data.materials.new(design['name'] + ' | ' + design['finish'])
material.use_nodes = True
bsdf = material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = color
bsdf.inputs['Metallic'].default_value = metalness
bsdf.inputs['Roughness'].default_value = roughness
if design['finish'] in ['marble', 'oak']:
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 5.0 if design['finish'] == 'marble' else 7.0
    noise.inputs['Detail'].default_value = 4.0
    noise.inputs['Roughness'].default_value = 0.72
    if design['finish'] == 'oak':
        texcoord = nodes.new('ShaderNodeTexCoord')
        mapping = nodes.new('ShaderNodeVectorMath')
        mapping.operation = 'MULTIPLY'
        mapping.inputs[1].default_value = (8.0, 8.0, 0.35)
        links.new(texcoord.outputs['Generated'], mapping.inputs[0])
        links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    if design['finish'] == 'marble':
        ramp.color_ramp.elements[0].position = 0.38
        ramp.color_ramp.elements[0].color = (0.18, 0.21, 0.19, 1)
        ramp.color_ramp.elements[1].position = 0.58
        ramp.color_ramp.elements[1].color = (0.78, 0.79, 0.74, 1)
    else:
        ramp.color_ramp.elements[0].color = (0.12, 0.055, 0.018, 1)
        ramp.color_ramp.elements[1].color = (0.48, 0.3, 0.13, 1)
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])

length = design.get('length', 300) / 1000
projection = design.get('projection', 55) / 1000
radius = design.get('diameter', 19) / 2000
rose_radius = design.get('roseDiameter', 38) / 2000

def move_to_collection(obj):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj

def bar(name, start, end):
    a, b = Vector(start), Vector(end)
    direction = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=radius, depth=direction.length, location=(a + b) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    if design['profile'] != 'round':
        obj.scale.x = 0.9
        obj.scale.y = 0.9
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bevel = obj.modifiers.new('Machined edges', 'BEVEL')
        bevel.width = radius * (0.45 if design['profile'] == 'soft' else 0.08)
        bevel.segments = 4
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return move_to_collection(obj)

def rose(name, x):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=rose_radius, depth=0.009, location=(x, 0, 0))
    obj = move_to_collection(bpy.context.object)
    obj.name = name
    bevel = obj.modifiers.new('Edge radius', 'BEVEL')
    bevel.width = 0.001
    bevel.segments = 3
    for polygon in obj.data.polygons:
        polygon.use_smooth = True

if design.get('productType') == 'door':
    width = design.get('width', 900) / 1000
    height = design.get('height', 2100) / 1000
    depth = design.get('thickness', 40) / 1000
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    obj = move_to_collection(bpy.context.object)
    obj.name = 'Door panel'
    obj.dimensions = (width, depth, height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new('Rounded perimeter', 'BEVEL')
    bevel.width = min(design.get('cornerRadius', 0) / 1000, depth / 2)
    bevel.segments = 6
elif design.get('shape') == 'half-circle':
    curve = bpy.data.curves.new('Half-circle profile', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 5
    spline = curve.splines.new('POLY')
    spline.points.add(32)
    for index, point in enumerate(spline.points):
        angle = math.pi - index * math.pi / 32
        point.co = (math.cos(angle) * length / 2, math.sin(angle) * length / 2, projection, 1)
    obj = bpy.data.objects.new('Half-circle handle', curve)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    rose('Left rose', -length / 2)
    rose('Right rose', length / 2)
elif design['type'] == 'pull':
    points = [(-length / 2, 0, 0), (-length / 2, 0, projection), (length / 2, 0, projection), (length / 2, 0, 0)]
    rose('Left rose', -length / 2)
    rose('Right rose', length / 2)
else:
    angle = math.radians(design['returnAngle'])
    points = [(0, 0, 0), (0, 0, projection * 0.72), (math.sin(angle) * length * 0.25, 0, projection), (length, 0, projection)]
    rose('Lever rose', 0)
for index in range(len(points) - 1) if not design.get('productType') and design.get('shape') != 'half-circle' else []:
    bar('Handle segment ' + str(index + 1), points[index], points[index + 1])
for index, point in enumerate(points[1:-1]) if not design.get('productType') and design.get('shape') != 'half-circle' else []:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=radius, location=point)
    obj = move_to_collection(bpy.context.object)
    obj.name = 'Elbow ' + str(index + 1)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True

if design.get('ornament') == 'bird' and not design.get('productType'):
    outline = [(-0.065, 0), (-0.025, 0.055), (0, 0.012), (0.035, 0.065), (0.075, 0.045), (0.025, -0.005), (0.055, -0.025), (0.015, -0.018)]
    mesh = bpy.data.meshes.new('Bird silhouette')
    mesh.from_pydata([(x, y + (length / 2 if design.get('shape') == 'half-circle' else 0), projection + radius) for x, y in outline], [], [list(range(len(outline)))])
    mesh.update()
    obj = bpy.data.objects.new('Integrated bird detail', mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    solidify = obj.modifiers.new('Relief depth', 'SOLIDIFY')
    solidify.thickness = 0.004

bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.length_unit = 'MILLIMETERS'
for obj in collection.objects:
    obj['Aperture design'] = json.dumps(design)
    obj.select_set(True)
bpy.context.view_layer.objects.active = collection.objects[0]
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_distance = max(0.6, length * 2)
        area.spaces.active.region_3d.view_location = (0, 0, projection / 2)
print('Created ' + collection_name + ' with ' + str(len(collection.objects)) + ' editable objects.')
