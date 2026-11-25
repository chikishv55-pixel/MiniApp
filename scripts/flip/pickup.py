# Старый пикап для «Перекупщика Джо» — low-poly модель, собирается целиком из этого скрипта.
# Запуск в Blender (через MCP или Text Editor):  exec(open(r"D:\MiniApp\scripts\flip\pickup.py").read())
# Создаёт отдельную сцену "Flip_Pickup" (сцену пользователя не трогает) и экспортирует
# public/games/flip/pickup.glb.
#
# Имена объектов — контракт с flip.html:
#   Body   — кузов, единая UV-развёртка: по ней игра рисует ржавчину, грязь и краску
#   Glass, Tire, Chrome, Headlight, Tail, Dark — остальные детали, у каждой свой материал
import bpy, bmesh, os
from math import pi

OUT = os.path.join(os.path.dirname(bpy.data.filepath) if False else r"D:\MiniApp", "public", "games", "flip", "pickup.glb")
SCENE = "Flip_Pickup"

# ---------- сцена ----------
old = bpy.data.scenes.get(SCENE)
if old:
    for o in list(old.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.scenes.remove(old)
bpy.data.orphans_purge(do_recursive=True)  # меши прошлого запуска, чтобы имена не уезжали в .001
sc = bpy.data.scenes.new(SCENE)
bpy.context.window.scene = sc
col = sc.collection


def mat(name, rgb, metal=0.0, rough=0.6, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Alpha"].default_value = alpha
    return m


M = {
    "Body": mat("Body", (0.55, 0.12, 0.08), 0.1, 0.5),
    "Glass": mat("Glass", (0.12, 0.18, 0.22), 0.0, 0.1, 0.6),
    "Tire": mat("Tire", (0.04, 0.04, 0.04), 0.0, 0.9),
    "Chrome": mat("Chrome", (0.8, 0.8, 0.8), 1.0, 0.25),
    "Headlight": mat("Headlight", (0.95, 0.92, 0.7), 0.0, 0.2),
    "Tail": mat("Tail", (0.7, 0.05, 0.03), 0.0, 0.3),
    "Dark": mat("Dark", (0.06, 0.06, 0.07), 0.3, 0.5),
}


def obj_from_bm(name, bm, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(M[material])
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    return o


def prism(name, pts, y0, y1, material):
    """Профиль (x, z) вытянут по Y от y0 до y1 — кузов «сбоку»."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y0, z)) for x, z in pts]
    b = [bm.verts.new((x, y1, z)) for x, z in pts]
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material)


def box(name, x0, x1, y0, y1, z0, z1, material):
    return prism(name, [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y0, y1, material)


def cyl(name, loc, r, depth, axis, material, verts=16):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=depth)
    o = obj_from_bm(name, bm, material)
    o.location = loc
    o.rotation_euler = {"X": (0, pi / 2, 0), "Y": (pi / 2, 0, 0), "Z": (0, 0, 0)}[axis]
    return o


def cutter(o, c):
    mod = o.modifiers.new("cut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = c
    sel(o)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(c, do_unlink=True)


def sel(*objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def plane(name, quad, material):
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in quad]
    bm.faces.new(vs)
    return obj_from_bm(name, bm, material)


# ---------- кузов: нижняя часть (капот + кузов-платформа) ----------
W = 0.95
lower = prism("Lower", [(-2.50, 0.40), (2.30, 0.40), (2.50, 0.55), (2.52, 0.95), (2.35, 1.08),
                        (0.80, 1.16), (-0.95, 1.16), (-2.50, 1.12)], -W, W, "Body")
# колёсные арки
for x in (1.55, -1.60):
    cutter(lower, cyl("arch", (x, 0, 0.42), 0.52, 2.4, "Y", "Body", 20))
# открытый кузов-платформа
cutter(lower, box("bed", -2.40, -1.05, -0.84, 0.84, 0.66, 2.0, "Body"))

# ---------- кабина ----------
CW = 0.86
cab = prism("Cab", [(-1.00, 1.10), (0.85, 1.10), (0.45, 1.80), (-0.92, 1.82)], -CW, CW, "Body")

# короба над задними колёсами внутри платформы (иначе шины видны сквозь вырез арки)
wells = [box("well", -2.10, -1.06, s * 0.84 if s < 0 else 0.55, -0.55 if s < 0 else 0.84, 0.60, 0.98, "Body")
         for s in (1, -1)]

body = lower
sel(body, cab, *wells)
bpy.ops.object.join()
body.name = "Body"
body.data.name = "Body"
sel(body)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.shade_flat()

# ---------- стёкла (чуть наружу от кабины, чтобы не мерцали) ----------
glass = []
for s in (1, -1):
    y = s * (CW + 0.004)
    q = [(-0.86, y, 1.22), (0.66, y, 1.22), (0.40, y, 1.70), (-0.80, y, 1.72)]
    glass.append(plane("g", q if s > 0 else list(reversed(q)), "Glass"))


def on_slope(xa, za, xb, zb, z, off):
    return xa + (xb - xa) * (z - za) / (zb - za) + off


ws = [(on_slope(0.85, 1.10, 0.45, 1.80, z, 0.006), y, z) for z, y in ((1.20, -0.74), (1.20, 0.74), (1.72, 0.74), (1.72, -0.74))]
glass.append(plane("g", ws, "Glass"))
rw = [(on_slope(-1.00, 1.10, -0.92, 1.82, z, -0.006), y, z) for z, y in ((1.24, 0.70), (1.24, -0.70), (1.72, -0.70), (1.72, 0.70))]
glass.append(plane("g", rw, "Glass"))
sel(*glass)
bpy.ops.object.join()
glass[0].name = "Glass"

# ---------- колёса ----------
parts = {"Tire": [], "Chrome": [], "Headlight": [], "Tail": [], "Dark": []}
for x in (1.55, -1.60):
    for s in (1, -1):
        parts["Tire"].append(cyl("t", (x, s * 0.80, 0.42), 0.42, 0.30, "Y", "Tire", 18))
        parts["Chrome"].append(cyl("h", (x, s * 0.955, 0.42), 0.22, 0.02, "Y", "Chrome", 12))

# бамперы, решётка, фары
parts["Chrome"].append(box("b", 2.44, 2.66, -0.98, 0.98, 0.36, 0.54, "Chrome"))
parts["Chrome"].append(box("b", -2.62, -2.44, -0.98, 0.98, 0.36, 0.52, "Chrome"))
parts["Dark"].append(box("gr", 2.48, 2.545, -0.42, 0.42, 0.62, 0.94, "Dark"))
for s in (1, -1):
    parts["Headlight"].append(cyl("l", (2.53, s * 0.66, 0.82), 0.12, 0.06, "X", "Headlight", 14))
    parts["Tail"].append(box("tl", -2.53, -2.49, s * 0.80 - 0.08, s * 0.80 + 0.08, 0.80, 1.00, "Tail"))
# днище, чтобы снизу не было видно пустоты под кузовом-платформой
parts["Dark"].append(box("fl", -2.38, -1.06, -0.82, 0.82, 0.64, 0.67, "Dark"))

for name, objs in parts.items():
    sel(*objs)
    bpy.ops.object.join()
    objs[0].name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.shade_flat()

# ---------- экспорт ----------
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_apply=True)
result = {
    "file": OUT,
    "bytes": os.path.getsize(OUT),
    "objects": {o.name: len(o.data.polygons) for o in sc.objects if o.type == "MESH"},
}
