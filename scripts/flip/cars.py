# Машины для «Перекупщика Джо» — low-poly, собираются целиком из этого скрипта.
# Запуск в Blender (через MCP или Text Editor):
#   exec(open(r"D:\MiniApp\scripts\flip\cars.py", encoding="utf-8").read())
# Создаёт сцену "Flip_Cars" (сцену пользователя не трогает), экспортирует public/games/flip/<id>.glb
# и расставляет машины рядами для предпросмотра. После — node scripts/flip/bake-vis.mjs.
#
# Машины — пародии «по мотивам» реальных (пропорции и характерные черты, без логотипов):
#   shiva — трёхдверный внедорожник-ветеран, vazel — развозной фургон с будкой, iaz — рамный пикап с двойной кабиной,
#   torolla / torollah — японские седан и хэтчбек нулевых, dmw3 — лифтбек-«гран туризмо», dmw5 — бизнес-седан,
#   sheroki — большой SUV, ranger — рамный внедорожник с круглыми фарами, coupe — маслкар.
# Габариты сверены с открытыми данными (длина, база, свесы, высота).
#
# Контракт с игрой — имена МАТЕРИАЛОВ:
#   Body  — кузов одним объектом с одной UV-развёрткой: по ней игра рисует грязь, ржавчину, краску, блеск
#   Glass — стёкла с UV (на них тоже бывает грязь)
#   Tire, Rim, Well — колёса и ниши за ними: трогать нельзя
#   Chrome, Headlight, Tail, Dark, Seat, Dash — остальное
import bpy, bmesh, os
from math import pi, radians, cos, sin
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

OUT_DIR = r"D:\MiniApp\public\games\flip"
SCENE = "Flip_Cars"
T = 0.05  # толщина стенок кабины

