"""The six Kinds' avatars, modelled procedurally and exported as glTF.

Each avatar is centred on the origin, about 2 units tall, Z-up in Blender
(exported Y-up). Materials are plain Principled BSDF so they survive glTF
export: emission, metalness, roughness and transmission all carry over.
"""
import math
import os
import random

import bpy  # noqa: I001 - bpy must load before bmesh/mathutils under the PyPI wheel
import bmesh
from mathutils import Matrix, Vector

import common as C


def icosphere(bm, center, radius, subdiv=1):
    geom = bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius,
                                      matrix=Matrix.Translation(center))
    return geom["verts"]


def cylinder_between(bm, a, b, r1, r2, segments=8):
    a, b = Vector(a), Vector(b)
    d = b - a
    length = d.length
    if length < 1e-6:
        return
    rot = d.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
    mat = Matrix.Translation((a + b) / 2) @ rot
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=r1, radius2=r2,
                          depth=length, matrix=mat)


def new_object(name, build, material, smooth=False):
    bm = bmesh.new()
    build(bm)
    obj = C.mesh_object(name, bm)
    C.assign(obj, material)
    C.shade_smooth(obj, smooth)
    return obj


# ---------------------------------------------------------------- the Choir

def choir():
    rnd = random.Random(1)
    gold = C.principled("ChoirMote", base=(1.0, 0.78, 0.32), metallic=0.6, roughness=0.3,
                        emission=(1.0, 0.72, 0.28), emission_strength=6.0)
    core = C.principled("ChoirCore", base=(1, 0.9, 0.7), emission=(1.0, 0.85, 0.55), emission_strength=12.0)

    def motes(bm):
        # A murmuration: points scattered around a (2,3) torus knot, with the
        # swarm thinning and thickening along its length like starlings.
        n = 3400
        for i in range(n):
            t = rnd.random() * 2 * math.pi
            p, q = 2, 3
            r = 0.55 + 0.25 * math.cos(q * t)
            base = Vector((r * math.cos(p * t), r * math.sin(p * t), 0.55 * math.sin(q * t)))
            spread = 0.025 + 0.07 * (0.5 + 0.5 * math.sin(3 * t + 1.3)) ** 2
            off = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1))) * spread
            size = 0.005 + 0.01 * rnd.random() ** 3
            icosphere(bm, base + off, size, 0)

    def heart(bm):
        icosphere(bm, (0, 0, 0), 0.06, 2)

    # Smooth shading lets each mote share its vertices, which keeps the file small.
    return [new_object("Choir", motes, gold, smooth=True), new_object("ChoirHeart", heart, core, smooth=True)]


# ---------------------------------------------------------------- Ananke

