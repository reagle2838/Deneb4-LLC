"""Procedural clouds and the starfield, rendered by Cycles.

Both are world shaders rendered through an equirectangular panoramic camera,
which gives seamless lat/long maps with no UV distortion:
  earth_clouds.jpg  cloud coverage with realistic latitude banding
                    (ITCZ, subtropical clear belts, mid-latitude storm tracks)
  stars.jpg         star field with a dusty Milky Way band
"""
import math
import os

import bpy

import common as C


class Nodes:
    """Tiny helper for building node graphs by hand."""

    def __init__(self, tree):
        self.tree = tree
        self.nodes = tree.nodes
        self.links = tree.links

    def new(self, kind, inputs=None, **props):
        node = self.nodes.new(kind)
        for k, v in props.items():
            setattr(node, k, v)
        for k, v in (inputs or {}).items():
            self.set(node.inputs[k], v)
        return node

    def set(self, socket, value):
        if hasattr(value, "is_linked") or hasattr(value, "links"):
            self.links.new(value, socket)
        elif isinstance(value, bpy.types.NodeSocket):
            self.links.new(value, socket)
        else:
            socket.default_value = value

    def math(self, op, a, b=0.0, clamp=False):
        n = self.new("ShaderNodeMath", operation=op, use_clamp=clamp)
        self.set(n.inputs[0], a)
        self.set(n.inputs[1], b)
        return n.outputs[0]

    def vmath(self, op, a, b=(0, 0, 0), scale=None):
        n = self.new("ShaderNodeVectorMath", operation=op)
        self.set(n.inputs[0], a)
        self.set(n.inputs[1], b)
        if scale is not None:
            self.set(n.inputs[3], scale)
        return n.outputs["Vector"] if op not in ("DOT_PRODUCT", "LENGTH") else n.outputs["Value"]

    def noise(self, vector, scale, detail=8.0, roughness=0.55, lacunarity=2.0, distortion=0.0, dims="3D"):
        n = self.new("ShaderNodeTexNoise", noise_dimensions=dims)
        self.set(n.inputs["Vector"], vector)
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = roughness
        n.inputs["Lacunarity"].default_value = lacunarity
        n.inputs["Distortion"].default_value = distortion
        return n

    def gauss(self, x, center, width):
        d = self.math("SUBTRACT", x, center)
        d = self.math("DIVIDE", d, width)
        d = self.math("MULTIPLY", d, d)
        d = self.math("MULTIPLY", d, -1.0)
        return self.math("EXPONENT", d)


def panorama_scene(width, height, samples):
    scene = C.reset_scene()
    C.cycles(scene, samples=samples, width=width, height=height, denoise=False)
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    cam_data = bpy.data.cameras.new("Pano")
    cam_data.type = "PANO"
    cam_data.panorama_type = "EQUIRECTANGULAR"
    cam = bpy.data.objects.new("Pano", cam_data)
    scene.collection.objects.link(cam)
    # Looking along +X with +Z up, so the image centre is longitude 0.
    cam.rotation_euler = (math.radians(90), 0, math.radians(-90))
    scene.camera = cam
    world = bpy.data.worlds.new("Sky")
    world.use_nodes = True
    scene.world = world
    tree = world.node_tree
    tree.nodes.clear()
    return scene, Nodes(tree)


