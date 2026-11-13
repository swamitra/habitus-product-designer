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
}
color, metalness, roughness = finish_colors[design['finish']]
material = bpy.data.materials.new(design['name'] + ' | ' + design['finish'])
material.use_nodes = True
bsdf = material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = color
bsdf.inputs['Metallic'].default_value = metalness
bsdf.inputs['Roughness'].default_value = roughness

length = design['length'] / 1000
projection = design['projection'] / 1000
radius = design['diameter'] / 2000
rose_radius = design['roseDiameter'] / 2000

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

if design['type'] == 'pull':
    points = [(-length / 2, 0, 0), (-length / 2, 0, projection), (length / 2, 0, projection), (length / 2, 0, 0)]
    rose('Left rose', -length / 2)
    rose('Right rose', length / 2)
else:
    angle = math.radians(design['returnAngle'])
    points = [(0, 0, 0), (0, 0, projection * 0.72), (math.sin(angle) * length * 0.25, 0, projection), (length, 0, projection)]
    rose('Lever rose', 0)
for index in range(len(points) - 1):
    bar('Handle segment ' + str(index + 1), points[index], points[index + 1])
for index, point in enumerate(points[1:-1]):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=radius, location=point)
    obj = move_to_collection(bpy.context.object)
    obj.name = 'Elbow ' + str(index + 1)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True

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