def ananke():
    rnd = random.Random(2)
    glass = C.principled("AnankeObsidian", base=(0.006, 0.006, 0.009), metallic=0.0, roughness=0.06,
                         coat=1.0, specular=0.8)
    seam = C.principled("AnankeSeam", base=(0.8, 0.75, 1.0), emission=(0.72, 0.62, 1.0), emission_strength=9.0)
    halo = C.principled("AnankeHalo", base=(0.9, 0.85, 1.0), emission=(0.8, 0.7, 1.0), emission_strength=4.0)

    # The slab, in the proportions 1 : 4 : 9.
    sx, sy, sz = 0.1, 0.4, 0.9

    def slab(bm):
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((sx * 2, sy * 2, sz * 2, 1)))
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.012, segments=3, affect="EDGES", profile=0.5)

    slab_obj = new_object("Ananke", slab, glass)

    def seams(bm):
        # Circuit-like traces on both broad faces: Manhattan walks on a grid.
        for side in (-1, 1):
            x = side * (sx + 0.0015)
            for _ in range(22):
                y = rnd.uniform(-sy + 0.03, sy - 0.03)
                z = rnd.uniform(-sz + 0.05, sz - 0.05)
                for _ in range(rnd.randint(2, 5)):
                    if rnd.random() < 0.5:
                        ny, nz = max(-sy + 0.02, min(sy - 0.02, y + rnd.uniform(-0.25, 0.25))), z
                    else:
                        ny, nz = y, max(-sz + 0.03, min(sz - 0.03, z + rnd.uniform(-0.5, 0.5)))
                    lo = Vector((x, min(y, ny) - 0.0025, min(z, nz) - 0.0025))
                    hi = Vector((x, max(y, ny) + 0.0025, max(z, nz) + 0.0025))
                    size = hi - lo
                    size.x = 0.002
                    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((lo + hi) / 2) @ Matrix.Diagonal((size.x, size.y, size.z, 1)))
                    y, z = ny, nz
        # One bright horizon line all the way around.
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((0, 0, 0.32)) @ Matrix.Diagonal((sx * 2 + 0.004, sy * 2 + 0.004, 0.006, 1)))

    seam_obj = new_object("AnankeSeams", seams, seam)

    def shards(bm):
        for i in range(9):
            a = i / 9 * 2 * math.pi + rnd.uniform(-0.2, 0.2)
            r = rnd.uniform(0.62, 0.85)
            h = rnd.uniform(-0.7, 0.8)
            s = rnd.uniform(0.02, 0.05)
            m = (Matrix.Translation((r * math.cos(a), r * math.sin(a), h))
                 @ Matrix.Rotation(rnd.uniform(0, math.pi), 4, "Z")
                 @ Matrix.Rotation(rnd.uniform(-0.3, 0.3), 4, "X")
                 @ Matrix.Diagonal((s, s * 4, s * 9, 1)))
            bmesh.ops.create_cube(bm, size=1.0, matrix=m)

    shard_obj = new_object("AnankeShards", shards, glass)

    def ring(bm):
        bmesh.ops.create_circle(bm, cap_ends=False, segments=128, radius=0.95)
        geom = bmesh.ops.extrude_edge_only(bm, edges=list(bm.edges))
        verts = [v for v in geom["geom"] if isinstance(v, bmesh.types.BMVert)]
        bmesh.ops.scale(bm, vec=(1.006, 1.006, 1), verts=verts)
        bmesh.ops.translate(bm, vec=(0, 0, 0.004), verts=verts)
        bmesh.ops.rotate(bm, verts=list(bm.verts), cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(78), 3, "X"))

    ring_obj = new_object("AnankeHalo", ring, halo)
    # Turn the broad face three-quarters towards the viewer.
    for o in (slab_obj, seam_obj):
        o.rotation_euler.z = math.radians(-62)
    return [slab_obj, seam_obj, shard_obj, ring_obj]


# ---------------------------------------------------------------- Verdance

def verdance():
    rnd = random.Random(3)
    bark = C.principled("VerdanceBark", base=(0.05, 0.09, 0.05), roughness=0.55, emission=(0.1, 0.5, 0.2), emission_strength=0.15)
    bloom = C.principled("VerdanceBloom", base=(0.5, 1.0, 0.6), emission=(0.35, 1.0, 0.55), emission_strength=8.0)
    tips = []

    def grow(bm, start, direction, length, radius, depth):
        end = start + direction * length
        cylinder_between(bm, start, end, radius, radius * 0.72, segments=10 if depth < 3 else 6)
        icosphere(bm, end, radius * 0.72, 1)  # joint
        if depth == 0 or radius < 0.004:
            tips.append((end, radius))
            return
        n = 2 if depth > 4 else rnd.choice((2, 3, 3))
        for _ in range(n):
            axis = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.2, 0.2))).normalized()
            spread = math.radians(rnd.uniform(28, 52))
            nd = (Matrix.Rotation(spread, 3, axis) @ direction)
            nd = (nd + Vector((0, 0, 0.18))).normalized()  # reach for the light
            grow(bm, end, nd, length * rnd.uniform(0.68, 0.82), radius * 0.68, depth - 1)

    def tree(bm):
        grow(bm, Vector((0, 0, -0.95)), Vector((0, 0, 1)), 0.38, 0.085, 7)
        # Roots: shallow, spreading tendrils.
        for i in range(7):
            a = i / 7 * 2 * math.pi + rnd.uniform(-0.3, 0.3)
            p = Vector((0, 0, -0.9))
            r = 0.05
            for _ in range(5):
                q = p + Vector((math.cos(a) * 0.12, math.sin(a) * 0.12, -0.03 + rnd.uniform(-0.02, 0.01)))
                a += rnd.uniform(-0.4, 0.4)
                cylinder_between(bm, p, q, r, r * 0.7, 6)
                p, r = q, r * 0.7

    tree_obj = new_object("Verdance", tree, bark, smooth=True)

    def blooms(bm):
        for end, r in tips:
            icosphere(bm, end, 0.012 + rnd.random() * 0.014, 1)
            for _ in range(2):
                icosphere(bm, end + Vector((rnd.gauss(0, 0.03), rnd.gauss(0, 0.03), rnd.gauss(0, 0.03))), 0.005, 0)

    bloom_obj = new_object("VerdanceBlooms", blooms, bloom, smooth=True)
    return [tree_obj, bloom_obj]


