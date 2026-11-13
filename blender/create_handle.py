import bpy
import bmesh
import math
import json
from mathutils import Matrix, Vector

# Aperture sends a validated design as a JSON literal before this script.
design = DESIGN_JSON

# ---------------------------------------------------------------------------
# Conventions
#   Geometry is authored in "design space", in metres:
#     x = along the door face, y = up the door, z = out of the door face.
#   The exterior side is +z, the interior side is -z, the door centre is z = 0.
#   to_world() stands the door upright in Blender (Z up, exterior facing -Y),
#   so the default front view looks straight at the exterior handle.
# ---------------------------------------------------------------------------

ROSE_HEIGHT = 0.008
COLLAR_HEIGHT = 0.005
PLATE_HEIGHT = 0.008
BOLT_DIAMETER = 0.006


def to_world(point):
    return Vector((point[0], -point[2], point[1]))


# --- scene bookkeeping -----------------------------------------------------

collection_name = 'Aperture | ' + design['name']
old_collection = bpy.data.collections.get(collection_name)
if old_collection:
    for old_object in list(old_collection.objects):
        old_data = old_object.data
        bpy.data.objects.remove(old_object, do_unlink=True)
        if old_data and old_data.users == 0:
            bpy.data.meshes.remove(old_data)
    bpy.data.collections.remove(old_collection)
collection = bpy.data.collections.new(collection_name)
bpy.context.scene.collection.children.link(collection)


def fresh_material(name):
    stale = bpy.data.materials.get(name)
    if stale and stale.users == 0:
        bpy.data.materials.remove(stale)
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    return material


def plain_material(name, color, metallic, roughness):
    material = fresh_material(name)
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return material


finish_colors = {
    'graphite': ((0.095, 0.108, 0.098, 1), 0.85, 0.32),
    'steel': ((0.48, 0.52, 0.49, 1), 0.95, 0.27),
    'bronze': ((0.18, 0.12, 0.075, 1), 0.9, 0.34),
    'black': ((0.018, 0.022, 0.019, 1), 0.45, 0.58),
    'gold': ((0.42, 0.29, 0.09, 1), 0.88, 0.3),
    'marble': ((0.65, 0.66, 0.62, 1), 0.02, 0.38),
    'oak': ((0.32, 0.19, 0.08, 1), 0.0, 0.65),
}
material = plain_material(design['name'] + ' | ' + design['finish'], *finish_colors[design['finish']])
if design['finish'] in ['marble', 'oak']:
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get('Principled BSDF')
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


def add_object(name, geometry, object_material, role, side=None):
    """Create one editable mesh object from design-space (verts, faces)."""
    verts, faces = geometry
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bm_verts = [bm.verts.new(to_world(vert)) for vert in verts]
    for face in faces:
        bm.faces.new([bm_verts[index] for index in face])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for face in bm.faces:
        face.smooth = True
    for edge in bm.edges:
        if len(edge.link_faces) == 2 and edge.calc_face_angle(0.0) > math.radians(35):
            edge.smooth = False
    bm.to_mesh(mesh)
    bm.free()
    if hasattr(mesh, 'use_auto_smooth'):  # Blender 4.0 and earlier
        mesh.use_auto_smooth = True
    mesh.materials.append(object_material)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj['Aperture role'] = role
    if side:
        obj['Assembly side'] = 'Exterior' if side > 0 else 'Interior'
    return obj


# --- geometry primitives (design space) -------------------------------------

def section_profile(profile, diameter):
    """Closed 2D cross-section of the grip bar."""
    if profile == 'round':
        radius = diameter / 2
        return [(math.cos(i * math.tau / 40) * radius, math.sin(i * math.tau / 40) * radius) for i in range(40)]
    half = diameter * 0.45
    corner = half * 0.5 if profile == 'soft' else 0.0006
    steps = 6 if profile == 'soft' else 1
    points = []
    for quadrant, (cx, cy) in enumerate([(1, 1), (-1, 1), (-1, -1), (1, -1)]):
        for step in range(steps + 1):
            angle = (quadrant + step / steps) * math.pi / 2
            points.append((cx * (half - corner) + math.cos(angle) * corner, cy * (half - corner) + math.sin(angle) * corner))
    return points