# ---------------------------------------------------------------- машины
# Профили — (x, z): x вперёд, z вверх, земля z=0. Кабина: [зад-низ, перед-низ, перед-верх, зад-верх].
# W — полуширина кузова, CW — полуширина кабины у пояса, tumble — насколько крыша уже пояса.
# endc — (скругление носа, скругление кормы) в плане, м.
# split — участки боковых окон по X (стойки между ними).
CARS = {
    "shiva": dict(  # 3740 / база 2200 / свесы 705+835 / высота 1640
        lower=[(-1.87, 0.40), (1.80, 0.40), (1.87, 0.50), (1.87, 0.80), (1.80, 0.90), (0.75, 1.02), (-1.87, 1.02)],
        W=0.84, endc=(0.10, 0.05), wheels=(1.165, -1.035), r=0.36, tw=0.22, arch=0.45, rim="steel", tread=True,
        cab=[(-1.85, 1.00), (0.78, 1.00), (0.22, 1.62), (-1.80, 1.64)], CW=0.80, tumble=0.10, floor=1.02,
        split=[(-9, -0.42), (-0.32, 9)], seams=[0.72, -0.37],
        front=1.87, rear=-1.87, bumper=("dark", 0.40, 0.56), lights=[("round", 0.74, 0.58, 0.085)],
        grille=("bars", 0.62, 0.86, 0.45), tail=("vert", 0.70, 1.00, 0.74), flares=("Body", 0.05),
        handles=[-0.30], seats="bucket", rear_seat=True),
    "vazel": dict(  # развозной фургон с будкой: ~5600 / база 3145 / высота 2750
        lower=[(0.55, 0.45), (2.92, 0.45), (3.00, 0.55), (3.00, 0.95), (2.90, 1.12), (2.12, 1.25), (0.55, 1.25)],
        W=0.98, endc=(0.10, 0.0), wheels=(2.05, -1.10), r=0.36, tw=0.22, arch=0.45, rim="steel", dual_rear=True,
        cab=[(0.55, 1.22), (2.15, 1.22), (1.55, 2.30), (0.60, 2.32)], CW=0.96, tumble=0.08, floor=1.25,
        split=[(0.95, 9)], rear_window=False, seams=[2.05, 0.62],
        box=(-2.80, 0.48, 1.04, 0.95, 2.75),
        front=3.00, rear=-2.80, bumper=("dark", 0.45, 0.62), lights=[("plate", 0.80, 0.68, (0.19, 0.075, 0.08, "proj"))],
        grille=("bars", 0.64, 0.92, 0.46), tail=("rect", 1.00, 1.22, 0.86), handles=[0.70], seats="bench", rear_seat=False),
    "iaz": dict(  # рамный пикап с двойной кабиной: 5125 / база 3000 / высота 1915
        lower=[(-2.56, 0.50), (2.48, 0.50), (2.56, 0.62), (2.56, 1.00), (2.45, 1.12), (0.95, 1.20), (-2.56, 1.22)],
        W=0.95, endc=(0.10, 0.03), wheels=(1.66, -1.34), r=0.385, tw=0.26, arch=0.48, rim="off", tread=True,
        cab=[(-1.00, 1.18), (0.98, 1.18), (0.32, 1.88), (-0.98, 1.90)], CW=0.90, tumble=0.08, floor=1.20,
        split=[(-9, -0.08), (0.02, 9)], seams=[0.92, -0.05, -0.97], bed=(-2.48, -1.05, 0.86, 0.72),
        front=2.56, rear=-2.56, bumper=("dark", 0.50, 0.72), lights=[("plate", 0.90, 0.63, (0.17, 0.075, 0.03, "round2"))],
        fog=(0.60, 0.66, 0.05), grille=("mesh", 0.74, 1.05, 0.40), tail=("vert", 0.86, 1.18, 0.82),
        flares=("Dark", 0.07), steps=True, roofrails=True, handles=[0.30, -0.68], seats="bucket", rear_seat=True),
    "torolla": dict(  # седан: 4530 / база 2600 / высота 1490
        lower=[(-2.22, 0.32), (2.18, 0.30), (2.265, 0.42), (2.26, 0.66), (2.10, 0.78), (0.95, 0.90), (-1.55, 0.96),
               (-2.18, 0.94), (-2.265, 0.80), (-2.26, 0.50)],
        W=0.85, endc=(0.13, 0.08), endl=0.9, wheels=(1.385, -1.215), r=0.315, tw=0.21, arch=0.38, rim="alloy5",
        cab=[(-1.62, 0.90), (0.98, 0.90), (0.12, 1.47), (-0.95, 1.48)], CW=0.80, tumble=0.14, floor=0.92,
        split=[(-0.36, 9), (-9, -0.46)], seams=[0.92, -0.40, -1.25],
        front=2.265, rear=-2.265, lip=(0.32, 0.46, 0.50), lights=[("plate", 0.56, 0.52, (0.17, 0.06, 0.05, "proj"))],
        grille=("bars", 0.55, 0.70, 0.30), tail=("wrap", 0.72, 0.88, 0.66), handles=[0.25, -0.62],
        seats="bucket", rear_seat=True, antenna=True),
    "torollah": dict(  # хэтчбек 5-дверный: 4180 / база 2600 / высота 1470
        lower=[(-2.05, 0.32), (2.02, 0.30), (2.09, 0.42), (2.08, 0.66), (1.94, 0.78), (0.80, 0.90), (-2.05, 0.96),
               (-2.09, 0.70), (-2.08, 0.45)],
        W=0.85, endc=(0.13, 0.08), endl=0.9, wheels=(1.21, -1.39), r=0.315, tw=0.21, arch=0.38, rim="alloy5",
        cab=[(-2.02, 0.90), (0.82, 0.90), (-0.02, 1.46), (-1.75, 1.48)], CW=0.80, tumble=0.14, floor=0.92,
        split=[(-0.52, 9), (-1.42, -0.62), (-9, -1.52)], seams=[0.78, -0.56, -1.48],
        front=2.09, rear=-2.09, lip=(0.32, 0.46, 0.50), lights=[("plate", 0.56, 0.52, (0.17, 0.06, 0.05, "proj"))],
        grille=("bars", 0.55, 0.68, 0.30), tail=("vert", 0.80, 1.02, 0.66), handles=[0.10, -0.80],
        seats="bucket", rear_seat=True),
    "dmw3": dict(  # лифтбек «гран туризмо»: 4824 / база 2920 / высота 1508
        lower=[(-2.38, 0.32), (2.34, 0.30), (2.41, 0.42), (2.40, 0.64), (2.25, 0.76), (1.00, 0.90), (-1.90, 0.98),
               (-2.36, 0.96), (-2.41, 0.78), (-2.40, 0.48)],
        W=0.91, endc=(0.13, 0.10), endl=1.0, wheels=(1.59, -1.33), r=0.335, tw=0.23, arch=0.40, rim="multi",
        cab=[(-2.25, 0.92), (1.02, 0.92), (0.05, 1.49), (-1.05, 1.50)], CW=0.84, tumble=0.16, floor=0.94,
        split=[(-0.48, 9), (-1.40, -0.56), (-9, -1.50)], seams=[1.00, -0.52, -1.45],
        front=2.41, rear=-2.41, lip=(0.32, 0.48, 0.62), lights=[("plate", 0.56, 0.58, (0.17, 0.05, 0.025, "angel"))],
        grille=("kidney", 0.50, 0.78, 0.34), tail=("wrap", 0.80, 0.93, 0.70), handles=[0.30, -0.70],
        seats="bucket", rear_seat=True),
    "dmw5": dict(  # бизнес-седан: 4936 / база 2975 / высота 1479
        lower=[(-2.44, 0.32), (2.40, 0.30), (2.47, 0.42), (2.46, 0.64), (2.30, 0.76), (1.05, 0.89), (-1.70, 0.98),
               (-2.40, 0.97), (-2.47, 0.80), (-2.46, 0.48)],
        W=0.93, endc=(0.13, 0.10), endl=1.0, wheels=(1.61, -1.365), r=0.34, tw=0.24, arch=0.41, rim="multi",
        cab=[(-1.85, 0.92), (1.08, 0.92), (0.10, 1.47), (-1.10, 1.48)], CW=0.86, tumble=0.16, floor=0.94,
        split=[(-0.42, 9), (-1.25, -0.50), (-9, -1.33)], seams=[1.05, -0.46, -1.30],
        front=2.47, rear=-2.47, lip=(0.32, 0.48, 0.66), lights=[("plate", 0.555, 0.61, (0.17, 0.052, 0.02, "angel"))],
        grille=("kidney", 0.49, 0.80, 0.38), tail=("wrap", 0.80, 0.94, 0.70), handles=[0.35, -0.68],
        seats="bucket", rear_seat=True),
    "sheroki": dict(  # большой SUV: 4828 / база 2915 / высота 1792
        lower=[(-2.38, 0.48), (2.34, 0.46), (2.415, 0.58), (2.40, 0.92), (2.25, 1.04), (1.05, 1.12), (-2.38, 1.16),
               (-2.415, 0.95), (-2.40, 0.62)],
        W=0.95, endc=(0.13, 0.08), endl=0.9, wheels=(1.495, -1.42), r=0.375, tw=0.25, arch=0.46, rim="alloy5",
        cab=[(-2.38, 1.12), (1.08, 1.12), (0.20, 1.74), (-2.15, 1.76)], CW=0.88, tumble=0.14, floor=1.14,
        split=[(-0.38, 9), (-1.40, -0.48), (-9, -1.50)], seams=[1.05, -0.42, -1.45],
        front=2.415, rear=-2.415, lip=(0.46, 0.62, 0.70), lights=[("plate", 0.86, 0.62, (0.17, 0.05, 0.0, "proj"))],
        grille=("slots7", 0.78, 1.02, 0.40), tail=("wrap", 0.95, 1.12, 0.74), cladding=True, roofrails=True,
        handles=[0.35, -0.75], seats="bucket", rear_seat=True),
    "ranger": dict(  # рамный внедорожник 4 двери: 4785 / база 3008 / высота 1840
        lower=[(-2.30, 0.55), (2.20, 0.55), (2.30, 0.65), (2.30, 1.05), (2.25, 1.15), (0.90, 1.18), (-2.30, 1.18)],
        W=0.90, endc=(0.05, 0.03), wheels=(1.59, -1.42), r=0.40, tw=0.28, arch=0.50, rim="off", tread=True,
        cab=[(-2.30, 1.16), (0.92, 1.16), (0.55, 1.84), (-2.28, 1.86)], CW=0.88, tumble=0.04, floor=1.18,
        split=[(-0.30, 9), (-1.50, -0.40), (-9, -1.60)], seams=[0.90, -0.35, -1.55], hinges=True,
        front=2.30, rear=-2.30, bumper=("dark", 0.48, 0.72), lights=[("round", 0.98, 0.60, 0.11)],
        grille=("slots7", 0.80, 1.12, 0.44), tail=("vert", 0.92, 1.12, 0.82), flares=("Dark", 0.11), steps=True,
        spare=True, handles=[0.25, -0.85], seats="bucket", rear_seat=True),
    "coupe": dict(  # маслкар
        lower=[(-2.40, 0.34), (2.35, 0.34), (2.50, 0.46), (2.52, 0.78), (2.38, 0.90), (0.70, 0.96), (-2.30, 0.96), (-2.45, 0.75)],
        W=0.95, endc=(0.10, 0.06), wheels=(1.55, -1.55), r=0.37, tw=0.26, arch=0.45, rim="alloy5",
        cab=[(-1.90, 0.94), (0.75, 0.94), (0.15, 1.42), (-0.70, 1.44)], CW=0.84, tumble=0.12, floor=0.96,
        split=None, seams=[0.70, -0.75],
        front=2.51, rear=-2.43, bumper=("chrome", 0.32, 0.46), lights=[("round", 0.64, 0.66, 0.09)],
        grille=("mesh", 0.48, 0.76, 0.48), tail=("rect", 0.58, 0.76, 0.70), handles=[-0.45], seats="bucket", rear_seat=False,
        extras=[("Body", 1.00, 1.60, -0.22, 0.22, 0.90, 1.03),   # воздухозаборник на капоте
                ("Dark", -2.40, -2.18, -0.86, 0.86, 1.07, 1.11),  # спойлер
                ("Dark", -2.32, -2.26, 0.60, 0.66, 0.94, 1.08),
                ("Dark", -2.32, -2.26, -0.66, -0.60, 0.94, 1.08)]),
}

# ---------------------------------------------------------------- материалы