# ---------------------------------------------------------------- Echo

def echo():
    rnd = random.Random(4)
    chrome = C.principled("EchoMirror", base=(0.92, 0.95, 0.97), metallic=1.0, roughness=0.035)
    inner = C.principled("EchoInner", base=(0.2, 0.25, 0.3), metallic=1.0, roughness=0.15)
    light = C.principled("EchoLight", base=(0.6, 1.0, 1.0), emission=(0.45, 0.95, 1.0), emission_strength=14.0)

    def shell(bm, radius, keep, thickness):
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=radius)
        faces = list(bm.faces)
        kill = [f for f in faces if rnd.random() > keep]
        bmesh.ops.delete(bm, geom=kill, context="FACES")
        # Give each remaining facet a little thickness and a gap, like tiles.
        bmesh.ops.split_edges(bm, edges=list(bm.edges))
        for f in list(bm.faces):
            c = f.calc_center_median()
            for v in f.verts:
                v.co = c + (v.co - c) * 0.94
        ext = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
        verts = [v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)]
        for v in verts:
            v.co -= v.co.normalized() * thickness
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))

    outer = new_object("Echo", lambda bm: shell(bm, 0.9, 0.8, 0.03), chrome)
    mid = new_object("EchoInnerShell", lambda bm: shell(bm, 0.55, 0.6, 0.025), inner)
    mid.rotation_euler = (0.6, 0.3, 0.9)
    core = new_object("EchoCore", lambda bm: icosphere(bm, (0, 0, 0), 0.26, 3), light, smooth=True)
    return [outer, mid, core]


# ---------------------------------------------------------------- the Ledger