def render_clouds(width, height, samples):
    print("Clouds (Cycles world shader)")
    scene, N = panorama_scene(width, height, samples)
    coord = N.new("ShaderNodeTexCoord").outputs["Generated"]
    d = N.vmath("NORMALIZE", coord)
    z = N.new("ShaderNodeSeparateXYZ", {"Vector": d}).outputs["Z"]
    absz = N.math("ABSOLUTE", z)

    # Domain warp twice for swirling weather systems.
    w1 = N.noise(d, 1.2, detail=3, roughness=0.5).outputs["Color"]
    w1 = N.vmath("SUBTRACT", w1, (0.5, 0.5, 0.5))
    p1 = N.vmath("ADD", d, N.vmath("SCALE", w1, scale=0.45))
    w2 = N.noise(p1, 2.6, detail=4, roughness=0.55).outputs["Color"]
    w2 = N.vmath("SUBTRACT", w2, (0.5, 0.5, 0.5))
    p2 = N.vmath("ADD", p1, N.vmath("SCALE", w2, scale=0.12))

    base = N.noise(p2, 2.6, detail=12, roughness=0.58, lacunarity=2.1).outputs["Fac"]
    fine = N.noise(p2, 22.0, detail=10, roughness=0.6).outputs["Fac"]
    vor = N.new("ShaderNodeTexVoronoi", {"Vector": p2, "Scale": 60.0}, feature="SMOOTH_F1")
    vor.inputs["Smoothness"].default_value = 0.6
    cells = N.math("SUBTRACT", 1.0, vor.outputs["Distance"])

    # Latitude structure.
    itcz = N.math("MULTIPLY", N.gauss(z, 0.08, 0.10), 0.10)
    subtropic = N.math("MULTIPLY", N.gauss(absz, 0.44, 0.13), -0.13)
    storms = N.math("MULTIPLY", N.gauss(absz, 0.80, 0.12), 0.10)
    polar = N.math("MULTIPLY", N.gauss(absz, 1.0, 0.08), -0.05)
    bands = N.math("ADD", N.math("ADD", itcz, subtropic), N.math("ADD", storms, polar))

    cov = N.math("ADD", base, bands)
    cov = N.math("ADD", cov, N.math("MULTIPLY", N.math("SUBTRACT", fine, 0.5), 0.12))
    cov = N.math("ADD", cov, N.math("MULTIPLY", N.math("SUBTRACT", cells, 0.6), 0.12))
    ramp = N.new("ShaderNodeMapRange", {"Value": cov, "From Min": 0.56, "From Max": 0.78, "To Min": 0.0, "To Max": 1.0}, interpolation_type="SMOOTHSTEP")
    dense = ramp.outputs["Result"]
    haze = N.math("MULTIPLY", N.new("ShaderNodeMapRange", {"Value": cov, "From Min": 0.46, "From Max": 0.66}, interpolation_type="SMOOTHSTEP").outputs["Result"], 0.18)
    total = N.math("MAXIMUM", dense, haze)

    bg = N.new("ShaderNodeBackground", {"Color": (1, 1, 1, 1)})
    N.set(bg.inputs["Strength"], total)
    out = N.new("ShaderNodeOutputWorld")
    N.links.new(bg.outputs["Background"], out.inputs["Surface"])
    C.render_to(scene, os.path.join(C.TEXTURES, "earth_clouds.jpg"), quality=90)


