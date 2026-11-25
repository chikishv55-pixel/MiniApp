# Гараж «Перекуп Джо» — 3D-фон, по мотивам советского гаража: обшивка вагонкой, крашеный дощатый пол,
# стеллажи, верстак, покрышки, плакаты, перфощит с инструментом, железные ворота.
#   exec(open(r"D:\MiniApp\scripts\flip\garage.py", encoding="utf-8").read())
# Экспорт: public/games/flip/garage.glb (сцена "Flip_Garage", сцену пользователя не трогает).
#
# Контракт с игрой — имена объектов G_<стена>_<материал>:
#   стена: F (перед машины, +X, ворота), B (зад, −X), L (+Y), R (−Y), T (потолок), C (пол и всё остальное).
#   Игра прячет стену вместе со всем, что на ней висит, когда камера смотрит на неё снаружи («кукольный домик»).
import bpy, bmesh, os, random
from math import pi, radians, cos, sin
from mathutils import Matrix, Vector

OUT = r"D:\MiniApp\public\games\flip\garage.glb"
SCENE = "Flip_Garage"
X0, X1, Y0, Y1, H = -4.2, 4.2, -2.9, 2.9, 2.8  # внутренние размеры гаража, м
random.seed(51)


def mat(name, rgb, metal=0.0, rough=0.7, emit=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = 3.0
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
    "WoodA": mat("WoodA", (0.74, 0.50, 0.22)), "WoodB": mat("WoodB", (0.66, 0.43, 0.18)), "WoodC": mat("WoodC", (0.80, 0.57, 0.27)),
    "WoodDark": mat("WoodDark", (0.32, 0.20, 0.11)),
    "FloorA": mat("FloorA", (0.62, 0.27, 0.06), 0.0, 0.32), "FloorB": mat("FloorB", (0.56, 0.23, 0.05), 0.0, 0.32),
    "Metal": mat("Metal", (0.55, 0.57, 0.58), 0.8, 0.45), "Gate": mat("Gate", (0.50, 0.53, 0.55), 0.6, 0.55),
    "Dark": mat("Dark", (0.05, 0.05, 0.06), 0.2, 0.6), "Tire": mat("Tire", (0.04, 0.04, 0.04), 0.0, 0.9),
    "Red": mat("Red", (0.62, 0.06, 0.05), 0.0, 0.8), "Blue": mat("Blue", (0.10, 0.30, 0.75), 0.0, 0.5),
    "Jacket": mat("Jacket", (0.08, 0.22, 0.50), 0.0, 0.9), "Paper": mat("Paper", (0.86, 0.84, 0.78), 0.0, 0.9),
    "Ink": mat("Ink", (0.15, 0.14, 0.13), 0.0, 0.9), "Box": mat("Box", (0.55, 0.40, 0.24), 0.0, 0.9),
    "Yellow": mat("Yellow", (0.85, 0.62, 0.10), 0.0, 0.6), "Green": mat("Green", (0.20, 0.40, 0.22), 0.0, 0.6),
    "White": mat("White", (0.92, 0.92, 0.90), 0.0, 0.6), "Rug": mat("Rug", (0.45, 0.16, 0.10), 0.0, 1.0),
    "Lamp": mat("Lamp", (1.0, 0.92, 0.7), 0.0, 0.3, emit=(1.0, 0.85, 0.6)),
}
G = {}  # (стена, материал) -> [объекты]


def add(wall, material, o):
    o.data.materials.clear()
    o.data.materials.append(M[material])
    G.setdefault((wall, material), []).append(o)
    return o


def mk(bm, name="m"):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    return o


def box(wall, material, x0, x1, y0, y1, z0, z1, rot=None, piv=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)), verts=bm.verts)
    if rot is not None:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
    bmesh.ops.translate(bm, vec=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), verts=bm.verts)
    return add(wall, material, mk(bm))


