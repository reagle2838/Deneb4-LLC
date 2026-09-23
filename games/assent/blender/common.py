"""Shared helpers for the ASSENT Blender asset pipeline.

Every script here runs headless, either inside Blender
(`blender -b -P blender/build_all.py -- [options]`) or with the `bpy` wheel from
PyPI (`python blender/build_all.py [options]`). Outputs go to web/public/assets.
"""
import math
import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, "web", "public", "assets")
CACHE = os.path.join(HERE, ".cache")
MODELS = os.path.join(ASSETS, "models")
TEXTURES = os.path.join(ASSETS, "textures")
ART = os.path.join(ASSETS, "art")

for d in (CACHE, MODELS, TEXTURES, ART):
    os.makedirs(d, exist_ok=True)


def script_args():
    """Arguments after `--` inside Blender, or sys.argv[1:] under the bpy wheel."""
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1:]
    if sys.argv and sys.argv[0].endswith(".py"):
        return sys.argv[1:]
    return []


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    return scene


def cycles(scene, samples=64, width=1920, height=1080, denoise=True, transparent=False):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = denoise
    scene.cycles.use_adaptive_sampling = True
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Punchy"
    scene.render.threads_mode = "AUTO"
    return scene


def world_color(scene, rgb=(0, 0, 0), strength=1.0):
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*rgb, 1)
    bg.inputs["Strength"].default_value = strength
    scene.world = world
    return world


def principled(name, base=(0.8, 0.8, 0.8), metallic=0.0, roughness=0.5, emission=None,
               emission_strength=0.0, transmission=0.0, ior=1.45, alpha=1.0, coat=0.0,
               specular=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["IOR"].default_value = ior
    bsdf.inputs["Specular IOR Level"].default_value = specular
    bsdf.inputs["Transmission Weight"].default_value = transmission
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Alpha"].default_value = alpha
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1.0:
        mat.blend_method = "BLEND"
    return mat


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def camera(location, target=(0, 0, 0), lens=50, name="Camera", dof=None):
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam_data.clip_start = 0.01
    cam_data.clip_end = 10000
    cam = bpy.data.objects.new(name, cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = location
    look_at(cam, target)
    if dof:
        cam_data.dof.use_dof = True
        cam_data.dof.focus_distance = dof[0]
        cam_data.dof.aperture_fstop = dof[1]
    bpy.context.scene.camera = cam
    return cam


def look_at(obj, target):
    from mathutils import Vector
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def area_light(name, location, target=(0, 0, 0), energy=500, size=2.0, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    look_at(obj, target)
    return obj


def sun_light(name, direction_from, energy=4.0, color=(1, 0.97, 0.92), angle_deg=0.53):
    from mathutils import Vector
    data = bpy.data.lights.new(name, "SUN")
    data.energy = energy
    data.color = color
    data.angle = math.radians(angle_deg)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = Vector(direction_from) * 10
    look_at(obj, (0, 0, 0))
    return obj


def render_to(scene, path, fmt="JPEG", quality=90):
    scene.render.image_settings.file_format = fmt
    if fmt == "JPEG":
        scene.render.image_settings.quality = quality
        scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"  rendered {os.path.relpath(path, ROOT)}")


# ---------------------------------------------------------------- image I/O

def load_image_array(path):
    """Load an image file into a float32 (H, W, 4) array, top row first."""
    img = bpy.data.images.load(path)
    w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    return buf.reshape(h, w, 4)[::-1].copy()


def save_array(arr, path, fmt="JPEG", quality=88, colorspace="sRGB"):
    """Save an (H, W, C) float array (top row first) with Blender's writer."""
    arr = np.clip(arr, 0, 1).astype(np.float32)
    if arr.ndim == 2:
        arr = arr[..., None]
    h, w, c = arr.shape
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = arr[..., :3] if c >= 3 else np.repeat(arr[..., :1], 3, axis=2)
    if c == 4:
        rgba[..., 3] = arr[..., 3]
    name = os.path.basename(path)
    img = bpy.data.images.new(name, w, h, alpha=(c == 4), float_buffer=False)
    img.colorspace_settings.name = colorspace
    img.pixels.foreach_set(rgba[::-1].ravel())
    img.filepath_raw = path
    img.file_format = fmt
    settings = bpy.context.scene.render.image_settings
    settings.file_format = fmt
    settings.color_mode = "RGBA" if c == 4 else "RGB"
    settings.quality = quality
    img.save_render(path, scene=bpy.context.scene)
    bpy.data.images.remove(img)
    print(f"  wrote {os.path.relpath(path, ROOT)} ({w}x{h})")


def resample(arr, width, height):
    """Bilinear resample of an (H, W, C) array."""
    h, w = arr.shape[:2]
    ys = np.linspace(0, h - 1, height)
    xs = np.linspace(0, w - 1, width)
    y0 = np.floor(ys).astype(int)
    x0 = np.floor(xs).astype(int)
    y1 = np.minimum(y0 + 1, h - 1)
    x1 = np.minimum(x0 + 1, w - 1)
    fy = (ys - y0)[:, None, None]
    fx = (xs - x0)[None, :, None]
    a = arr[y0][:, x0]
    b = arr[y0][:, x1]
    c = arr[y1][:, x0]
    d = arr[y1][:, x1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def blur(arr, radius):
    """Separable box blur repeated 3x (≈ gaussian). Wraps horizontally."""
    if radius < 1:
        return arr
    out = arr.astype(np.float32)
    k = 2 * radius + 1
    for _ in range(3):
        c = np.cumsum(np.concatenate([out[:, -radius - 1:], out, out[:, :radius]], axis=1), axis=1)
        out = (c[:, k:] - c[:, :-k]) / k
        pad = np.concatenate([np.repeat(out[:1], radius + 1, axis=0), out, np.repeat(out[-1:], radius, axis=0)], axis=0)
        c = np.cumsum(pad, axis=0)
        out = (c[k:] - c[:-k]) / k
    return out


def export_glb(objects, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_draco_mesh_compression_enable=False,
    )
    print(f"  exported {os.path.relpath(path, ROOT)} ({os.path.getsize(path) // 1024} KB)")


def join(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.data.name = name
    return obj


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mesh_object(name, bm):
    import bmesh  # noqa: F401  (bm is a bmesh.types.BMesh)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    return link(obj)


def shade_smooth(obj, smooth=True):
    for poly in obj.data.polygons:
        poly.use_smooth = smooth