def fillet_path(points, bend_radius, minimum_radius, steps=10):
    """Round the sharp corners of a polyline. Corners too tight to bend stay mitred."""
    points = [Vector(point) for point in points]
    result = [points[0]]
    for index in range(1, len(points) - 1):
        corner = points[index]
        incoming = corner - points[index - 1]
        outgoing = points[index + 1] - corner
        turn = incoming.angle(outgoing)
        if bend_radius <= 0 or turn < math.radians(20):
            result.append(corner)
            continue
        tangent_limit = 0.45 * min(incoming.length, outgoing.length)
        radius = min(bend_radius, tangent_limit / math.tan(turn / 2))
        if radius < minimum_radius:
            result.append(corner)
            continue
        d1, d2 = incoming.normalized(), outgoing.normalized()
        inward = (d2 - d1 * d1.dot(d2)).normalized()
        centre = corner - d1 * (radius * math.tan(turn / 2)) + inward * radius
        for step in range(steps + 1):
            angle = turn * step / steps
            result.append(centre + (d1 * math.sin(angle) - inward * math.cos(angle)) * radius)
    result.append(points[-1])
    return result


def sweep(path, profile):
    """Sweep a closed profile along a path with mitred joints and flat end caps."""
    path = [Vector(point) for point in path]
    count, size = len(path), len(profile)
    directions = [(path[i + 1] - path[i]).normalized() for i in range(count - 1)]
    normal = Vector((0, 1, 0))
    if abs(directions[0].dot(normal)) > 0.9:
        normal = Vector((1, 0, 0))
    previous_tangent = directions[0]
    verts, faces = [], []
    for index, point in enumerate(path):
        before = directions[max(index - 1, 0)]
        after = directions[min(index, count - 2)]
        tangent = (before + after).normalized()
        axis = previous_tangent.cross(tangent)
        if axis.length > 1e-9:
            normal = Matrix.Rotation(previous_tangent.angle(tangent), 3, axis.normalized()) @ normal
        normal = (normal - tangent * normal.dot(tangent)).normalized()
        binormal = tangent.cross(normal)
        half_turn = before.angle(after) / 2
        mitre_axis = (after - before).normalized() if half_turn > 1e-6 else None
        for u, v in profile:
            offset = binormal * u + normal * v
            if mitre_axis:
                offset += mitre_axis * offset.dot(mitre_axis) * (1 / math.cos(half_turn) - 1)
            verts.append(point + offset)
        previous_tangent = tangent
    for ring in range(count - 1):
        for index in range(size):
            a, b = ring * size + index, ring * size + (index + 1) % size
            faces.append((a, b, b + size, a + size))
    faces.append(tuple(range(size)))
    faces.append(tuple(range((count - 1) * size, count * size)))
    return verts, faces


