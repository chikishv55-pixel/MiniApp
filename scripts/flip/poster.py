# Постер «Перекупщика Джо» для карточки в главном меню: public/games/flip/poster.jpg
#   exec(open(r"D:\MiniApp\scripts\flip\poster.py", encoding="utf-8").read())
# Берёт готовые pickup.glb и tools.glb: перед машины ржавый, зад свежевыкрашен, на границе — баллончик.
import bpy, os
from math import radians
from mathutils import Vector

DIR = r"D:\MiniApp\public\games\flip"
OUT = os.path.join(DIR, "poster.jpg")
SCENE = "Flip_Poster"

old = bpy.data.scenes.get(SCENE)
if old:
    for o in list(old.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.scenes.remove(old)
sc = bpy.data.scenes.new(SCENE)
bpy.context.window.scene = sc

bpy.ops.import_scene.gltf(filepath=os.path.join(DIR, "iaz.glb"))
car = list(bpy.context.selected_objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(DIR, "tools.glb"))
tools = {o.name: o for o in bpy.context.selected_objects}
for n, o in tools.items():
    if n.startswith("ToolSpray") and o.parent is None:
        spray = o
    elif o.parent is None:
        o.hide_render = True

# ---------- кузов: ржавчина спереди, свежая краска сзади (граница по X)
body = next(o for o in car if o.active_material and o.active_material.name.startswith("Body"))
m = bpy.data.materials.new("PosterBody")
m.use_nodes = True
nt = m.node_tree
N, L = nt.nodes, nt.links
bsdf = N["Principled BSDF"]
tc = N.new("ShaderNodeTexCoord")
sep = N.new("ShaderNodeSeparateXYZ")
L.new(tc.outputs["Object"], sep.inputs[0])
noise = N.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 9
noise.inputs["Detail"].default_value = 8
L.new(tc.outputs["Object"], noise.inputs["Vector"])
rust_ramp = N.new("ShaderNodeValToRGB")
rust_ramp.color_ramp.elements[0].color = (0.18, 0.06, 0.02, 1)
rust_ramp.color_ramp.elements[1].color = (0.55, 0.22, 0.07, 1)
L.new(noise.outputs["Fac"], rust_ramp.inputs[0])
# маска: X в glTF-импорте = вперёд машины; спереди (X > 0.3) ржаво, с рваным краем от шума
edge = N.new("ShaderNodeMath"); edge.operation = "ADD"
L.new(sep.outputs["X"], edge.inputs[0])
nmul = N.new("ShaderNodeMath"); nmul.operation = "MULTIPLY"; nmul.inputs[1].default_value = 0.9
L.new(noise.outputs["Fac"], nmul.inputs[0])
L.new(nmul.outputs[0], edge.inputs[1])
mask = N.new("ShaderNodeMapRange")
mask.inputs["From Min"].default_value = 0.7
mask.inputs["From Max"].default_value = 0.85
L.new(edge.outputs[0], mask.inputs["Value"])
mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"
mix.inputs["A"].default_value = (0.62, 0.05, 0.03, 1)  # свежая красная
L.new(rust_ramp.outputs["Color"], mix.inputs["B"])
L.new(mask.outputs["Result"], mix.inputs["Factor"])
L.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
rough = N.new("ShaderNodeMapRange")
rough.inputs["To Min"].default_value = 0.18
rough.inputs["To Max"].default_value = 0.95
L.new(mask.outputs["Result"], rough.inputs["Value"])
L.new(rough.outputs["Result"], bsdf.inputs["Roughness"])
body.data.materials.clear()
body.data.materials.append(m)

# ---------- баллончик у двери, распылителем к кузову (левый борт смотрит на +Y в Blender после импорта)
spray.rotation_mode = "XYZ"
spray.rotation_euler = (radians(90), 0, radians(-45))  # банка торчит наружу от борта (-Y), распылитель к двери
spray.location = (0.8, -1.0, 0.82)
spray.scale = (2.4, 2.4, 2.4)
for o in [spray] + list(spray.children_recursive):
    for slot in getattr(o, "material_slots", []):
        if slot.material and slot.material.name.startswith("SprayPaint"):
            slot.material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.62, 0.05, 0.03, 1)

# ---------- пол, свет, камера
bpy.ops.mesh.primitive_plane_add(size=30)
floor = bpy.context.active_object
fm = bpy.data.materials.new("PosterFloor"); fm.use_nodes = True
fm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.06, 0.04, 0.03, 1)
fm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
floor.data.materials.append(fm)

w = bpy.data.worlds.new("PosterWorld"); w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.03, 0.02, 0.015, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
sc.world = w

spot = bpy.data.objects.new("Spot", bpy.data.lights.new("Spot", "SPOT"))
spot.data.energy = 3800; spot.data.spot_size = radians(70); spot.data.spot_blend = 0.6
spot.data.color = (1.0, 0.86, 0.68)
spot.location = (1.5, -3.5, 6.5)
spot.rotation_euler = (Vector((0, 0, 0.6)) - spot.location).to_track_quat("-Z", "Y").to_euler()
sc.collection.objects.link(spot)
rim = bpy.data.objects.new("Rim", bpy.data.lights.new("Rim", "AREA"))
rim.data.energy = 500; rim.data.size = 4; rim.data.color = (0.75, 0.85, 1.0)
rim.location = (-4, 4, 3)
rim.rotation_euler = (Vector((0, 0, 0.8)) - rim.location).to_track_quat("-Z", "Y").to_euler()
sc.collection.objects.link(rim)

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
cam.data.lens = 40
cam.location = (4.6, -5.0, 2.3)
cam.rotation_euler = (Vector((0.2, 0, 0.75)) - cam.location).to_track_quat("-Z", "Y").to_euler()
sc.collection.objects.link(cam)
sc.camera = cam

sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = 600
sc.render.image_settings.file_format = "JPEG"
sc.render.image_settings.quality = 82
sc.view_settings.view_transform = "AgX"
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
result = {"file": OUT, "bytes": os.path.getsize(OUT)}