def mat(name, rgb, metal=0.0, rough=0.6, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Alpha"].default_value = alpha
    return m


def make_materials():
    return {
        "Body": mat("Body", (0.55, 0.12, 0.08), 0.1, 0.5),
        "Glass": mat("Glass", (0.35, 0.45, 0.5), 0.0, 0.05, 0.3),
        "Tire": mat("Tire", (0.04, 0.04, 0.04), 0.0, 0.9),
        "Rim": mat("Rim", (0.7, 0.7, 0.72), 0.9, 0.3),
        "Well": mat("Well", (0.02, 0.02, 0.02), 0.0, 1.0),
        "Chrome": mat("Chrome", (0.8, 0.8, 0.8), 1.0, 0.25),
        "Headlight": mat("Headlight", (0.95, 0.92, 0.7), 0.0, 0.2),
        "Tail": mat("Tail", (0.7, 0.05, 0.03), 0.0, 0.3),
        "Dark": mat("Dark", (0.06, 0.06, 0.07), 0.3, 0.5),
        "Seat": mat("Seat", (0.35, 0.18, 0.08), 0.0, 0.7),
        "Dash": mat("Dash", (0.12, 0.10, 0.09), 0.0, 0.6),
    }


M = {}
col = None

# ---------------------------------------------------------------- геометрия


def obj_from_bm(name, bm, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(M[material])
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    return o


def prism(name, pts, wf, material):
    """Профиль (x, z), вытянутый по Y. wf — (y0, y1) или функция полуширины hw(x, z) (симметрично)."""
    bm = bmesh.new()
    if callable(wf):
        a = [bm.verts.new((x, -wf(x, z), z)) for x, z in pts]
        b = [bm.verts.new((x, wf(x, z), z)) for x, z in pts]
    else:
        a = [bm.verts.new((x, wf[0], z)) for x, z in pts]
        b = [bm.verts.new((x, wf[1], z)) for x, z in pts]
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material)


def box(name, x0, x1, y0, y1, z0, z1, material, bevel=0.0, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect="EDGES", profile=0.5, clamp_overlap=True)
    if rot is not None:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
    bmesh.ops.translate(bm, vec=Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)), verts=bm.verts)
    return obj_from_bm(name, bm, material)


def cyl(name, loc, r, depth, axis, material, verts=16, bevel=0.0, tilt=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=depth)
    if bevel:  # скруглённые боковины шины
        rim_edges = [e for e in bm.edges if all(abs(abs(v.co.z) - depth / 2) < 1e-5 for v in e.verts)
                     and all((v.co.x ** 2 + v.co.y ** 2) ** 0.5 > r * 0.99 for v in e.verts)]
        bmesh.ops.bevel(bm, geom=rim_edges, offset=bevel, segments=1, affect="EDGES", profile=0.5, clamp_overlap=True)
    rot = {"X": Matrix.Rotation(pi / 2, 3, "Y"), "Y": Matrix.Rotation(pi / 2, 3, "X"), "Z": Matrix.Identity(3)}[axis]
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
    if tilt is not None:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=tilt)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    return obj_from_bm(name, bm, material)


def torus(name, loc, R, r, rot, material, seg=20):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=8,
                                     location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(M[material])
    for c_ in list(o.users_collection):
        c_.objects.unlink(o)
    col.objects.link(o)
    return o


def poly(name, pts3, material):
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(p) for p in pts3])
    return obj_from_bm(name, bm, material)