def lathe(x, y, profile, segments=64):
    """Revolve (radius, z) pairs around the z axis through (x, y), capped at both ends."""
    verts, faces = [], []
    for radius, z in profile:
        for index in range(segments):
            angle = index * math.tau / segments
            verts.append((x + math.cos(angle) * radius, y + math.sin(angle) * radius, z))
    for ring in range(len(profile) - 1):
        for index in range(segments):
            a, b = ring * segments + index, ring * segments + (index + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces.append(tuple(range(segments)))
    faces.append(tuple(range((len(profile) - 1) * segments, len(profile) * segments)))
    return verts, faces


def prism(outline, z0, z1):
    """Extrude a closed 2D outline between two z heights."""
    size = len(outline)
    verts = [(x, y, z0) for x, y in outline] + [(x, y, z1) for x, y in outline]
    faces = [(i, (i + 1) % size, (i + 1) % size + size, i + size) for i in range(size)]
    faces.append(tuple(range(size)))
    faces.append(tuple(range(size, size * 2)))
    return verts, faces


def rounded_rectangle(width, height, corner, cx=0.0, cy=0.0, steps=8):
    corner = max(min(corner, width / 2, height / 2), 0.0)
    if corner < 1e-6:
        return [(cx + sx * width / 2, cy + sy * height / 2) for sx, sy in [(1, 1), (-1, 1), (-1, -1), (1, -1)]]
    points = []
    for quadrant, (sx, sy) in enumerate([(1, 1), (-1, 1), (-1, -1), (1, -1)]):
        for step in range(steps + 1):
            angle = (quadrant + step / steps) * math.pi / 2
            points.append((cx + sx * (width / 2 - corner) + math.cos(angle) * corner, cy + sy * (height / 2 - corner) + math.sin(angle) * corner))
    return points


def quadratic(start, control, end, steps=8):
    return [tuple((1 - t) ** 2 * s + 2 * (1 - t) * t * c + t ** 2 * e for s, c, e in zip(start, control, end)) for t in [i / steps for i in range(1, steps + 1)]]


# --- products ---------------------------------------------------------------

if design.get('productType') == 'door':
    width = design.get('width', 900) / 1000
    height = design.get('height', 2100) / 1000
    depth = design.get('thickness', 40) / 1000
    outline = rounded_rectangle(width, height, design.get('cornerRadius', 0) / 1000, steps=12)
    add_object('Door panel', prism(outline, -depth / 2, depth / 2), material, 'door')
    view_distance, view_height = height * 1.6, 0.0
else:
    length = design.get('length', 300) / 1000
    projection = design.get('projection', 55) / 1000
    diameter = design.get('diameter', 19) / 1000
    rose_radius = design.get('roseDiameter', 38) / 2000
    door_thickness = design.get('doorThickness', 44) / 1000
    face = door_thickness / 2
    is_pull = design['type'] == 'pull'
    is_half_circle = design.get('shape') == 'half-circle'
    long_plate = design.get('escutcheon') == 'long-plate'
    profile = section_profile(design['profile'], diameter)
    # Round bar is bent on a radius. Square and soft-square sections are mitred.
    bend_radius = diameter * 1.25 if design['profile'] == 'round' else 0.0
    # Bars start inside the rose or plate so no faces are coplanar with the door face.
    seat = (PLATE_HEIGHT if long_plate else ROSE_HEIGHT) / 2

    if is_half_circle:
        arc = [(math.cos(math.pi - i * math.pi / 48) * length / 2, math.sin(math.pi - i * math.pi / 48) * length / 2, projection) for i in range(49)]
        path = [Vector((-length / 2, 0, seat))] + [Vector(point) for point in arc] + [Vector((length / 2, 0, seat))]
        fixing_points = [-length / 2, length / 2]
    elif is_pull:
        path = fillet_path([(-length / 2, 0, seat), (-length / 2, 0, projection), (length / 2, 0, projection), (length / 2, 0, seat)], bend_radius, diameter * 0.55)
        fixing_points = [-length / 2, length / 2]
    else:
        angle = math.radians(design['returnAngle'])
        path = fillet_path([(0, 0, seat), (0, 0, projection * 0.72), (math.sin(angle) * length * 0.25, 0, projection), (length, 0, projection)], bend_radius, diameter * 0.55)
        fixing_points = [0.0]

    sides = [1, -1] if design.get('includePair', True) else [1]
    fixing_material = plain_material(design['name'] + ' | fixings', (0.42, 0.45, 0.43, 1), 0.9, 0.3)
    collar_radius = diameter * 0.675
    for side in sides:
        label = 'Exterior' if side > 0 else 'Interior'

        def out(z, side=side):
            return side * (face + z)

        grip_name = 'half-circle handle' if is_half_circle else 'pull handle' if is_pull else 'lever handle'
        grip_verts, grip_faces = sweep(path, profile)
        add_object(label + ' ' + grip_name, ([(v.x, v.y, out(v.z)) for v in grip_verts], grip_faces), material, 'grip', side)

        for index, x in enumerate(fixing_points):
            suffix = ' ' + str(index + 1) if len(fixing_points) > 1 else ''
            if long_plate:
                plate_height = 0.24 if not is_pull else 0.085
                outline = rounded_rectangle(rose_radius * 1.65, plate_height, 0.004, cx=x)
                add_object(label + ' long escutcheon' + suffix, prism(outline, out(0), out(PLATE_HEIGHT)), material, 'escutcheon', side)
                collar = [(collar_radius, out(PLATE_HEIGHT)), (collar_radius, out(PLATE_HEIGHT + COLLAR_HEIGHT))]
                add_object(label + ' collar' + suffix, lathe(x, 0, collar, 48), material, 'escutcheon', side)
            else:
                chamfer = 0.001
                rose = [
                    (rose_radius, out(0)), (rose_radius, out(ROSE_HEIGHT - chamfer)), (rose_radius - chamfer, out(ROSE_HEIGHT)),
                    (collar_radius, out(ROSE_HEIGHT)), (collar_radius, out(ROSE_HEIGHT + COLLAR_HEIGHT)),
                ]
                add_object(label + ' round rose' + suffix, lathe(x, 0, rose), material, 'escutcheon', side)

        if long_plate and not is_pull:
            keyhole_material = plain_material(design['name'] + ' | keyhole', (0.02, 0.022, 0.02, 1), 0.4, 0.5)
            keyhole = [(0.009, out(PLATE_HEIGHT)), (0.009, out(PLATE_HEIGHT + 0.001))]
            add_object(label + ' keyhole detail', lathe(0, -0.075, keyhole, 32), keyhole_material, 'fixing', side)

        if design.get('ornament') == 'bird':
            outline = [(-0.065, 0.0)]
            outline += quadratic((-0.065, 0.0), (-0.025, 0.055), (0.0, 0.012))
            outline += quadratic((0.0, 0.012), (0.035, 0.065), (0.075, 0.045))
            outline += quadratic((0.075, 0.045), (0.045, 0.025), (0.025, -0.005))
            outline += [(0.055, -0.025), (0.015, -0.018)]
            outline += quadratic((0.015, -0.018), (-0.025, -0.04), (-0.065, 0.0))[:-1]
            lift = length / 2 if is_half_circle else 0.0
            base = projection + diameter / 2 - 0.0005
            add_object(label + ' bird detail', prism([(x, y + lift) for x, y in outline], out(base), out(base + 0.004)), material, 'ornament', side)

    if is_pull or is_half_circle:
        # Pull handles are fixed through the door at each leg, not turned on a spindle.
        for index, x in enumerate(fixing_points):
            if len(sides) == 2:
                bolt = [(BOLT_DIAMETER / 2, -(face + 0.02)), (BOLT_DIAMETER / 2, face + 0.02)]
                name = 'M6 back-to-back fixing ' + str(index + 1)
            else:
                bolt = [(0.007, -(face + 0.003)), (0.007, -face), (BOLT_DIAMETER / 2, -face), (BOLT_DIAMETER / 2, face + 0.02)]
                name = 'M6 bolt-through fixing ' + str(index + 1)
            add_object(name, lathe(x, 0, bolt, 24), fixing_material, 'fixing')
    else:
        spindle_size = design.get('spindleSize', 8) / 1000
        spindle_length = design.get('spindleLength', design.get('doorThickness', 44) + 56) / 1000
        if len(sides) == 1:
            spindle_start, spindle_end = -face, min(spindle_length - face, face + projection * 0.6)
        else:
            spindle_start, spindle_end = -spindle_length / 2, spindle_length / 2
        outline = rounded_rectangle(spindle_size, spindle_size, 0.0003, steps=2)
        add_object(str(design.get('spindleSize', 8)) + ' mm square spindle', prism(outline, spindle_start, spindle_end), fixing_material, 'spindle')
    view_distance, view_height = max(0.6, length * 2), 0.0

# --- scene finishing --------------------------------------------------------

bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.length_unit = 'MILLIMETERS'
for obj in bpy.context.view_layer.objects:
    obj.select_set(False)
for obj in collection.objects:
    obj['Aperture design'] = json.dumps(design)
    obj.select_set(True)
bpy.context.view_layer.objects.active = collection.objects[0]
screen = bpy.context.screen
for area in screen.areas if screen else []:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_distance = view_distance
        area.spaces.active.region_3d.view_location = (0, 0, view_height)
print('Created ' + collection_name + ' with ' + str(len(collection.objects)) + ' editable objects.')
