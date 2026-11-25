# Инструменты для «Перекупщика Джо» — появляются под пальцем, когда трёшь машину.
#   exec(open(r"D:\MiniApp\scripts\flip\tools.py", encoding="utf-8").read())
# Экспорт: public/games/flip/tools.glb. Сцена "Flip_Tools".
#
# Контракт с игрой: объекты ToolBrush, ToolSponge, ToolSpray, ToolPolish (+ дочерний ToolPolishPad,
# крутится). Рабочая сторона инструмента — в начале координат, сам инструмент вверх по +Z (в three: +Y),
# длинная сторона вдоль X — игра разворачивает её по ходу движения пальца.
# Материал SprayPaint игра перекрашивает в выбранный цвет.
import bpy, bmesh, os
from math import pi, radians, cos, sin

OUT = r"D:\MiniApp\public\games\flip\tools.glb"
SCENE = "Flip_Tools"


def mat(name, rgb, metal=0.0, rough=0.6):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    return m


old = bpy.data.scenes.get(SCENE)
if old:
    for o in list(old.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.scenes.remove(old)
bpy.data.orphans_purge(do_recursive=True)
sc = bpy.data.scenes.new(SCENE)
bpy.context.window.scene = sc
col = sc.collection

M = {
    "Wood": mat("Wood", (0.45, 0.24, 0.10), 0.0, 0.7),
    "WoodDark": mat("WoodDark", (0.25, 0.12, 0.05), 0.0, 0.7),
    "Wire": mat("Wire", (0.55, 0.55, 0.55), 1.0, 0.35),
    "SpongeY": mat("SpongeY", (0.95, 0.75, 0.15), 0.0, 0.95),
    "SpongeG": mat("SpongeG", (0.15, 0.45, 0.20), 0.0, 0.95),
    "Can": mat("Can", (0.75, 0.75, 0.78), 1.0, 0.3),
    "SprayPaint": mat("SprayPaint", (0.8, 0.1, 0.1), 0.2, 0.35),
    "Cap": mat("Cap", (0.95, 0.95, 0.95), 0.0, 0.4),
    "Orange": mat("Orange", (0.95, 0.40, 0.08), 0.0, 0.45),
    "Black": mat("Black", (0.05, 0.05, 0.05), 0.0, 0.6),
    "Pad": mat("Pad", (0.95, 0.92, 0.85), 0.0, 1.0),
    "Brass": mat("Brass", (0.78, 0.62, 0.30), 1.0, 0.45),
    "Red": mat("Red", (0.85, 0.08, 0.06), 0.0, 0.45),
    "RedDark": mat("RedDark", (0.55, 0.04, 0.03), 0.0, 0.5),
}


def mk(name, bm, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(M[material])
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    return o


def box(name, cx, cy, cz, sx, sy, sz, material, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(cx, cy, cz), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect="EDGES", profile=0.5)
    return mk(name, bm, material)


def cyl(name, cx, cy, z0, z1, r, material, seg=20, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=z1 - z0)
    bmesh.ops.translate(bm, vec=(cx, cy, (z0 + z1) / 2), verts=bm.verts)
    return mk(name, bm, material)


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = objs[0]
    o.name = name
    o.data.name = name
    return o


# ---------- проволочная щётка (как обычная хозяйственная): изогнутая стальная планка, латунная щетина,
# красная пластиковая ручка с волнами под пальцы и отверстием для подвеса
import random
random.seed(7)


def prism_y(name, pts, y0, y1, material):
    bm = bmesh.new()
    a_ = [bm.verts.new((x, y0, z)) for x, z in pts]
    b_ = [bm.verts.new((x, y1, z)) for x, z in pts]
    bm.faces.new(list(reversed(a_)))
    bm.faces.new(b_)
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((a_[i], a_[j], b_[j], b_[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mk(name, bm, material)


# планка: ровная над щетиной, у ручки загибается вверх (профиль толщиной 3 мм)
spine_top = [(-0.15, 0.058), (0.10, 0.058), (0.14, 0.066), (0.17, 0.082), (0.195, 0.10)]
spine = [(x, z) for x, z in spine_top] + [(x + 0.004, z - 0.004) for x, z in reversed(spine_top)]
parts = [prism_y("spine", spine, -0.022, 0.022, "Wire")]
# бортики планки — П-образный профиль, обжимает щетину
parts += [box("lip", -0.025, s_ * 0.021, 0.05, 0.25, 0.004, 0.018, "Wire") for s_ in (1, -1)]
# щетина: пучки латунной проволоки с разбросом — «лохматая», как у настоящей
for i in range(16):
    for j in range(3):
        x = -0.14 + i * 0.0158 + random.uniform(-0.003, 0.003)
        y = -0.014 + j * 0.014 + random.uniform(-0.003, 0.003)
        h_ = 0.05 + random.uniform(-0.006, 0.006)
        t = box("w", x, y, 0.056 - h_ / 2, 0.007, 0.007, h_, "Brass")
        t.rotation_euler = (random.uniform(-0.18, 0.18), random.uniform(-0.18, 0.18), 0)
        parts.append(t)
# ручка: по нижнему краю прямая, сверху три волны под пальцы, кончик с крючком
x0, z0, L, ang = 0.18, 0.09, 0.27, radians(22)
top = [(0.0, 0.03), (0.04, 0.036), (0.07, 0.028), (0.10, 0.04), (0.13, 0.03), (0.16, 0.042), (0.19, 0.032), (0.23, 0.044), (0.27, 0.036)]
bot = [(0.27, -0.004), (0.24, -0.012), (0.0, -0.008)]
prof = [(u * cos(ang) - v * sin(ang) + x0, u * sin(ang) + v * cos(ang) + z0) for u, v in top + bot]
handle = prism_y("handle", prof, -0.017, 0.017, "Red")
hole = cyl("hole", 0, 0, -0.05, 0.05, 0.011, "Red", 14)
hole.rotation_euler = (radians(90), 0, 0)
hu, hv = 0.235, 0.016
hole.location = (hu * cos(ang) - hv * sin(ang) + x0, 0, hu * sin(ang) + hv * cos(ang) + z0)
mod = handle.modifiers.new("hole", "BOOLEAN")
mod.operation = "DIFFERENCE"
mod.object = hole
bpy.ops.object.select_all(action="DESELECT")
handle.select_set(True)
bpy.context.view_layer.objects.active = handle
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(hole, do_unlink=True)
parts.append(handle)
# рифление на боках ручки
for k in range(5):
    u = 0.05 + k * 0.022
    parts += [box("rib", u * cos(ang) + x0, s_ * 0.0175, u * sin(ang) + z0 + 0.012, 0.006, 0.002, 0.03, "RedDark") for s_ in (1, -1)]
for o in parts:
    if o.rotation_euler.x or o.rotation_euler.y:
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(rotation=True)
brush = join(parts, "ToolBrush")

# ---------- губка: жёлтая, снизу зелёный абразив
sponge = join([box("s", 0, 0, 0.055, 0.24, 0.15, 0.09, "SpongeY", 0.02),
               box("g", 0, 0, 0.007, 0.24, 0.15, 0.014, "SpongeG", 0.004)], "ToolSponge")

# ---------- баллончик: висит над поверхностью, распылитель вниз
spray = join([cyl("c", 0, 0, 0.30, 0.52, 0.045, "Can"),
              cyl("l", 0, 0, 0.34, 0.47, 0.0455, "SprayPaint"),
              cyl("d", 0, 0, 0.27, 0.30, 0.045, "Can", 20, 0.03),
              cyl("k", 0, 0, 0.235, 0.27, 0.022, "Cap", 12),
              cyl("n", 0, 0.012, 0.225, 0.24, 0.006, "Black", 6)], "ToolSpray")

# ---------- полировальная машинка: круг (крутится отдельно), корпус, ручка
body = join([cyl("bp", 0, 0, 0.035, 0.05, 0.085, "Black"),
             cyl("m", 0, 0, 0.05, 0.19, 0.055, "Orange"),
             box("hd", 0.10, 0, 0.215, 0.30, 0.06, 0.05, "Black", 0.01),
             box("hb", -0.05, 0, 0.215, 0.07, 0.07, 0.06, "Orange", 0.01)], "ToolPolish")
pad = cyl("ToolPolishPad", 0, 0, 0.0, 0.035, 0.095, "Pad", 24)
pad.data.name = "ToolPolishPad"
pad.parent = body
# метка на круге — чтобы было видно вращение
mark = box("pm", 0.06, 0, 0.036, 0.04, 0.012, 0.004, "Orange")
mark = join([pad, mark], "ToolPolishPad")
mark.parent = body

for i, o in enumerate((brush, sponge, spray, body)):
    o.location.x = i * 0.7  # для предпросмотра; при экспорте вернём в 0

for o in sc.objects:
    o.select_set(True)
saved = {o.name: o.location.copy() for o in (brush, sponge, spray, body)}
for o in (brush, sponge, spray, body):
    o.location = (0, 0, 0)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, use_active_scene=True,
                          export_normals=False, export_meshopt_compression_enable=True)
for o in (brush, sponge, spray, body):
    o.location = saved[o.name]
result = {"bytes": os.path.getsize(OUT), "objects": [o.name for o in sc.objects]}