def render_stars(width, height, samples):
    print("Starfield (Cycles world shader)")
    scene, N = panorama_scene(width, height, samples)
    coord = N.new("ShaderNodeTexCoord").outputs["Generated"]
    d = N.vmath("NORMALIZE", coord)

    def star_layer(scale, size, power, gain):
        v = N.new("ShaderNodeTexVoronoi", {"Vector": d, "Scale": scale}, feature="F1")
        v.inputs["Randomness"].default_value = 1.0
        rnd = N.new("ShaderNodeSeparateColor", {"Color": v.outputs["Color"]})
        b = N.math("POWER", rnd.outputs["Red"], power)
        radius = N.math("ADD", N.math("MULTIPLY", b, size), size * 0.25)
        core = N.new("ShaderNodeMapRange", {"Value": v.outputs["Distance"], "From Min": 0.0, "To Min": 1.0, "To Max": 0.0}, interpolation_type="SMOOTHSTEP")
        N.set(core.inputs["From Max"], radius)
        inten = N.math("MULTIPLY", core.outputs["Result"], N.math("MULTIPLY", b, gain))
        # Colour temperature from the green channel of the cell colour.
        temp = N.new("ShaderNodeValToRGB", {"Fac": rnd.outputs["Green"]})
        cr = temp.color_ramp
        cr.elements[0].color = (1.0, 0.72, 0.5, 1)
        cr.elements[1].color = (0.62, 0.74, 1.0, 1)
        mid = cr.elements.new(0.55)
        mid.color = (1.0, 0.97, 0.92, 1)
        mix = N.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
        mix.inputs["Factor"].default_value = 1.0
        N.set(mix.inputs[6], temp.outputs["Color"])
        N.set(mix.inputs[7], (1, 1, 1, 1))
        col = N.vmath("SCALE", mix.outputs[2], scale=inten)
        return col

    s1 = star_layer(170.0, 0.03, 9.0, 30.0)
    s2 = star_layer(520.0, 0.045, 5.0, 6.0)
    s3 = star_layer(1300.0, 0.06, 3.0, 1.6)

    # Milky Way: a band around a tilted great circle, with dust lanes.
    tilt = (0.0, math.sin(math.radians(62)), math.cos(math.radians(62)))
    gc = (0.35, -0.9, 0.25)
    lat = N.vmath("DOT_PRODUCT", d, tilt)
    band = N.gauss(lat, 0.0, 0.1)
    core = N.math("POWER", N.math("ADD", N.math("MULTIPLY", N.vmath("DOT_PRODUCT", d, gc), 0.5), 0.5), 3.0)
    cloud = N.noise(d, 5.0, detail=12, roughness=0.62, distortion=0.4).outputs["Fac"]
    dust = N.noise(d, 9.0, detail=10, roughness=0.6, distortion=0.8).outputs["Fac"]
    dust = N.new("ShaderNodeMapRange", {"Value": dust, "From Min": 0.45, "From Max": 0.62, "To Min": 1.0, "To Max": 0.15}, interpolation_type="SMOOTHSTEP").outputs["Result"]
    dustband = N.gauss(lat, 0.0, 0.05)
    dust = N.math("ADD", N.math("MULTIPLY", N.math("SUBTRACT", dust, 1.0), dustband), 1.0)
    glow = N.math("MULTIPLY", band, N.math("POWER", cloud, 3.5))
    glow = N.math("MULTIPLY", glow, N.math("ADD", N.math("MULTIPLY", core, 1.8), 0.35))
    glow = N.math("MULTIPLY", glow, dust)
    mw = N.vmath("SCALE", (0.62, 0.66, 0.85), scale=N.math("MULTIPLY", glow, 0.3))
    warm = N.vmath("SCALE", (1.0, 0.78, 0.55), scale=N.math("MULTIPLY", N.math("MULTIPLY", glow, core), 0.45))
    # Faint band of unresolved stars.
    dense = N.vmath("SCALE", star_layer(2600.0, 0.09, 2.0, 1.0), scale=N.math("ADD", N.math("MULTIPLY", N.math("MULTIPLY", band, cloud), 6.0), 0.2))

    total = N.vmath("ADD", N.vmath("ADD", s1, s2), N.vmath("ADD", s3, mw))
    total = N.vmath("ADD", total, N.vmath("ADD", warm, dense))
    bg = N.new("ShaderNodeBackground", {"Strength": 1.0})
    N.set(bg.inputs["Color"], total)
    out = N.new("ShaderNodeOutputWorld")
    N.links.new(bg.outputs["Background"], out.inputs["Surface"])
    C.render_to(scene, os.path.join(C.TEXTURES, "stars.jpg"), quality=88)


def build(quick=False):
    if quick:
        render_clouds(1024, 512, 2)
        render_stars(2048, 1024, 4)
    else:
        render_clouds(4096, 2048, 4)
        render_stars(4096, 2048, 8)


if __name__ == "__main__":
    build("--quick" in C.script_args())