def cyl(wall, material, loc, r, h, axis="Z", seg=16, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    rot = {"X": Matrix.Rotation(pi / 2, 3, "Y"), "Y": Matrix.Rotation(pi / 2, 3, "X"), "Z": Matrix.Identity(3)}[axis]
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
    bmesh.ops.translate(bm, vec=loc, verts=bm.verts)
    return add(wall, material, mk(bm))


def tire(wall, loc, r, w, axis="Z", rim=False):
    cyl(wall, "Tire", loc, r, w, axis, 18)
    cyl(wall, "Dark", loc, r * 0.62, w + 0.004, axis, 14)
    if rim:
        cyl(wall, "Metal", loc, r * 0.56, w * 0.6 + 0.01, axis, 14)


wood = lambda: random.choice(["WoodA", "WoodB", "WoodC"])

# ---------------------------------------------------------------- пол: крашеные доски вдоль гаража
bw = 0.16
y = Y0
while y < Y1 - 0.001:
    y2 = min(Y1, y + bw - 0.006)
    box("C", random.choice(["FloorA", "FloorB"]), X0, X1, y, y2, -0.04, 0.0)
    y += bw
box("C", "Dark", X0, X1, Y0, Y1, -0.06, -0.039)  # щели между досками
box("C", "Rug", 2.6, 3.9, -0.8, 0.8, 0.0, 0.008)  # коврик у ворот

# ---------------------------------------------------------------- стены: вертикальная вагонка
def lining(wall, axis, fixed, a0, a1, inward):
    a = a0
    while a < a1 - 0.001:
        a2 = min(a1, a + 0.13)
        t0, t1 = (fixed, fixed + inward * 0.03)
        lo, hi = min(t0, t1), max(t0, t1)
        if axis == "X":  # доска стоит вдоль Y-стены, раскладка по X
            box(wall, wood(), a, a2 - 0.006, lo, hi, 0, H)
        else:
            box(wall, wood(), lo, hi, a, a2 - 0.006, 0, H)
        a += 0.13
    # тёмная подложка — в щелях
    if axis == "X":
        box(wall, "WoodDark", a0, a1, fixed + inward * 0.03, fixed + inward * 0.05, 0, H)
    else:
        box(wall, "WoodDark", fixed + inward * 0.03, fixed + inward * 0.05, a0, a1, 0, H)


lining("L", "X", Y1, X0, X1, 1)
lining("R", "X", Y0, X0, X1, -1)
lining("B", "Y", X0, Y0, Y1, -1)
# плинтусы и уголки
for w_, args in (("L", (X0, X1, Y1 - 0.04, Y1, 0, 0.1)), ("R", (X0, X1, Y0, Y0 + 0.04, 0, 0.1)), ("B", (X0, X0 + 0.04, Y0, Y1, 0, 0.1))):
    box(w_, "WoodDark", *args)

# ---------------------------------------------------------------- ворота (перед): две железные створки изнутри
gx = X1
box("F", "Gate", gx, gx + 0.04, Y0, Y1, 0, H)
for yy in (Y0 + 0.05, 0.0, Y1 - 0.05):  # рамы и стык створок
    box("F", "Metal", gx - 0.05, gx, yy - 0.04, yy + 0.04, 0, H)
for zz in (0.05, H / 2, H - 0.05):
    box("F", "Metal", gx - 0.05, gx, Y0, Y1, zz - 0.04, zz + 0.04)
for s in (1, -1):  # диагональные укосины
    L = ((Y1 - 0.1) ** 2 + (H / 2 - 0.1) ** 2) ** 0.5
    ang = (H / 2) / (Y1 - 0.1)
    for zc in (H * 0.25, H * 0.75):
        box("F", "Metal", gx - 0.04, gx, -L / 2, L / 2, -0.03, 0.03, rot=Matrix.Rotation(s * 0.65, 3, "X"))
        o = G[("F", "Metal")][-1]
        for v in o.data.vertices:
            v.co += Vector((0, s * Y1 / 2, zc - H / 2 * 0 - 0))
    cyl("F", "Red", (gx - 0.02, s * 1.45, 1.75), 0.16, 0.02, "X", 20)  # круглые знаки на створках
    cyl("F", "White", (gx - 0.032, s * 1.45, 1.75), 0.12, 0.02, "X", 20)
    cyl("F", "Red", (gx - 0.04, s * 1.45, 1.75), 0.1, 0.02, "X", 20)
box("F", "Dark", gx - 0.08, gx - 0.05, -0.05, 0.05, 1.0, 1.4)  # засов
box("F", "Metal", gx - 0.1, gx - 0.07, -0.3, 0.3, 1.18, 1.22)

# ---------------------------------------------------------------- потолок: доски и балки, лампы
y = Y0
while y < Y1 - 0.001:
    box("T", wood(), X0, X1, y, min(Y1, y + 0.2 - 0.008), H, H + 0.03)
    y += 0.2
for xx in (-2.8, -0.9, 1.0, 2.9):
    box("T", "WoodDark", xx - 0.07, xx + 0.07, Y0, Y1, H - 0.14, H)
box("T", "White", -1.2, 0.0, -0.05, 0.05, H - 0.2, H - 0.14)  # лампа дневного света
box("T", "Lamp", -1.15, -0.05, -0.03, 0.03, H - 0.23, H - 0.2)
cyl("C", "Dark", (1.0, 0.0, H - 0.25), 0.006, 0.5)  # лампочка на проводе
cyl("C", "Dark", (1.0, 0.0, H - 0.52), 0.03, 0.06)
cyl("C", "Lamp", (1.0, 0.0, H - 0.6), 0.05, 0.1, seg=12, r2=0.035)

# ---------------------------------------------------------------- задняя стена: верстак, стеллаж, покрышки
xb = X0 + 0.05
box("B", "WoodDark", xb, xb + 0.65, -1.4, 0.7, 0.82, 0.88)  # верстак
for yy in (-1.35, 0.65):
    for xx in (xb + 0.04, xb + 0.58):
        box("B", "Metal", xx - 0.025, xx + 0.025, yy - 0.025, yy + 0.025, 0, 0.82)
box("B", "WoodDark", xb, xb + 0.6, -1.4, 0.7, 0.2, 0.24)  # нижняя полка
box("B", "Dark", xb + 0.12, xb + 0.42, -1.2, -0.75, 0.88, 1.06)  # радиоприёмник
box("B", "Metal", xb + 0.41, xb + 0.43, -1.15, -0.95, 0.92, 1.02)
cyl("B", "Metal", (xb + 0.43, -0.85, 0.98), 0.03, 0.02, "X")
box("B", "Metal", xb + 0.3, xb + 0.5, 0.3, 0.5, 0.88, 0.98)  # тиски
box("B", "Metal", xb + 0.48, xb + 0.56, 0.36, 0.44, 0.9, 0.96)
for k, c in enumerate(["Red", "Yellow", "Blue", "Green", "Red"]):  # банки и коробки на нижней полке
    cyl("B", c, (xb + 0.25, -1.2 + k * 0.4, 0.33), 0.08, 0.18)
for zz in (1.35, 1.75, 2.15):  # полки над верстаком
    box("B", "WoodDark", xb, xb + 0.32, -1.4, 0.7, zz, zz + 0.03)
    for yy in (-1.3, 0.6):
        box("B", "Metal", xb, xb + 0.3, yy - 0.015, yy + 0.015, zz - 0.12, zz)
    yy = -1.3
    while yy < 0.5:
        k = random.random()
        if k < 0.45:
            w_ = random.uniform(0.18, 0.34)
            box("B", "Box", xb + 0.03, xb + 0.28, yy, yy + w_, zz + 0.03, zz + 0.03 + random.uniform(0.14, 0.3))
            yy += w_ + 0.04
        elif k < 0.8:
            cyl("B", random.choice(["Red", "Yellow", "Blue", "Green", "White"]), (xb + 0.15, yy + 0.06, zz + 0.12), 0.055, 0.18)
            yy += 0.14
        else:
            box("B", "Dark", xb + 0.05, xb + 0.28, yy, yy + 0.3, zz + 0.03, zz + 0.12)
            yy += 0.36
for k in range(4):  # стопка покрышек
    tire("B", (xb + 0.42, 1.95, 0.13 + k * 0.25), 0.33, 0.24)
tire("B", (xb + 0.95, 2.45, 0.34), 0.34, 0.22, "Y", rim=True)  # колёса с дисками у стены
tire("B", (xb + 1.65, 2.45, 0.34), 0.34, 0.22, "Y", rim=True)
box("B", "Jacket", xb, xb + 0.12, -2.45, -1.9, 1.25, 2.1)  # куртка на гвозде
box("B", "Jacket", xb, xb + 0.1, -2.62, -2.48, 1.5, 2.05)
box("B", "Jacket", xb, xb + 0.1, -1.87, -1.73, 1.5, 2.05)
cyl("B", "Dark", (xb + 0.02, -2.17, 2.15), 0.015, 0.06, "X")
for k, (yy, c) in enumerate(((1.0, "Red"), (1.55, "Blue"), (2.1, "Yellow"))):  # плакаты
    box("B", "Paper", xb, xb + 0.01, yy, yy + 0.42, 1.65, 2.25)
    box("B", c, xb + 0.008, xb + 0.014, yy + 0.05, yy + 0.37, 1.85, 2.2)
    box("B", "Ink", xb + 0.008, xb + 0.014, yy + 0.06, yy + 0.36, 1.7, 1.78)

# ---------------------------------------------------------------- левая стена: красное знамя, фотографии, лыжи, полка
yl = Y1 - 0.05
box("L", "Red", -2.9, -1.7, yl - 0.012, yl, 0.95, 2.35)  # знамя (без символики)
box("L", "Yellow", -2.85, -1.75, yl - 0.016, yl - 0.012, 2.25, 2.3)
cyl("L", "Metal", (-2.3, yl - 0.03, 2.37), 0.012, 1.3, "X")
for i in range(5):  # фото и вырезки
    for j in range(3):
        x = -1.2 + i * 0.42 + random.uniform(-0.04, 0.04)
        z = 1.25 + j * 0.38 + random.uniform(-0.04, 0.04)
        box("L", random.choice(["Paper", "Paper", "White"]), x, x + 0.28, yl - 0.008, yl, z, z + 0.32)
        box("L", "Ink", x + 0.03, x + 0.25, yl - 0.012, yl - 0.008, z + 0.1, z + 0.28)
for k in range(2):  # лыжи
    box("L", "Green", -3.9, -1.6, yl - 0.05 - k * 0.06, yl - 0.03 - k * 0.06, 2.45 - k * 0.12, 2.52 - k * 0.12)
box("L", "WoodDark", 1.4, 2.8, yl - 0.3, yl, 1.5, 1.53)  # полка с банками
for k in range(6):
    cyl("L", random.choice(["Green", "Paper", "Yellow"]), (1.5 + k * 0.22, yl - 0.15, 1.63), 0.06, 0.2)
box("L", "WoodC", 3.0, 3.9, yl - 0.45, yl, 0, 0.45)  # ящик в углу
box("L", "WoodDark", 3.0, 3.9, yl - 0.45, yl, 0.45, 0.48)

# ---------------------------------------------------------------- правая стена: перфощит с инструментом, воронка, знак, табурет
yr = Y0 + 0.05
box("R", "WoodDark", -1.6, 0.6, yr, yr + 0.02, 1.0, 2.1)  # перфощит
for k in range(7):  # ключи
    x = -1.4 + k * 0.12
    box("R", "Metal", x - 0.012, x + 0.012, yr + 0.02, yr + 0.035, 1.35, 1.6 + k * 0.03)
box("R", "Red", -0.4, -0.37, yr + 0.02, yr + 0.05, 1.3, 1.65)  # молоток
box("R", "Metal", -0.46, -0.31, yr + 0.02, yr + 0.06, 1.65, 1.71)
box("R", "Yellow", 0.0, 0.05, yr + 0.02, yr + 0.05, 1.25, 1.45)  # ножовка
box("R", "Metal", 0.0, 0.45, yr + 0.02, yr + 0.03, 1.45, 1.58)
for k in range(4):  # отвёртки
    x = -1.3 + k * 0.09
    box("R", random.choice(["Red", "Yellow", "Blue"]), x - 0.015, x + 0.015, yr + 0.02, yr + 0.05, 1.85, 1.95)
    box("R", "Metal", x - 0.005, x + 0.005, yr + 0.02, yr + 0.04, 1.7, 1.85)
cyl("R", "Blue", (1.3, yr + 0.18, 1.35), 0.17, 0.3, seg=14, r2=0.03)  # воронка
cyl("R", "Blue", (1.3, yr + 0.18, 1.12), 0.03, 0.18, seg=8)
cyl("R", "Red", (2.3, yr + 0.01, 1.8), 0.22, 0.02, "Y", 24)  # знак «ограничение 50»
cyl("R", "White", (2.3, yr + 0.022, 1.8), 0.17, 0.02, "Y", 24)
box("R", "Ink", 2.2, 2.25, yr + 0.03, yr + 0.035, 1.72, 1.88)
box("R", "Ink", 2.33, 2.42, yr + 0.03, yr + 0.035, 1.72, 1.88)
for i in range(4):  # фото
    for j in range(2):
        x = -3.6 + i * 0.36
        z = 1.4 + j * 0.42
        box("R", "Paper", x, x + 0.26, yr, yr + 0.008, z, z + 0.32)
        box("R", "Ink", x + 0.03, x + 0.23, yr + 0.008, yr + 0.012, z + 0.12, z + 0.28)
cyl("R", "WoodDark", (3.0, yr + 0.45, 0.62), 0.18, 0.04)  # табурет
for k in range(3):
    a = k * 2 * pi / 3
    cyl("R", "Metal", (3.0 + cos(a) * 0.12, yr + 0.45 + sin(a) * 0.12, 0.3), 0.015, 0.6)
cyl("R", "Metal", (3.7, yr + 0.3, 0.17), 0.14, 0.34, seg=14, r2=0.16)  # ведро
cyl("R", "WoodC", (3.95, yr + 0.18, 0.75), 0.015, 1.4)  # швабра
box("R", "Dark", 3.82, 4.08, yr + 0.12, yr + 0.24, 0.02, 0.08)

# ---------------------------------------------------------------- сборка по (стена, материал), экспорт
objs = []
for (w_, m_), lst in G.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in lst:
        o.select_set(True)
    bpy.context.view_layer.objects.active = lst[0]
    if len(lst) > 1:
        bpy.ops.object.join()
    o = lst[0]
    o.name = f"G_{w_}_{m_}"
    o.data.name = o.name
    objs.append(o)
bpy.ops.object.select_all(action="DESELECT")
for o in objs:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, use_active_scene=True,
                          export_normals=False, export_meshopt_compression_enable=True)
result = {"kb": round(os.path.getsize(OUT) / 1024), "objects": len(objs), "faces": sum(len(o.data.polygons) for o in objs)}
