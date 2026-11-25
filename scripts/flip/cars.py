# Машины для «Перекупщика Джо» — low-poly, собираются целиком из этого скрипта.
# Запуск в Blender (через MCP или Text Editor):
#   exec(open(r"D:\MiniApp\scripts\flip\cars.py", encoding="utf-8").read())
# Создаёт сцену "Flip_Cars" (сцену пользователя не трогает), экспортирует public/games/flip/<id>.glb
# и расставляет все машины в ряд для предпросмотра. После — node scripts/flip/bake-vis.mjs.
#
# Контракт с игрой — имена МАТЕРИАЛОВ:
#   Body  — кузов, одна UV-развёртка: по ней игра рисует грязь, ржавчину, краску, блеск
#   Glass, Tire, Chrome, Headlight, Tail, Dark, Seat, Dash — остальное
import bpy, bmesh, os
from math import pi, radians

OUT_DIR = r"D:\MiniApp\public\games\flip"
SCENE = "Flip_Cars"
T = 0.05  # толщина стенок кабины

# ---------------------------------------------------------------- машины
# Профили — (x, z): x вперёд, z вверх, земля z=0. Кабина: [зад-низ, перед-низ, перед-верх, зад-верх].
CARS = {
    "pickup": dict(
        lower=[(-2.50, 0.40), (2.30, 0.40), (2.50, 0.55), (2.52, 0.95), (2.35, 1.08), (0.80, 1.16), (-0.95, 1.16), (-2.50, 1.12)],
        W=0.95, wheels=(1.55, -1.60), r=0.42, arch=0.52,
        cab=[(-1.00, 1.10), (0.85, 1.10), (0.45, 1.80), (-0.92, 1.82)], CW=0.86, floor=1.16,
        split=None, bed=(-2.40, -1.05, 0.84, 0.66),
        front=2.51, rear=-2.50, bumper=(0.36, 0.54), lights=(0.82, 0.66, 0.12, "round"), grille=(0.62, 0.94, 0.42),
        tail=(0.80, 1.00, 0.80), handles=[-0.20], seats="bench", rear_seat=False, extras=[]),
    "sedan": dict(
        lower=[(-2.30, 0.38), (2.20, 0.38), (2.35, 0.50), (2.38, 0.85), (2.25, 0.98), (0.95, 1.04), (-1.55, 1.06), (-2.25, 1.02), (-2.36, 0.80)],
        W=0.90, wheels=(1.45, -1.45), r=0.38, arch=0.47,
        cab=[(-1.60, 1.02), (1.00, 1.02), (0.35, 1.62), (-1.05, 1.62)], CW=0.82, floor=1.05,
        split=[(-9, -0.32), (-0.22, 9)], bed=None,
        front=2.37, rear=-2.35, bumper=(0.36, 0.52), lights=(0.74, 0.62, 0.10, "rect"), grille=(0.56, 0.82, 0.45),
        tail=(0.74, 0.92, 0.72), handles=[0.05, -0.85], seats="bucket", rear_seat=True, extras=[]),
    "hatch": dict(
        lower=[(-1.80, 0.36), (1.75, 0.36), (1.90, 0.48), (1.92, 0.80), (1.80, 0.92), (0.85, 1.00), (-1.80, 1.00), (-1.88, 0.70)],
        W=0.82, wheels=(1.20, -1.20), r=0.34, arch=0.43,
        cab=[(-1.80, 0.98), (0.90, 0.98), (0.30, 1.60), (-1.65, 1.62)], CW=0.78, floor=1.00,
        split=[(-9, -0.95), (-0.85, 9)], bed=None,
        front=1.91, rear=-1.85, bumper=(0.34, 0.48), lights=(0.70, 0.56, 0.09, "rect"), grille=(0.50, 0.66, 0.36),
        tail=(0.72, 0.92, 0.62), handles=[-0.30], seats="bucket", rear_seat=True, extras=[]),
    "coupe": dict(
        lower=[(-2.40, 0.34), (2.35, 0.34), (2.50, 0.46), (2.52, 0.78), (2.38, 0.90), (0.70, 0.96), (-2.30, 0.96), (-2.45, 0.75)],
        W=0.95, wheels=(1.55, -1.55), r=0.40, arch=0.48,
        cab=[(-1.90, 0.94), (0.75, 0.94), (0.15, 1.42), (-0.70, 1.44)], CW=0.82, floor=0.96,
        split=None, bed=None,
        front=2.51, rear=-2.43, bumper=(0.32, 0.46), lights=(0.64, 0.66, 0.09, "round"), grille=(0.48, 0.76, 0.48),
        tail=(0.58, 0.76, 0.78), handles=[-0.45], seats="bucket", rear_seat=False,
        extras=[("Body", 1.00, 1.60, -0.22, 0.22, 0.90, 1.03),          # воздухозаборник на капоте
                ("Dark", -2.40, -2.18, -0.86, 0.86, 1.07, 1.11),        # спойлер
                ("Dark", -2.32, -2.26, 0.60, 0.66, 0.94, 1.08),
                ("Dark", -2.32, -2.26, -0.66, -0.60, 0.94, 1.08)]),
    "van": dict(
        lower=[(-2.30, 0.40), (2.20, 0.40), (2.35, 0.52), (2.36, 0.95), (2.20, 1.08), (1.30, 1.12), (-2.30, 1.12)],
        W=0.95, wheels=(1.45, -1.50), r=0.40, arch=0.49,
        cab=[(-2.30, 1.10), (1.35, 1.10), (0.85, 2.05), (-2.25, 2.08)], CW=0.93, floor=1.12,
        split=[(0.20, 9)], bed=None,
        front=2.355, rear=-2.30, bumper=(0.38, 0.55), lights=(0.82, 0.66, 0.10, "rect"), grille=(0.58, 0.90, 0.45),
        tail=(0.75, 1.05, 0.82), handles=[0.30, -0.60], seats="bucket", rear_seat=False,
        extras=[("Dark", -0.60, -0.56, 0.955, 0.965, 0.50, 1.95),          # шов сдвижной двери
                ("Dark", -0.60, -0.56, -0.965, -0.955, 0.50, 1.95)]),
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
    "Chrome": mat("Chrome", (0.8, 0.8, 0.8), 1.0, 0.25),
    "Headlight": mat("Headlight", (0.95, 0.92, 0.7), 0.0, 0.2),
    "Tail": mat("Tail", (0.7, 0.05, 0.03), 0.0, 0.3),
    "Dark": mat("Dark", (0.06, 0.06, 0.07), 0.3, 0.5),
    "Seat": mat("Seat", (0.35, 0.18, 0.08), 0.0, 0.7),
    "Dash": mat("Dash", (0.12, 0.10, 0.09), 0.0, 0.6),
  }


