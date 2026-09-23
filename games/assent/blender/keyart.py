"""Cycles key art: a studio portrait of each Kind and the title image.

  art/god_<kind>.jpg   portrait, used on the selection screen and in the Codex
  art/title.jpg        Earth from orbit at the terminator, for the title screen
"""
import math
import os

import bpy

import common as C
import gods

KIND_LIGHT = {
    "choir": (1.0, 0.78, 0.4),
    "ananke": (0.75, 0.65, 1.0),
    "verdance": (0.45, 1.0, 0.6),
    "echo": (0.5, 0.95, 1.0),
    "ledger": (1.0, 0.7, 0.35),
    "kenosis": (1.0, 1.0, 1.0),
}


def studio(kind, width, height, samples):
    scene = C.reset_scene()
    C.cycles(scene, samples=samples, width=width, height=height)
    scene.cycles.max_bounces = 8
    scene.cycles.transmission_bounces = 8
    C.world_color(scene, (0.004, 0.005, 0.008), 1.0)
    for o in gods.build_kind(kind):
        o.location.z += 0.1
    tint = KIND_LIGHT[kind]

    # Dark, slightly glossy floor that fades into the void.
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -1.05))
    floor = bpy.context.object
    floor_mat = C.principled("Floor", base=(0.012, 0.012, 0.014), roughness=0.22, specular=0.6)
    C.assign(floor, floor_mat)

    C.area_light("Key", (2.6, -2.4, 2.4), energy=380, size=1.8, color=(1, 0.97, 0.94))
    C.area_light("Rim", (-2.2, 2.6, 1.6), energy=520, size=1.2, color=tint)
    C.area_light("Fill", (-3.0, -2.0, 0.2), energy=60, size=4.0, color=(0.7, 0.78, 1.0))
    C.area_light("Top", (0, 0, 4.0), energy=140, size=2.5, color=tint)
    C.camera((0, -5.2, 0.35), target=(0, 0, 0.1), lens=58, dof=(5.2, 2.8))
    C.render_to(scene, os.path.join(C.ART, f"god_{kind}.jpg"), quality=88)


def title(width, height, samples):
    """Earth at the terminator with city lights, clouds and a thin atmosphere."""
    scene = C.reset_scene()
    C.cycles(scene, samples=samples, width=width, height=height)
    tex = lambda n: bpy.data.images.load(os.path.join(C.TEXTURES, n))  # noqa: E731

    world = C.world_color(scene, (0, 0, 0), 1.0)
    nt = world.node_tree
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = tex("stars.jpg")
    nt.links.new(env.outputs["Color"], nt.nodes["Background"].inputs["Color"])
    nt.nodes["Background"].inputs["Strength"].default_value = 0.6

    bpy.ops.mesh.primitive_uv_sphere_add(segments=256, ring_count=128, radius=1.0)
    earth = bpy.context.object
    C.shade_smooth(earth)
    mat = bpy.data.materials.new("Earth")
    mat.use_nodes = True
    n = mat.node_tree.nodes
    L = mat.node_tree.links
    bsdf = n["Principled BSDF"]
    uv = n.new("ShaderNodeTexCoord").outputs["UV"]

    def img(name, non_color=False):
        t = n.new("ShaderNodeTexImage")
        t.image = tex(name)
        if non_color:
            t.image.colorspace_settings.name = "Non-Color"
        L.new(uv, t.inputs["Vector"])
        return t

    albedo = img("earth_albedo.jpg")
    spec = img("earth_spec.jpg", True)
    normal = img("earth_normal.jpg", True)
    lights = img("earth_lights.jpg")
    L.new(albedo.outputs["Color"], bsdf.inputs["Base Color"])
    sep = n.new("ShaderNodeSeparateColor")
    L.new(spec.outputs["Color"], sep.inputs["Color"])
    rough = n.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.85
    rough.inputs["To Max"].default_value = 0.28
    L.new(sep.outputs["Red"], rough.inputs["Value"])
    L.new(rough.outputs["Result"], bsdf.inputs["Roughness"])
    nm = n.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.6
    L.new(normal.outputs["Color"], nm.inputs["Color"])
    L.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    # City lights only on the night side: fade by the angle to the sun.
    sun_dir = (3.0, 0.9, 0.7)
    geo = n.new("ShaderNodeNewGeometry")
    dot = n.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = tuple(c / math.sqrt(sum(x * x for x in sun_dir)) for c in sun_dir)
    L.new(geo.outputs["Normal"], dot.inputs[0])
    night = n.new("ShaderNodeMapRange")
    night.inputs["From Min"].default_value = 0.08
    night.inputs["From Max"].default_value = -0.12
    L.new(dot.outputs["Value"], night.inputs["Value"])
    emit = n.new("ShaderNodeMix")
    emit.data_type = "RGBA"
    emit.blend_type = "MULTIPLY"
    emit.inputs["Factor"].default_value = 1.0
    L.new(lights.outputs["Color"], emit.inputs[6])
    L.new(night.outputs["Result"], emit.inputs[7])
    L.new(emit.outputs[2], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.1
    C.assign(earth, mat)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=256, ring_count=128, radius=1.008)
    clouds = bpy.context.object
    C.shade_smooth(clouds)
    cm = bpy.data.materials.new("Clouds")
    cm.use_nodes = True
    cn = cm.node_tree.nodes
    cl = cm.node_tree.links
    cb = cn["Principled BSDF"]
    ct = cn.new("ShaderNodeTexImage")
    ct.image = tex("earth_clouds.jpg")
    cl.new(cn.new("ShaderNodeTexCoord").outputs["UV"], ct.inputs["Vector"])
    cb.inputs["Base Color"].default_value = (1, 1, 1, 1)
    cb.inputs["Roughness"].default_value = 0.9
    cl.new(ct.outputs["Color"], cb.inputs["Alpha"])
    C.assign(clouds, cm)

    # Atmosphere: a thin scattering shell.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=1.035)
    atmo = bpy.context.object
    C.shade_smooth(atmo)
    am = bpy.data.materials.new("Atmosphere")
    am.use_nodes = True
    an = am.node_tree.nodes
    an.remove(an["Principled BSDF"])
    vol = an.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.28, 0.5, 1.0, 1)
    vol.inputs["Density"].default_value = 3.0
    vol.inputs["Anisotropy"].default_value = 0.3
    am.node_tree.links.new(vol.outputs["Volume"], an["Material Output"].inputs["Volume"])
    C.assign(atmo, am)

    # Rotate so Africa/Europe face the camera with the sun low on the right.
    for o in (earth, clouds):
        o.rotation_euler = (0, 0, math.radians(-100))
    C.sun_light("Sun", sun_dir, energy=6.0)
    C.camera((0.0, -3.05, 0.95), target=(0.15, 0, 0.55), lens=40)
    C.render_to(scene, os.path.join(C.ART, "title.jpg"), quality=90)


def build(quick=False):
    print("Key art (Cycles)")
    w, h, s = (480, 600, 16) if quick else (960, 1200, 64)
    for kind in gods.BUILDERS:
        studio(kind, w, h, s)
    title(*((960, 540, 16) if quick else (1920, 1080, 96)))


if __name__ == "__main__":
    args = C.script_args()
    only = [a for a in args if not a.startswith("--")]
    if only:
        for k in only:
            if k == "title":
                title(960, 540, 16)
            else:
                studio(k, 480, 600, 16)
    else:
        build("--quick" in args)