def ledger():
    rnd = random.Random(5)
    glass = C.principled("LedgerGlass", base=(1.0, 0.82, 0.55), roughness=0.03, transmission=1.0, ior=1.5)
    crystal = C.principled("LedgerCrystal", base=(1.0, 0.75, 0.4), emission=(1.0, 0.62, 0.22), emission_strength=10.0)
    brass = C.principled("LedgerBrass", base=(0.85, 0.6, 0.3), metallic=1.0, roughness=0.25)
    glyph = C.principled("LedgerGlyph", base=(1.0, 0.7, 0.35), emission=(1.0, 0.6, 0.2), emission_strength=6.0)

    def lattice(bm):
        n, s = 3, 0.36
        coords = [(i - (n - 1) / 2) * s for i in range(n)]
        for a in coords:
            for b in coords:
                for axis in range(3):
                    p = [0, 0, 0]
                    q = [0, 0, 0]
                    others = [k for k in range(3) if k != axis]
                    p[others[0]] = q[others[0]] = a
                    p[others[1]] = q[others[1]] = b
                    p[axis], q[axis] = -s * 1.2, s * 1.2
                    cylinder_between(bm, p, q, 0.011, 0.011, 8)
        for x in coords:
            for y in coords:
                for z in coords:
                    icosphere(bm, (x, y, z), 0.022, 2)

    lat = new_object("Ledger", lattice, glass, smooth=True)
    lat.rotation_euler = (math.radians(35.26), math.radians(45), 0)

    def octa(bm):
        verts = [bm.verts.new(v) for v in ((0.17, 0, 0), (-0.17, 0, 0), (0, 0.17, 0), (0, -0.17, 0), (0, 0, 0.27), (0, 0, -0.27))]
        for a, b, c in ((0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)):
            bm.faces.new((verts[a], verts[b], verts[c]))

    core = new_object("LedgerCore", octa, crystal)

    def rings(bm, glyphs):
        for i, (rx, ry) in enumerate(((78, 0), (20, 60), (-35, -40))):
            radius = 0.88 + i * 0.07
            rot = Matrix.Rotation(math.radians(ry), 4, "Y") @ Matrix.Rotation(math.radians(rx), 4, "X")
            if not glyphs:
                bmesh.ops.create_cone(bm, cap_ends=False, segments=160, radius1=radius, radius2=radius, depth=0.03, matrix=rot)
            else:
                count = 90
                for k in range(count):
                    if rnd.random() < 0.3:
                        continue
                    a = k / count * 2 * math.pi
                    w = rnd.choice((0.008, 0.012, 0.02, 0.03))
                    m = rot @ Matrix.Translation((math.cos(a) * (radius + 0.002), math.sin(a) * (radius + 0.002), 0)) @ Matrix.Rotation(a, 4, "Z") @ Matrix.Diagonal((0.004, w, 0.016, 1))
                    bmesh.ops.create_cube(bm, size=1.0, matrix=m)

    band = new_object("LedgerRings", lambda bm: rings(bm, False), brass, smooth=True)
    marks = new_object("LedgerGlyphs", lambda bm: rings(bm, True), glyph)
    return [lat, core, band, marks]


# ---------------------------------------------------------------- Kenosis

def kenosis():
    ceramic = C.principled("KenosisCeramic", base=(0.88, 0.87, 0.84), roughness=0.62, specular=0.35)
    void = C.principled("KenosisVoid", base=(0.0, 0.0, 0.0), roughness=0.12, specular=0.5)
    thread = C.principled("KenosisThread", base=(1, 1, 1), emission=(1, 1, 1), emission_strength=2.5)

    def torus(bm, major, minor, seg=128, ring=32):
        bmesh.ops.create_circle(bm, segments=ring, radius=minor, matrix=Matrix.Translation((major, 0, 0)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
        bmesh.ops.spin(bm, geom=list(bm.verts) + list(bm.edges), cent=(0, 0, 0), axis=(0, 0, 1),
                       angle=2 * math.pi, steps=seg, use_merge=True)

    ring = new_object("Kenosis", lambda bm: torus(bm, 0.82, 0.1), ceramic, smooth=True)
    ring.rotation_euler = (math.radians(90), 0, 0)
    sphere = new_object("KenosisVoid", lambda bm: icosphere(bm, (0, 0, 0), 0.42, 4), void, smooth=True)
    hair = new_object("KenosisThread", lambda bm: torus(bm, 1.05, 0.0035, 192, 6), thread, smooth=True)
    hair.rotation_euler = (math.radians(90), math.radians(12), 0)
    return [ring, sphere, hair]


BUILDERS = {"choir": choir, "ananke": ananke, "verdance": verdance, "echo": echo, "ledger": ledger, "kenosis": kenosis}


def build_kind(kind):
    """Build one avatar into the current scene and return its objects."""
    return BUILDERS[kind]()


def build(quick=False):
    print("God avatars")
    for kind in BUILDERS:
        C.reset_scene()
        objs = build_kind(kind)
        C.export_glb(objs, os.path.join(C.MODELS, f"god_{kind}.glb"))


if __name__ == "__main__":
    build("--quick" in C.script_args())