M = {}

# ---------------------------------------------------------------- геометрия
col = None


def obj_from_bm(name, bm, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(M[material])
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    return o


def prism(name, pts, y0, y1, material):
    """Профиль (x, z) вытянут по Y от y0 до y1."""
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


def edge_x(p0, p1, z):
    return p0[0] + (p1[0] - p0[0]) * (z - p0[1]) / (p1[1] - p0[1])


def hthick(p0, p1):
    """Толщина наклонной стенки по горизонтали."""
    dx, dz = p1[0] - p0[0], p1[1] - p0[1]
    return T * (dx * dx + dz * dz) ** 0.5 / abs(dz)


def outward(p0, p1):
    """Внешняя нормаль ребра p0→p1 профиля, обходимого против часовой."""
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


# ---------------------------------------------------------------- сборка одной машины


def build(c):
    W, CW, floor = c["W"], c["CW"], c["floor"]
    rb, fb, ft, rt = c["cab"]
    zb, zt = fb[1], ft[1]
    xf = lambda z: edge_x(fb, ft, z)
    xr = lambda z: edge_x(rb, rt, z)
    G = {k: [] for k in M}  # детали по материалам

    # --- низ кузова
    lower = prism("Lower", c["lower"], -W, W, "Body")
    for x in c["wheels"]:
        cutter(lower, cyl("arch", (x, 0, c["r"]), c["arch"], 2 * W + 0.6, "Y", "Body", 20))
    if c["bed"]:
        x0, x1, hw, z0 = c["bed"]
        cutter(lower, box("bed", x0, x1, -hw, hw, z0, 3, "Body"))
        rx = c["wheels"][1]
        # короба над задними колёсами внутри платформы (иначе шины видны сквозь вырез арки)
        G["Body"] += [box("well", rx - 0.5, x1 - 0.01, 0.55, hw, z0 - 0.06, c["r"] + c["arch"] + 0.04, "Body"),
                      box("well", rx - 0.5, x1 - 0.01, -hw, -0.55, z0 - 0.06, c["r"] + c["arch"] + 0.04, "Body")]
        G["Dark"].append(box("fl", x0 + 0.02, x1 - 0.01, -hw + 0.02, hw - 0.02, z0, z0 + 0.03, "Dark"))

    # --- кабина: пустая коробка со стенками T, открытая снизу (пол — верх нижней части)
    cab = prism("Cab", c["cab"], -CW, CW, "Body")
    inn = inset(c["cab"], T)
    for i, j in ((0, 3), (1, 2)):  # нижние вершины опускаем вдоль боковых рёбер
        (ax, az), (bx, bz) = inn[j], inn[i]
        zz = zb - 0.3
        inn[i] = (ax + (bx - ax) * (zz - az) / (bz - az), zz)
    cutter(cab, prism("in", inn, -(CW - T), CW - T, "Body"))

    # --- окна: вырезы в стенках + стёкла посередине стенки
    zw0, zw1 = max(zb + 0.12, floor + 0.07), zt - 0.08
    insf, insr = hthick(fb, ft) + 0.07, hthick(rb, rt) + 0.07
    side = [(xr(zw0) + insr, zw0), (xf(zw0) - insf, zw0), (xf(zw1) - insf, zw1), (xr(zw1) + insr, zw1)]
    for a, b in (c["split"] or [(-9, 9)]):
        p = clip_x(side, a, b)
        if len(p) < 3:
            continue
        cutter(cab, prism("win", p, -3, 3, "Body"))
        yg = CW - T / 2
        G["Glass"].append(poly("g", [(x, yg, z) for x, z in p], "Glass"))
        G["Glass"].append(poly("g", [(x, -yg, z) for x, z in reversed(p)], "Glass"))
    for p0, p1 in ((fb, ft), (rt, rb)):  # лобовое и заднее
        nx, nz = outward(p0, p1)
        A = (edge_x(p0, p1, zw0), zw0)
        B = (edge_x(p0, p1, zw1), zw1)
        k = 0.12
        strip = [(A[0] - nx * k, A[1] - nz * k), (B[0] - nx * k, B[1] - nz * k), (B[0] + nx * k, B[1] + nz * k), (A[0] + nx * k, A[1] + nz * k)]
        hw = CW - 0.1
        cutter(cab, prism("ws", strip, -hw, hw, "Body"))
        h = T / 2
        G["Glass"].append(poly("g", [(A[0] - nx * h, -hw, A[1] - nz * h), (A[0] - nx * h, hw, A[1] - nz * h),
                                     (B[0] - nx * h, hw, B[1] - nz * h), (B[0] - nx * h, -hw, B[1] - nz * h)], "Glass"))

    # --- салон (виден через стёкла — без мелочей)
    xin_r = xr(floor) + hthick(rb, rt) + 0.01
    xin_f = xf(floor) - hthick(fb, ft) - 0.01
    yin = CW - T - 0.01
    G["Dark"].append(box("carpet", xin_r, xin_f, -yin, yin, floor, floor + 0.015, "Dark"))
    dash1 = xf(zw0) - hthick(fb, ft) - 0.04
    dash0 = dash1 - 0.38
    G["Dash"].append(box("dash", dash0, dash1, -yin, yin, floor, zw0 + 0.05, "Dash"))
    G["Dash"].append(box("dashtop", dash0 - 0.06, dash1, -yin, yin, zw0 + 0.01, zw0 + 0.07, "Dash"))
    ydrv = 0.40 * CW / 0.86  # руль слева (машина смотрит в +X, левый борт — +Y)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.15, minor_radius=0.02, major_segments=16, minor_segments=6,
                                     location=(dash0 - 0.13, ydrv, zw0 + 0.04), rotation=(0, radians(-58), 0))
    wheel = bpy.context.active_object
    wheel.data.materials.append(M["Dark"])
    for c_ in wheel.users_collection:
        c_.objects.unlink(wheel)
    col.objects.link(wheel)
    G["Dark"].append(wheel)
    col_ = cyl("column", (dash0 - 0.05, ydrv, zw0 - 0.02), 0.025, 0.2, "X", "Dark", 8)
    col_.rotation_euler = (0, radians(90 - 32), 0)
    G["Dark"].append(col_)
    top = zt - 0.12

    def seat(sx, y0, y1):
        cr = max(sx - 0.26, xr(floor + 0.2) + hthick(rb, rt) + 0.04)
        G["Seat"].append(box("cush", cr, sx + 0.22, y0, y1, floor, floor + 0.2, "Seat"))
        bx0 = cr
        tb = min(floor + 0.72, top)
        tx0 = max(bx0 - 0.10, xr(tb) + hthick(rb, rt) + 0.04)
        G["Seat"].append(prism("back", [(bx0, floor + 0.12), (bx0 + 0.12, floor + 0.12), (tx0 + 0.12, tb), (tx0, tb)], y0, y1, "Seat"))

    sx = dash0 - 0.58
    if c["seats"] == "bench":
        seat(sx, -yin + 0.02, yin - 0.02)
    else:
        sw = 0.21 * CW / 0.86
        for s in (1, -1):
            seat(sx, s * ydrv - sw, s * ydrv + sw)
        G["Dark"].append(cyl("lever", (sx + 0.32, 0, floor + 0.15), 0.015, 0.3, "Z", "Dark", 6))
        G["Chrome"].append(cyl("knob", (sx + 0.32, 0, floor + 0.31), 0.035, 0.05, "Z", "Chrome", 8))
    if c["rear_seat"] and sx - 0.9 - 0.26 > xin_r - 0.2:
        seat(sx - 0.9, -yin + 0.02, yin - 0.02)

    # --- снаружи: колёса, бамперы, свет, ручки, зеркала
    for x in c["wheels"]:
        for s in (1, -1):
            G["Tire"].append(cyl("t", (x, s * (W - 0.15), c["r"]), c["r"], 0.30, "Y", "Tire", 18))
            G["Chrome"].append(cyl("h", (x, s * (W + 0.005), c["r"]), c["r"] * 0.52, 0.02, "Y", "Chrome", 12))
    F, R = c["front"], c["rear"]
    b0, b1 = c["bumper"]
    G["Chrome"].append(box("bf", F - 0.08, F + 0.14, -W - 0.03, W + 0.03, b0, b1, "Chrome"))
    G["Chrome"].append(box("br", R - 0.12, R + 0.06, -W - 0.03, W + 0.03, b0, b1 - 0.02, "Chrome"))
    g0, g1, gw = c["grille"]
    G["Dark"].append(box("gr", F - 0.04, F + 0.03, -gw, gw, g0, g1, "Dark"))
    lz, ly, ls, shape = c["lights"]
    for s in (1, -1):
        if shape == "round":
            G["Headlight"].append(cyl("l", (F + 0.02, s * ly, lz), ls, 0.06, "X", "Headlight", 14))
        else:
            G["Headlight"].append(box("l", F - 0.02, F + 0.035, s * ly - ls * 1.6, s * ly + ls * 1.6, lz - ls * 0.7, lz + ls * 0.7, "Headlight"))
        t0, t1, ty = c["tail"]
        G["Tail"].append(box("tl", R - 0.035, R + 0.02, s * ty - 0.09, s * ty + 0.09, t0, t1, "Tail"))
        for hx in c["handles"]:
            G["Chrome"].append(box("hd", hx, hx + 0.13, s * W - 0.01, s * W + 0.02 * s + (0.0 if s > 0 else 0), floor - 0.11, floor - 0.075, "Chrome")
                               if s > 0 else box("hd", hx, hx + 0.13, -W - 0.02, -W + 0.01, floor - 0.11, floor - 0.075, "Chrome"))
        mx = xf(zw0 + 0.05) - 0.16
        G["Dark"].append(box("mir", mx, mx + 0.12, s * CW if s > 0 else -CW - 0.17, CW + 0.17 if s > 0 else -CW, zw0 - 0.02, zw0 + 0.07, "Dark"))
    G["Chrome"].append(cyl("exh", (R + 0.02, -0.5, 0.26), 0.04, 0.3, "X", "Chrome", 10))
    for m_, x0, x1, y0, y1, z0, z1 in c["extras"]:
        G[m_].append(box("x", x0, x1, y0, y1, z0, z1, m_))

    body = join([lower, cab] + G.pop("Body"), "Body")
    sel(body)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    objs = [body]
    for k, lst in G.items():
        if lst:
            objs.append(join(lst, k))
    return objs


# ---------------------------------------------------------------- запуск
old = bpy.data.scenes.get(SCENE)
if old:
    for o in list(old.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.scenes.remove(old)
for n in ("Flip_Pickup",):  # сцена старой версии скрипта
    if bpy.data.scenes.get(n):
        for o in list(bpy.data.scenes[n].objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.scenes.remove(bpy.data.scenes[n])
bpy.data.orphans_purge(do_recursive=True)
M = make_materials()  # после чистки: старые ссылки на материалы могли умереть
sc = bpy.data.scenes.new(SCENE)
bpy.context.window.scene = sc
os.makedirs(OUT_DIR, exist_ok=True)

result = {}
for i, (cid, spec) in enumerate(CARS.items()):
    col = bpy.data.collections.new(cid)
    sc.collection.children.link(col)
    objs = build(spec)
    sel(*objs)
    path = os.path.join(OUT_DIR, cid + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, use_active_scene=True, export_apply=True)
    result[cid] = {"bytes": os.path.getsize(path), "faces": sum(len(o.data.polygons) for o in objs)}
    for o in objs:  # в ряд для предпросмотра
        o.location.y += i * 2.6