def sel(*objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def cutter(o, c):
    mod = o.modifiers.new("cut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = c
    sel(o)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(c, do_unlink=True)


def join(objs, name):
    objs = [o for o in objs if o]
    sel(*objs)
    if len(objs) > 1:
        bpy.ops.object.join()
    o = objs[0]
    o.name = name
    o.data.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.shade_flat()
    return o


def unwrap(o):
    sel(o)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def edge_x(p0, p1, z):
    return p0[0] + (p1[0] - p0[0]) * (z - p0[1]) / (p1[1] - p0[1])


def hthick(p0, p1):
    dx, dz = p1[0] - p0[0], p1[1] - p0[1]
    return T * (dx * dx + dz * dz) ** 0.5 / abs(dz)


def outward(p0, p1):
    dx, dz = p1[0] - p0[0], p1[1] - p0[1]
    L = (dx * dx + dz * dz) ** 0.5
    return dz / L, -dx / L


def inset(pts, d):
    n = len(pts)
    lines = []
    for i in range(n):
        (x0, z0), (x1, z1) = pts[i], pts[(i + 1) % n]
        nx, nz = outward(pts[i], pts[(i + 1) % n])
        lines.append(((x0 - nx * d, z0 - nz * d), (x1 - x0, z1 - z0)))
    out = []
    for i in range(n):
        (p, u), (q, v) = lines[i - 1], lines[i]
        den = u[0] * v[1] - u[1] * v[0]
        t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / den
        out.append((p[0] + t * u[0], p[1] + t * u[1]))
    return out


def clip_x(pts, a, b):
    def clip(pts, keep, X):
        out = []
        for i in range(len(pts)):
            p, q = pts[i], pts[(i + 1) % len(pts)]
            if keep(p):
                out.append(p)
            if keep(p) != keep(q):
                out.append((X, p[1] + (q[1] - p[1]) * (X - p[0]) / (q[0] - p[0])))
        return out
    pts = clip(pts, lambda p: p[0] >= a, a)
    return clip(pts, lambda p: p[0] <= b, b) if pts else []


def clamp01(v):
    return max(0.0, min(1.0, v))


def spin(name, cx, cy, cz, ang, L, w, t, r0, material):
    """Брусок от радиуса r0 до r0+L, повёрнутый вокруг оси Y на ang (колёсные спицы, протектор)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(L, t, w), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(r0 + L / 2, 0, 0), verts=bm.verts)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(ang, 3, "Y"))
    bmesh.ops.translate(bm, vec=(cx, cy, cz), verts=bm.verts)
    return obj_from_bm(name, bm, material)


def side_box(name, x0, x1, y, out, z0, z1, s, material, bevel=0.0):
    """Накладка на борт: от y-in внутрь до y+out наружу, зеркально для s=-1."""
    if s > 0:
        return box(name, x0, x1, y - 0.01, y + out, z0, z1, material, bevel)
    return box(name, x0, x1, -y - out, -y + 0.01, z0, z1, material, bevel)


# ---------------------------------------------------------------- колесо


def radial(name, cx, cz, ang, r0, r1, w0, w1, y0, y1, material, lift=0.0):
    """Брусок в плоскости колеса: от радиуса r0 (ширина w0) до r1 (ширина w1), по оси колеса y0..y1.
    lift — насколько внутренний конец выступает наружу (выпуклые спицы)."""
    ux, uz = cos(ang), sin(ang)
    tx, tz = -uz, ux
    bm = bmesh.new()
    vs = []
    for yy in (y0, y1):
        for rr, ww, dl in ((r0, w0, lift), (r1, w1, 0.0)):
            for sg in (-1, 1):
                vs.append(bm.verts.new((cx + rr * ux + sg * ww * tx, yy + (dl if yy == y1 else 0.0), cz + rr * uz + sg * ww * tz)))
    # vs: [y0: r0-, r0+, r1-, r1+], [y1: ...]
    q = lambda a, b, c_, d: bm.faces.new((vs[a], vs[b], vs[c_], vs[d]))
    q(0, 1, 3, 2); q(4, 6, 7, 5); q(0, 2, 6, 4); q(1, 5, 7, 3); q(0, 4, 5, 1); q(2, 3, 7, 6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material)


def wheel(G, c, x, s, inner=False):
    """Колесо: шина со скруглёнными боковинами и протектором, литой/штампованный диск, тормоз за спицами."""
    r, tw, W = c["r"], c.get("tw", 0.22), c["W"]
    kind = c.get("rim", "steel")
    off = kind == "off" or c.get("tread")
    yc = s * (W - 0.01 - tw / 2)
    if inner:  # второе колесо спарки
        yc -= s * (tw + 0.03)
    ri = r * (0.6 if off else 0.66)  # радиус обода: у внедорожной резины боковина выше
    # шина — кольцо (сплющенный тор): круглые боковины, а в середине виден диск
    m = (r - ri) / 2
    t = torus("t", (x, yc, r), ri + m, m, (pi / 2, 0, 0), "Tire", 28)
    t.scale = (1, 1, (tw / 2) / m)
    G["Tire"].append(t)
    if off:  # грунтозацепы в шахматку
        n = 18
        for k in range(n):
            a = k * 2 * pi / n
            for row, sh in ((-1, 0.0), (1, pi / n)):
                y0, y1 = (yc + row * tw * 0.04, yc + row * tw * 0.47) if row > 0 else (yc - tw * 0.47, yc - tw * 0.04)
                G["Tire"].append(radial("lug", x, r, a + sh, r - 0.03, r + 0.012, 0.045, 0.04, min(y0, y1), max(y0, y1), "Tire"))
    if inner:
        return
    face = yc + s * (tw / 2 - 0.03)  # плоскость лица диска (утоплена в шину)
    # тормоз: диск и суппорт видны сквозь спицы
    G["Chrome"].append(cyl("brake", (x, face - s * 0.07, r), ri * 0.78, 0.02, "Y", "Chrome", 20))
    cal = "Tail" if kind == "multi" else "Dark"
    G[cal].append(radial("caliper", x, r, radians(115), ri * 0.5, ri * 0.82, 0.07, 0.09,
                         min(face - s * 0.1, face - s * 0.045), max(face - s * 0.1, face - s * 0.045), cal))
    # обод: глубокая «бочка» и полированная кромка
    G["Dark"].append(cyl("barrel", (x, face - s * 0.05, r), ri - 0.005, 0.1, "Y", "Dark", 24))
    G["Rim"].append(torus("lip", (x, face, r), ri - 0.012, 0.016, (pi / 2, 0, 0), "Rim", 28))
    yA, yB = sorted((face - s * 0.02, face))
    if kind == "steel":  # штамповка: тарелка с отверстиями, выпуклое кольцо, ступица
        G["Rim"].append(cyl("dish", (x, face - s * 0.012, r), ri - 0.015, 0.012, "Y", "Rim", 24))
        G["Rim"].append(torus("ring", (x, face - s * 0.004, r), ri * 0.62, 0.014, (pi / 2, 0, 0), "Rim", 24))
        for k in range(6):
            a = k * pi / 3 + pi / 6
            G["Dark"].append(cyl("hole", (x + cos(a) * ri * 0.8, face - s * 0.004, r + sin(a) * ri * 0.8), ri * 0.12, 0.02, "Y", "Dark", 10))
        G["Rim"].append(cyl("hub", (x, face + s * 0.006, r), ri * 0.36, 0.03, "Y", "Rim", 14))
        nuts = 4
    else:
        n, w0, w1 = {"alloy5": (5, 0.035, 0.05), "multi": (10, 0.014, 0.022), "off": (6, 0.04, 0.05)}[kind]
        for k in range(n):
            a = k * 2 * pi / n + 0.3
            G["Rim"].append(radial("sp", x, r, a, 0.06, ri - 0.012, w0, w1, yA, yB, "Rim", lift=s * 0.012))
            if kind == "multi":  # сдвоенные спицы
                G["Rim"].append(radial("sp2", x, r, a + 0.16, 0.06, ri - 0.012, w0, w1, yA, yB, "Rim", lift=s * 0.012))
        if kind == "off":  # бэдлок: кольцо с болтами по кромке
            G["Rim"].append(torus("bead", (x, face + s * 0.008, r), ri - 0.01, 0.02, (pi / 2, 0, 0), "Rim", 28))
            for k in range(16):
                a = k * 2 * pi / 16
                G["Chrome"].append(cyl("bolt", (x + cos(a) * (ri - 0.01), face + s * 0.03, r + sin(a) * (ri - 0.01)), 0.008, 0.016, "Y", "Chrome", 6))
        G["Rim"].append(cyl("hub", (x, face + s * 0.008, r), 0.07, 0.03, "Y", "Rim", 14))
        nuts = 5
    for k in range(nuts):  # гайки и колпачок
        a = k * 2 * pi / nuts
        G["Chrome"].append(cyl("nut", (x + cos(a) * 0.045, face + s * 0.026, r + sin(a) * 0.045), 0.011, 0.016, "Y", "Chrome", 6))
    G["Dark"].append(cyl("cap", (x, face + s * 0.028, r), 0.022, 0.012, "Y", "Dark", 10))


def flare(G, c, x, s, material, d, lw, zlow):
    """Расширитель арки: дуга над колесом, плотно прилегает к борту (по его реальной ширине) и заканчивается
    над порогом — не висит ниже кузова и не отходит щелью."""
    r, a = c["r"], c["arch"]
    zmin = zlow + 0.03
    ts = [i * pi / 16 for i in range(17)]
    ts = [t for t in ts if r + sin(t) * a >= zmin]
    # если дуга обрезана порогом — добираем точный конец на высоте zmin
    def cut(t_from, t_to):
        lo, hi = t_from, t_to
        for _ in range(30):
            m = (lo + hi) / 2
            if r + sin(m) * a >= zmin: hi = m
            else: lo = m
        return hi
    t0 = cut(-0.5, 0.0) if r < zmin else 0.0
    t1 = pi - t0
    ts = [t0] + [t for t in ts if t0 < t < t1] + [t1]
    bm = bmesh.new()
    rows = []
    for t in ts:
        ring = []
        for rad in (a - 0.01, a + d):
            px, pz = x + cos(t) * rad, r + sin(t) * rad
            yin = lw(px, pz) - 0.015
            for yy in (yin, yin + d * 0.75 * (1.0 if rad > a else 0.6)):
                ring.append(bm.verts.new((px, s * yy, pz)))
        rows.append(ring)  # [внутр-у борта, внутр-наружу, внешн-у борта, внешн-наружу]
    for k in range(len(rows) - 1):
        A, B = rows[k], rows[k + 1]
        for i0, i1 in ((0, 1), (1, 3), (3, 2), (2, 0)):
            bm.faces.new((A[i0], A[i1], B[i1], B[i0]))
    for R in (rows[0], rows[-1]):
        bm.faces.new((R[0], R[1], R[3], R[2]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    G[material].append(obj_from_bm("fl", bm, material))


def headlight(G, F, s, spec_z, spec_y, spec):
    """Фара заподлицо с передком: блок-трапеция (наружный край выше — «стреловидно»), тёмная окантовка,
    внутри — проектор, две «ангельские» линзы или круглая линза. spec = (полуширина, полувысота, подъём, начинка)."""
    hw, hh, lift, inner = spec
    zc, yc = spec_z, spec_y
    yi, yo = yc - hw, yc + hw  # внутренний и наружный край
    quad = [(yi, zc - hh), (yo, zc - hh + lift * 0.4), (yo, zc + hh + lift), (yi, zc + hh * 0.7)]

    def plate(name, pts, x0, x1, material, grow=0.0):
        cy = sum(p[0] for p in pts) / 4
        cz = sum(p[1] for p in pts) / 4
        pts = [(cy + (y - cy) * (1 + grow), cz + (z - cz) * (1 + grow * 1.6)) for y, z in pts]
        bm = bmesh.new()
        a = [bm.verts.new((x0, s * y, z)) for y, z in pts]
        b = [bm.verts.new((x1, s * y, z)) for y, z in pts]
        bm.faces.new(a if s > 0 else list(reversed(a)))
        bm.faces.new(list(reversed(b)) if s > 0 else b)
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((a[i], b[i], b[j], a[j]) if s > 0 else (a[j], b[j], b[i], a[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return obj_from_bm(name, bm, material)

    G["Dark"].append(plate("bezel", quad, F - 0.03, F + 0.008, "Dark", grow=0.12))
    G["Headlight"].append(plate("lens", quad, F - 0.03, F + 0.014, "Headlight"))
    cz = zc + lift * 0.35
    if inner == "angel":  # два кольца-«глазка»
        for k in (-0.45, 0.4):
            G["Chrome"].append(cyl("eye", (F + 0.02, s * (yc + k * hw), cz), hh * 0.82, 0.014, "X", "Chrome", 14))
            G["Dark"].append(cyl("pupil", (F + 0.024, s * (yc + k * hw), cz), hh * 0.5, 0.014, "X", "Dark", 12))
    elif inner == "proj":  # проектор во внутренней части
        G["Chrome"].append(cyl("proj", (F + 0.02, s * (yc - hw * 0.35), cz), hh * 0.7, 0.014, "X", "Chrome", 14))
        G["Dark"].append(box("strip", F + 0.012, F + 0.022, s * (yc + hw * 0.1) - 0.012 * s, s * (yc + hw * 0.85), zc - hh * 0.75, zc - hh * 0.5, "Tail" if False else "Dark"))
    elif inner == "round2":  # большая круглая линза
        G["Chrome"].append(cyl("rl", (F + 0.02, s * yc, cz), hh * 0.85, 0.014, "X", "Chrome", 16))
        G["Headlight"].append(cyl("rli", (F + 0.026, s * yc, cz), hh * 0.6, 0.014, "X", "Headlight", 16))


def attach(objs, c, is_inside, near_wheel):
    """Наружные детали «прилипают» к кузову. Детали ставятся по расчётной ширине кузова, а его грани плоские —
    между опорными точками борт идёт иначе, и ручки, швы, зеркала, решётки висели в 1–6 см от него.
    Острова (отдельные куски сетки) склеиваем в группы по касанию — решётка вместе с планками, фара с линзой, —
    и двигаем каждую группу к кузову, пока ближайшая точка не коснётся. Колёса и салон не трогаем;
    сдвиг больше 15 см — это задумка (выхлоп под будкой), а не ошибка."""
    body = objs[0]
    bmb = bmesh.new()
    bmb.from_mesh(body.data)
    tree = BVHTree.FromBMesh(bmb)
    skip_mat = {"Glass", "Tire", "Rim", "Seat", "Dash", "Well"}
    isl = []  # (объект, bmesh, [вершины], центр)
    bms = []
    for o in objs[1:]:
        if o.data.materials[0].name.split(".")[0] in skip_mat:
            continue
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.verts.ensure_lookup_table()
        bms.append((o, bm))
        seen = set()
        for v in bm.verts:
            if v.index in seen:
                continue
            stack, part = [v], []
            seen.add(v.index)
            while stack:
                u = stack.pop()
                part.append(u)
                for e in u.link_edges:
                    w = e.other_vert(u)
                    if w.index not in seen:
                        seen.add(w.index)
                        stack.append(w)
            ctr = sum((u.co for u in part), Vector()) / len(part)
            if is_inside(ctr) or near_wheel(ctr):
                continue
            isl.append((part, ctr))
    # группы по касанию (union-find)
    parent = list(range(len(isl)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    # близость островов — по ограничивающим коробкам с допуском (быстро и достаточно для «касается»)
    boxes = []
    for part, _ in isl:
        xs = [u.co.x for u in part]; ys = [u.co.y for u in part]; zs = [u.co.z for u in part]
        boxes.append((min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)))
    tol = 0.006
    for i in range(len(isl)):
        a = boxes[i]
        for j in range(i + 1, len(isl)):
            b = boxes[j]
            if a[0] - tol <= b[1] and b[0] - tol <= a[1] and a[2] - tol <= b[3] and b[2] - tol <= a[3] and a[4] - tol <= b[5] and b[4] - tol <= a[5]:
                parent[find(i)] = find(j)
    groups = {}
    for i in range(len(isl)):
        groups.setdefault(find(i), []).append(i)
    moved = 0
    for members in groups.values():
        best = None
        for i in members:
            for u in isl[i][0]:
                hit = tree.find_nearest(u.co)
                if hit[0] is not None and (best is None or hit[3] < best[0]):
                    best = (hit[3], hit[0] - u.co)
        if not best or best[0] < 0.006 or best[0] > 0.15:
            continue
        d, vec = best
        shift = vec * ((d - 0.002) / d)
        for i in members:
            for u in isl[i][0]:
                u.co += shift
        moved += 1
    for o, bm in bms:
        bm.to_mesh(o.data)
        o.data.update()
        bm.free()
    bmb.free()
    return moved


# ---------------------------------------------------------------- сборка одной машины


def build(c):
    W, CW, floor = c["W"], c["CW"], c["floor"]
    rb, fb, ft, rt = c["cab"]
    zb, zt = fb[1], ft[1]
    xf = lambda z: edge_x(fb, ft, z)
    xr = lambda z: edge_x(rb, rt, z)
    tumble = c.get("tumble", 0.1)
    cw = lambda z: CW - tumble * clamp01((z - zb) / (zt - zb))  # кабина сужается к крыше
    xs = [p[0] for p in c["lower"]]
    xmax, xmin = max(xs), min(xs)
    cf, cr = c.get("endc", (0.1, 0.05))
    el = c.get("endl", 0.6)  # на какой длине скругляется нос

    def lw(x, z):  # полуширина низа: скруглённые в плане нос и корма, чуть заваленный верх борта
        w = W
        w -= cf * clamp01((x - (xmax - el)) / el) ** 1.6
        w -= cr * clamp01(((xmin + 0.5) - x) / 0.5) ** 1.6
        w -= max(0.0, z - (floor - 0.12)) * 0.3
        return w

    G = {k: [] for k in M}  # детали по материалам
    zlow = c["lower"][0][1]

    # --- низ кузова
    lower = prism("Lower", c["lower"], lw, "Body")
    for x in c["wheels"]:
        if xmin - 0.3 < x < xmax + 0.3:
            cutter(lower, cyl("arch", (x, 0, c["r"]), c["arch"], 2 * W + 0.6, "Y", "Body", 24))
    if c.get("bed"):
        x0, x1, hw, z0 = c["bed"]
        cutter(lower, box("bed", x0, x1, -hw, hw, z0, 3, "Body"))
        rx = c["wheels"][1]
        G["Body"] += [box("well", rx - 0.52, x1 - 0.01, 0.55, hw, z0 - 0.06, c["r"] + c["arch"] + 0.04, "Body"),
                      box("well", rx - 0.52, x1 - 0.01, -hw, -0.55, z0 - 0.06, c["r"] + c["arch"] + 0.04, "Body")]
        G["Dark"].append(box("fl", x0 + 0.02, x1 - 0.01, -hw + 0.02, hw - 0.02, z0, z0 + 0.03, "Dark"))
    # ниши колёс — отдельный тёмный материал: там всегда черно и тереть нельзя
    lower.data.materials.append(M["Well"])
    for p in lower.data.polygons:
        if abs(p.normal.y) > 0.6:
            continue
        for x in c["wheels"]:
            if ((p.center.x - x) ** 2 + (p.center.z - c["r"]) ** 2) ** 0.5 < c["arch"] + 0.03:
                p.material_index = 1

    # --- кабина: пустая коробка со стенками T, открытая снизу (пол — верх нижней части)
    cab = prism("Cab", c["cab"], lambda x, z: cw(z), "Body")
    inn = inset(c["cab"], T)
    for i, j in ((0, 3), (1, 2)):
        (ax, az), (bx, bz) = inn[j], inn[i]
        zz = zb - 0.3
        inn[i] = (ax + (bx - ax) * (zz - az) / (bz - az), zz)
    cutter(cab, prism("in", inn, lambda x, z: cw(max(z, zb)) - T, "Body"))

    # --- окна: вырезы в стенках + стёкла посередине стенки
    zw0, zw1 = max(zb + 0.12, floor + 0.07), zt - 0.08
    insf, insr = hthick(fb, ft) + 0.07, hthick(rb, rt) + 0.07
    side = [(xr(zw0) + insr, zw0), (xf(zw0) - insf, zw0), (xf(zw1) - insf, zw1), (xr(zw1) + insr, zw1)]
    for a, b in (c.get("split") or [(-9, 9)]):
        p = clip_x(side, a, b)
        if len(p) < 3:
            continue
        cutter(cab, prism("win", p, (-3, 3), "Body"))
        G["Glass"].append(poly("g", [(x, cw(z) - T / 2, z) for x, z in p], "Glass"))
        G["Glass"].append(poly("g", [(x, -(cw(z) - T / 2), z) for x, z in reversed(p)], "Glass"))
    ends = [(fb, ft)] + ([(rt, rb)] if c.get("rear_window", True) else [])
    for p0, p1 in ends:  # лобовое и заднее
        nx, nz = outward(p0, p1)
        A = (edge_x(p0, p1, zw0), zw0)
        B = (edge_x(p0, p1, zw1), zw1)
        k = 0.12
        strip = [(A[0] - nx * k, A[1] - nz * k), (B[0] - nx * k, B[1] - nz * k), (B[0] + nx * k, B[1] + nz * k), (A[0] + nx * k, A[1] + nz * k)]
        cutter(cab, prism("ws", strip, lambda x, z: cw(min(max(z, zw0), zw1)) - 0.1, "Body"))
        h = T / 2
        pa = (A[0] - nx * h, A[1] - nz * h)
        pb = (B[0] - nx * h, B[1] - nz * h)
        wa, wb_ = cw(pa[1]) - 0.1, cw(pb[1]) - 0.1
        G["Glass"].append(poly("g", [(pa[0], -wa, pa[1]), (pa[0], wa, pa[1]), (pb[0], wb_, pb[1]), (pb[0], -wb_, pb[1])], "Glass"))

    # --- будка фургона (часть кузова: её тоже моют и красят, на ней ливрея) и шасси под ней
    if c.get("box"):
        x0, x1, hw, z0, z1 = c["box"]
        G["Body"].append(box("box", x0, x1, -hw, hw, z0, z1, "Body", bevel=0.04))
        G["Dark"] += [box("frame", x0 - 0.02, x1, s * 0.42 - 0.05, s * 0.42 + 0.05, 0.55, z0, "Dark") for s in (1, -1)]
        rx = c["wheels"][1]
        G["Dark"] += [box("flap", rx - c["r"] - 0.14, rx - c["r"] - 0.11, s * (hw - 0.3) - 0.2, s * (hw - 0.3) + 0.2, 0.2, z0, "Dark") for s in (1, -1)]

    # --- салон (виден через стёкла)
    # Пол салона опущен: в нижней части кузова вырезана «ванна» между колёсными арками — иначе сиденья стоят
    # на уровне окон. Вырез целиком под кабиной, снаружи его не видно.
    xin_r = xr(floor) + hthick(rb, rt) + 0.01
    xin_f = xf(floor) - hthick(fb, ft) - 0.01
    yin = cw(floor) - T - 0.01
    fx, rxw = c["wheels"][0], c["wheels"][1]
    cav0 = max(xin_r + 0.02, rxw + c["arch"] + 0.06) if xin_r < rxw + c["arch"] + 0.06 else xin_r + 0.02
    cav1 = min(xin_f - 0.02, fx - c["arch"] - 0.06)
    zin = max(zlow + 0.12, floor - 0.42)  # уровень пола салона
    cav_w = min(W - 0.09, CW - T - 0.02)
    has_cav = cav1 - cav0 > 0.5
    if has_cav:
        cutter(lower, box("cav", cav0, cav1, -cav_w, cav_w, zin, floor + 0.3, "Body"))
        G["Dark"].append(box("carpet", cav0, cav1, -cav_w, cav_w, zin, zin + 0.015, "Dark"))
        if cav0 > xin_r + 0.02:  # над задними арками пол тоже ниже — сразу над колесом
            zr = min(floor - 0.1, max(zin, c["r"] + c["arch"] + 0.04))
            cutter(lower, box("cavr", xin_r + 0.02, cav0 + 0.01, -cav_w, cav_w, zr, floor + 0.3, "Body"))
            G["Dark"].append(box("carpet", xin_r + 0.02, cav0, -cav_w, cav_w, zr, zr + 0.015, "Dark"))
        if cav1 < xin_f - 0.02:
            G["Dark"].append(box("carpet", cav1, xin_f, -yin, yin, floor, floor + 0.015, "Dark"))
    else:
        G["Dark"].append(box("carpet", xin_r, xin_f, -yin, yin, floor, floor + 0.015, "Dark"))

    def floor_at(x0, x1):  # на какой высоте пол под сиденьем
        if has_cav and x0 >= cav0 - 0.05 and x1 <= cav1 + 0.05:
            return zin
        if has_cav and cav0 > xin_r + 0.02 and x1 <= cav0 + 0.25:
            return min(floor - 0.1, max(zin, c["r"] + c["arch"] + 0.04))
        return floor

    dash1 = xf(zw0) - hthick(fb, ft) - 0.04
    dash0 = dash1 - 0.38
    G["Dash"].append(box("dash", dash0, dash1, -yin, yin, floor_at(dash0, dash1), zw0 + 0.05, "Dash", bevel=0.02))
    G["Dash"].append(box("dashtop", dash0 - 0.06, dash1, -yin, yin, zw0 + 0.01, zw0 + 0.07, "Dash", bevel=0.02))
    ydrv = 0.40 * CW / 0.86  # руль слева (машина смотрит в +X, левый борт — +Y)
    G["Dark"].append(torus("wheel", (dash0 - 0.13, ydrv, zw0 + 0.02), 0.15, 0.02, (0, radians(-58), 0), "Dark", 16))
    G["Dark"].append(cyl("column", (dash0 - 0.05, ydrv, zw0 - 0.04), 0.025, 0.2, "X", "Dark", 8, tilt=Matrix.Rotation(radians(-32), 3, "Y")))
    top = zt - 0.12

    def seat(sx, y0, y1):
        cr_ = max(sx - 0.26, xr(floor + 0.2) + hthick(rb, rt) + 0.04)
        fz = floor_at(cr_, sx + 0.22)
        G["Seat"].append(box("cush", cr_, sx + 0.22, y0, y1, fz, fz + 0.24, "Seat", bevel=0.03))
        tb = min(fz + 0.78, top)
        tx0 = max(cr_ - 0.12, xr(tb) + hthick(rb, rt) + 0.04)
        G["Seat"].append(prism("back", [(cr_, fz + 0.14), (cr_ + 0.13, fz + 0.14), (tx0 + 0.13, tb), (tx0, tb)], (y0, y1), "Seat"))
        if tb + 0.14 < zt - 0.05 and abs(y1 - y0) < 0.6:  # подголовник
            G["Seat"].append(box("head", tx0, tx0 + 0.1, (y0 + y1) / 2 - 0.12, (y0 + y1) / 2 + 0.12, tb + 0.02, tb + 0.15, "Seat", bevel=0.02))
        return fz

    sx = dash0 - 0.58
    if c["seats"] == "bench":
        seat(sx, -yin + 0.02, yin - 0.02)
    else:
        sw = 0.21 * CW / 0.86
        for s in (1, -1):
            fz = seat(sx, s * ydrv - sw, s * ydrv + sw)
        G["Dash"].append(box("console", sx - 0.2, dash0, -0.09, 0.09, fz, fz + 0.3, "Dash", bevel=0.02))  # тоннель с рычагом
        G["Dark"].append(cyl("lever", (sx + 0.2, 0, fz + 0.42), 0.015, 0.24, "Z", "Dark", 6))
        G["Chrome"].append(cyl("knob", (sx + 0.2, 0, fz + 0.56), 0.035, 0.05, "Z", "Chrome", 8))
    if c.get("rear_seat") and sx - 0.9 - 0.26 > xin_r - 0.2:
        seat(sx - 0.9, -yin + 0.02, yin - 0.02)

    # --- колёса
    for i, x in enumerate(c["wheels"]):
        for s in (1, -1):
            wheel(G, c, x, s)
            if i == 1 and c.get("dual_rear"):
                wheel(G, c, x, s, inner=True)
            if c.get("flares") and xmin - 0.3 < x < xmax + 0.3:
                flare(G, c, x, s, *c["flares"], lw, zlow)

    # --- перед: бампер, решётка, фары
    F, R = c["front"], c["rear"]
    rx0 = c["box"][0] if c.get("box") else R
    if c.get("bumper"):
        kind, b0, b1 = c["bumper"]
        m_ = {"dark": "Dark", "chrome": "Chrome"}[kind]
        bw = max(lw(F, b1), W - 0.05) + 0.03
        G[m_].append(box("bf", F - 0.10, F + 0.12, -bw, bw, b0, b1, m_, bevel=0.03))
        G[m_].append(box("br", rx0 - 0.12, rx0 + 0.08, -bw, bw, b0, b1 - 0.02, m_, bevel=0.03))
    if c.get("lip"):
        z0, z1, hw = c["lip"]
        G["Dark"].append(box("lip", F - 0.06, F + 0.015, -hw, hw, z0, z1, "Dark", bevel=0.015))
        G["Dark"].append(box("diff", R - 0.015, R + 0.05, -hw, hw, z0, z1 - 0.04, "Dark", bevel=0.015))
    kind, g0, g1, gw = c["grille"]
    gx = F + 0.012
    if kind == "bars":
        G["Dark"].append(box("gr", F - 0.05, gx, -gw, gw, g0, g1, "Dark", bevel=0.01))
        for k in range(4):
            z = g0 + (g1 - g0) * (k + 0.5) / 4
            G["Chrome"].append(box("bar", gx - 0.01, gx + 0.012, -gw + 0.02, gw - 0.02, z - 0.012, z + 0.012, "Chrome"))
    elif kind == "mesh":
        G["Dark"].append(box("gr", F - 0.05, gx, -gw, gw, g0, g1, "Dark", bevel=0.02))
        for y0, y1, z0, z1 in ((-gw, gw, g1 - 0.025, g1 + 0.01), (-gw, gw, g0 - 0.01, g0 + 0.025),
                               (-gw - 0.01, -gw + 0.025, g0, g1), (gw - 0.025, gw + 0.01, g0, g1)):
            G["Chrome"].append(box("fr", gx - 0.015, gx + 0.015, y0, y1, z0, z1, "Chrome"))
        for k in range(7):
            y = -gw + 2 * gw * (k + 0.5) / 7
            G["Chrome"].append(box("v", gx - 0.012, gx + 0.006, y - 0.006, y + 0.006, g0 + 0.02, g1 - 0.02, "Chrome"))
    elif kind == "kidney":
        for s in (1, -1):
            yc, kw = s * gw * 0.52, gw * 0.44
            G["Chrome"].append(box("kf", F - 0.04, gx + 0.012, yc - kw, yc + kw, g0, g1, "Chrome", bevel=0.01))
            G["Dark"].append(box("ki", F - 0.03, gx + 0.02, yc - kw + 0.02, yc + kw - 0.02, g0 + 0.02, g1 - 0.02, "Dark"))
            for k in range(5):
                y = yc - kw + 2 * kw * (k + 0.5) / 5
                G["Chrome"].append(box("ks", gx + 0.01, gx + 0.028, y - 0.006, y + 0.006, g0 + 0.03, g1 - 0.03, "Chrome"))
    elif kind == "slots7":
        sw = 2 * gw / 7
        for k in range(7):
            y = -gw + sw * (k + 0.5)
            G["Dark"].append(box("slot", F - 0.04, gx + 0.006, y - sw * 0.32, y + sw * 0.32, g0, g1, "Dark", bevel=0.012))
    for kind, lz, ly, ls in c["lights"]:
        for s in (1, -1):
            if kind == "round":
                G["Headlight"].append(cyl("l", (F + 0.012, s * ly, lz), ls, 0.04, "X", "Headlight", 16))
                G["Chrome"].append(cyl("lr", (F + 0.0, s * ly, lz), ls + 0.022, 0.04, "X", "Chrome", 16))
            elif kind == "rect":
                G["Headlight"].append(box("l", F - 0.02, F + 0.035, s * ly - ls * 1.6, s * ly + ls * 1.6, lz - ls * 0.7, lz + ls * 0.7, "Headlight", bevel=0.01))
            else:
                headlight(G, F, s, lz, ly, ls)
    if c.get("fog"):
        z, y, rr = c["fog"]
        for s in (1, -1):
            G["Headlight"].append(cyl("fog", (F + 0.13, s * y, z), rr, 0.03, "X", "Headlight", 12))

    # --- зад: фонари, запаска, выхлоп
    kind, t0, t1, ty = c["tail"]
    for s in (1, -1):
        if kind == "wrap":
            G["Tail"].append(box("tl", R - 0.03, R + 0.03, s * ty - 0.12, s * ty + 0.12, t0, t1, "Tail", bevel=0.01))
            y = lw(R + 0.12, (t0 + t1) / 2)
            G["Tail"].append(side_box("tls", R + 0.02, R + 0.2, y, 0.015, t0 + 0.01, t1 - 0.01, s, "Tail"))
        elif kind == "vert":
            G["Tail"].append(box("tl", R - 0.03, R + 0.02, s * ty - 0.07, s * ty + 0.07, t0, t1, "Tail", bevel=0.01))
        else:
            G["Tail"].append(box("tl", rx0 - 0.03, rx0 + 0.02, s * ty - 0.1, s * ty + 0.1, t0, t1, "Tail", bevel=0.01))
    if c.get("spare"):
        zc = (zlow + floor) / 2 + 0.15
        G["Tire"].append(cyl("spare", (R - 0.16, 0, zc), c["r"] * 0.95, c["tw"] * 0.9, "X", "Tire", 22, bevel=0.04))
        G["Rim"].append(cyl("spr", (R - 0.30, 0, zc), c["r"] * 0.5, 0.03, "X", "Rim", 16))
    G["Chrome"].append(cyl("exh", (rx0 + 0.02, -0.5, max(0.2, zlow - 0.08)), 0.04, 0.3, "X", "Chrome", 10))

    # --- борта: ручки, зеркала, швы дверей, петли, пороги, накладки, рейлинги
    for s in (1, -1):
        for hx in c["handles"]:
            G["Chrome"].append(side_box("hd", hx, hx + 0.14, lw(hx, floor - 0.1), 0.016, floor - 0.11, floor - 0.075, s, "Chrome", 0.006))
        mx = xf(zw0 + 0.05) - 0.18
        G["Dark"].append(side_box("mir", mx, mx + 0.14, cw(zw0), 0.2, zw0 - 0.02, zw0 + 0.1, s, "Dark", 0.025))
        for sx_ in c.get("seams", []):
            z0, z1 = zlow + 0.06, floor - 0.02
            for wx in c["wheels"]:  # шов не должен свисать через колёсную арку
                if abs(sx_ - wx) < c["arch"] + 0.02:
                    z0 = max(z0, c["r"] + (max(0.0, (c["arch"] + 0.02) ** 2 - (sx_ - wx) ** 2)) ** 0.5 + 0.02)
            if z1 - z0 < 0.08:
                continue
            G["Dark"].append(side_box("seam", sx_ - 0.006, sx_ + 0.006, lw(sx_, (z0 + z1) / 2), 0.004, z0, z1, s, "Dark"))
            if c.get("hinges"):
                for hz in (zlow + 0.18, floor - 0.12):
                    G["Dark"].append(side_box("hinge", sx_ - 0.04, sx_ + 0.05, lw(sx_, hz), 0.025, hz, hz + 0.07, s, "Dark"))
        fx, rxw = c["wheels"]
        if c.get("steps"):
            G["Dark"].append(side_box("step", rxw + c["arch"] + 0.05, fx - c["arch"] - 0.05, lw(0, zlow), 0.14, zlow - 0.08, zlow - 0.02, s, "Dark", 0.01))
        if c.get("cladding"):
            G["Dark"].append(side_box("clad", rxw + c["arch"], fx - c["arch"], lw(0, zlow + 0.1), 0.03, zlow, zlow + 0.14, s, "Dark"))
        if c.get("roofrails"):
            yr = cw(zt) - 0.12
            G["Dark"].append(box("rail", rt[0] + 0.15, ft[0] - 0.1, s * yr - 0.025, s * yr + 0.025, zt + 0.06, zt + 0.09, "Dark", bevel=0.01))
            for lx in (rt[0] + 0.18, ft[0] - 0.14):
                G["Dark"].append(box("leg", lx - 0.03, lx + 0.03, s * yr - 0.02, s * yr + 0.02, zt - 0.01, zt + 0.07, "Dark"))
    if c.get("antenna"):
        G["Dark"].append(cyl("ant", (rt[0] + 0.2, -0.3, zt + 0.2), 0.006, 0.42, "Z", "Dark", 6))
    for m_, x0, x1, y0, y1, z0, z1 in c.get("extras", []):
        G[m_].append(box("x", x0, x1, y0, y1, z0, z1, m_))

    def is_inside(p):  # точка в салоне (рычаг, руль, сиденья) — к кузову не двигаем
        return zlow < p.z < zt and abs(p.y) < cw(min(max(p.z, zb), zt)) - 0.05 and xr(p.z) + 0.03 < p.x < xf(min(p.z, zt)) - 0.03

    def near_wheel(p):  # детали колеса (диск, тормоз, гайки) держатся за колесо, не за кузов
        return any(((p.x - wx) ** 2 + (p.z - c["r"]) ** 2) ** 0.5 < c["r"] + 0.05 and abs(p.y) > W - c.get("tw", 0.22) - 0.15
                   for wx in c["wheels"])

    # --- кузов одним объектом: скосы на рёбрах, UV
    body = join([lower, cab] + G.pop("Body"), "Body")
    bev = body.modifiers.new("bevel", "BEVEL")
    bev.width = 0.022
    bev.segments = 2
    bev.limit_method = "ANGLE"
    bev.angle_limit = radians(32)
    bev.use_clamp_overlap = True
    sel(body)
    bpy.ops.object.modifier_apply(modifier=bev.name)
    bpy.ops.object.shade_flat()
    # «ванна» салона изнутри (стенки и дно под ковриком) — тоже в тёмные ниши: её не видно, а место
    # на развёртке кузова она бы отняла у ржавчины и краски
    wi = next(i for i, m in enumerate(body.data.materials) if m and m.name.startswith("Well"))
    if has_cav:
        for p in body.data.polygons:
            ctr = p.center
            if xin_r - 0.01 < ctr.x < xin_f + 0.01 and abs(ctr.y) < cav_w + 0.005 and zlow < ctr.z < floor - 0.005:
                p.material_index = wi
    # ниши отдельным объектом: в развёртку кузова не попадают
    sel(body)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    body.active_material_index = wi
    bpy.ops.object.material_slot_select()
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    well = next((o for o in bpy.context.selected_objects if o is not body), None)
    if well:
        well.name = well.data.name = "Well"
        well.data.materials.clear()
        well.data.materials.append(M["Well"])
    body.data.materials.pop(index=wi)
    unwrap(body)
    objs = [body] + ([well] if well else [])
    for k, lst in G.items():
        if lst:
            o = join(lst, k)
            if k == "Glass":
                unwrap(o)
            objs.append(o)
    attach(objs, c, is_inside, near_wheel)
    return objs


# ---------------------------------------------------------------- запуск
old = bpy.data.scenes.get(SCENE)
if old:
    for o in list(old.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for c_ in list(old.collection.children):
        bpy.data.collections.remove(c_)
    bpy.data.scenes.remove(old)
bpy.data.orphans_purge(do_recursive=True)
M = make_materials()
sc = bpy.data.scenes.new(SCENE)
bpy.context.window.scene = sc
os.makedirs(OUT_DIR, exist_ok=True)

ONLY = globals().get("FLIP_ONLY")  # можно собрать часть: FLIP_ONLY = ["shiva"] перед exec
result = {}
for i, (cid, spec) in enumerate(CARS.items()):
    if ONLY and cid not in ONLY:
        continue
    col = bpy.data.collections.new(cid)
    sc.collection.children.link(col)
    objs = build(spec)
    sel(*objs)
    path = os.path.join(OUT_DIR, cid + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, use_active_scene=True, export_apply=True,
                              export_normals=False, export_meshopt_compression_enable=True)  # игра считает нормали сама (flat)
    result[cid] = {"kb": round(os.path.getsize(path) / 1024), "faces": sum(len(o.data.polygons) for o in objs)}
    for o in objs:  # рядами для предпросмотра
        o.location.x += (i % 5) * 6.5
        o.location.y += (i // 5) * 3.2
