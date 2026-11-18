import json
import math
from pathlib import Path
from build123d import Box, Cylinder, Compound, Vector, Axis, export_step
import ezdxf


def cylinder_between(start, end, radius):
    a, b = Vector(*start), Vector(*end)
    direction = b - a
    solid = Cylinder(radius, direction.length)
    # Build123d cylinders are Z-aligned; rotate Z onto the requested vector.
    z_axis = Vector(0, 0, 1)
    axis = z_axis.cross(direction)
    if axis.length > 0.000001:
        angle = math.degrees(z_axis.get_angle(direction))
        solid = solid.rotate(Axis((0, 0, 0), axis), angle)
    return solid.translate(a + direction / 2)


def build_handle(spec):
    dims = spec['global_dimensions_mm']
    length = dims['overall_length']
    projection = dims['projection_depth']
    radius = dims['grip_diameter'] / 2
    rose_radius = dims['rose_diameter'] / 2
    thickness = spec['door_interface']['door_thickness_dt_mm']
    parts = []
    for side in [1, -1]:
        z = side * thickness / 2
        points = [(-length / 2, 0, z), (-length / 2, 0, z + side * projection), (length / 2, 0, z + side * projection), (length / 2, 0, z)]
        for index in range(3):
            parts.append(cylinder_between(points[index], points[index + 1], radius))
        for x in [-length / 2, length / 2]:
            parts.append(Cylinder(rose_radius, 6).translate((x, 0, z)))
    spindle = spec['door_interface'].get('spindle')
    if spindle:
        size = spindle['size_mm']
        parts.append(Box(size, size, spindle['length_mm']))
    return Compound(children=parts)


def build_door(spec):
    dims = spec['global_dimensions_mm']
    return Box(dims['width'], dims['thickness'], dims['height'])


def generate(spec, output_dir):
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    model = build_door(spec) if spec['archetype'] == 'architectural_door_leaf' else build_handle(spec)
    stem = spec['design_id']
    step_path = output / f'{stem}.step'
    dxf_path = output / f'{stem}.dxf'
    export_step(model, str(step_path))
    drawing = ezdxf.new('R2010')
    drawing.units = ezdxf.units.MM
    layout = drawing.modelspace()
    if spec['archetype'] == 'architectural_door_leaf':
        dims = spec['global_dimensions_mm']
        layout.add_lwpolyline([(0, 0), (dims['width'], 0), (dims['width'], dims['height']), (0, dims['height'])], close=True)
    else:
        dims = spec['global_dimensions_mm']
        pitch = dims['center_to_center_pitch']
        for x in [-pitch / 2, pitch / 2]:
            layout.add_circle((x, 0), 5)
            layout.add_circle((x, 0), dims['rose_diameter'] / 2)
        layout.add_line((-pitch / 2, 0), (pitch / 2, 0))
    drawing.saveas(str(dxf_path))
    return {'step': step_path.name, 'dxf': dxf_path.name, 'volume_mm3': model.volume, 'solid_count': len(model.solids())}


if __name__ == '__main__':
    import sys
    spec = json.loads(sys.stdin.read())
    print(json.dumps(generate(spec, sys.argv[1])))
