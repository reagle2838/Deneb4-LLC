"""Earth surface textures for ASSENT.

Sources (public domain), read from the `basemap-data` wheel on PyPI so the
pipeline needs no special download site:
  * bmng.jpg     NASA Blue Marble Next Generation (albedo, bathymetry shading)
  * etopo1.jpg   NOAA ETOPO1 hypsometric tint (land/sea mask, elevation proxy)
  * shadedrelief.jpg  shaded relief (fine mountain detail)

Produces, in web/public/assets/textures:
  earth_albedo.jpg   colour-graded daytime surface
  earth_normal.jpg   tangent-space normal map derived from elevation
  earth_spec.jpg     ocean/ice specular + roughness mask
  earth_lights.jpg   night lights (settlement model, see below)
  earth_clouds.jpg   procedural clouds rendered in Cycles (clouds.py)
"""
import glob
import os
import subprocess
import sys
import zipfile

import numpy as np

import common as C

W, H = 4096, 2048
NEEDED = ["bmng.jpg", "etopo1.jpg", "shadedrelief.jpg"]


def fetch_data():
    """Return a dict of source image paths, fetching basemap-data if needed."""
    out = {n: os.path.join(C.CACHE, n) for n in NEEDED}
    if all(os.path.exists(p) for p in out.values()):
        return out
    wheels = glob.glob(os.path.join(C.CACHE, "basemap_data-*.whl"))
    if not wheels:
        print("  downloading basemap-data (public-domain NASA/NOAA imagery) from PyPI…")
        for cmd in ([sys.executable, "-m", "pip"], ["pip3"], ["pip"]):
            try:
                subprocess.run(cmd + ["download", "basemap-data==2.0.0", "--no-deps", "-d", C.CACHE], check=True)
                break
            except Exception:  # noqa: BLE001 - try the next pip
                continue
        wheels = glob.glob(os.path.join(C.CACHE, "basemap_data-*.whl"))
        if not wheels:
            raise SystemExit("Could not fetch basemap-data. Run: pip download basemap-data==2.0.0 --no-deps -d " + C.CACHE)
    with zipfile.ZipFile(wheels[0]) as z:
        for n in NEEDED:
            with z.open(f"mpl_toolkits/basemap_data/{n}") as src, open(out[n], "wb") as dst:
                dst.write(src.read())
    return out


def lat_lon_grid(w, h):
    lat = np.linspace(90, -90, h, endpoint=False) - 90.0 / h
    lon = np.linspace(-180, 180, w, endpoint=False) + 180.0 / w
    return np.meshgrid(lon, lat)


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    d = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, (mx - mn) / (mx + 1e-6), 0)
    return h, s, mx


def elevation_and_masks(etopo):
    """Invert the ETOPO1 hypsometric tint to an elevation proxy in [0, 1]."""
    rgb = etopo[..., :3]
    hue, sat, val = rgb_to_hsv(rgb)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    ice = (r > 0.82) & (g > 0.82) & (b > 0.82)
    water = (b > r + 0.12) & (b > g - 0.02) & ~ice
    # Ocean depth: light cyan shelf → deep navy.
    depth = np.clip(1.0 - val, 0, 1)
    # Land: green (lowland) → yellow/tan → brown → grey-violet (high).
    land_h = np.clip((125.0 - np.where(hue > 200, 0, hue)) / 105.0, 0, 1) * 0.7
    land_h += np.clip((0.55 - sat), 0, 0.55) * np.clip(1.1 - val, 0, 1) * 0.9
    land_h = np.clip(land_h, 0, 1)
    height = np.where(water, -depth * 0.35, np.where(ice, 0.55, land_h))
    return height.astype(np.float32), water, ice


def normal_from_height(height, strength):
    h, w = height.shape
    _, lat = lat_lon_grid(w, h)
    coslat = np.clip(np.cos(np.radians(lat)), 0.05, 1)
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) / coslat
    dy = np.vstack([height[1:2] - height[0:1], height[2:] - height[:-2], height[-1:] - height[-2:-1]])
    nx = -dx * strength
    ny = dy * strength  # image rows run north→south; +V is north
    nz = np.ones_like(nx)
    n = np.stack([nx, ny, nz], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


# Largest metropolitan areas (approx. lat, lon, weight). Night lights are a
# settlement model, not satellite data: cities plus fertile, low coastal land.
CITIES = [
    (35.7, 139.7, 1.0), (28.6, 77.2, 1.0), (31.2, 121.5, 1.0), (23.8, 90.4, 0.9), (19.1, 72.9, 1.0),
    (-23.5, -46.6, 0.9), (19.4, -99.1, 0.9), (30.0, 31.2, 0.9), (39.9, 116.4, 1.0), (34.7, 135.5, 0.8),
    (40.7, -74.0, 1.0), (22.6, 88.4, 0.8), (6.5, 3.4, 0.9), (-34.6, -58.4, 0.7), (41.0, 29.0, 0.8),
    (29.6, 106.5, 0.7), (14.6, 121.0, 0.8), (-22.9, -43.2, 0.7), (23.1, 113.3, 0.9), (22.5, 114.1, 0.9),
    (34.1, -118.2, 0.9), (55.8, 37.6, 0.8), (51.5, -0.1, 0.8), (48.9, 2.35, 0.8), (-6.2, 106.8, 0.9),
    (13.1, 80.3, 0.7), (12.97, 77.6, 0.8), (-12.0, -77.0, 0.6), (4.7, -74.1, 0.6), (13.8, 100.5, 0.8),
    (35.7, 51.4, 0.7), (24.9, 67.0, 0.8), (31.5, 74.3, 0.7), (41.9, -87.6, 0.7), (29.8, -95.4, 0.6),
    (43.7, -79.4, 0.6), (25.2, 55.3, 0.6), (24.7, 46.7, 0.5), (-33.9, 151.2, 0.5), (-37.8, 145.0, 0.5),
    (1.35, 103.8, 0.6), (3.1, 101.7, 0.5), (10.8, 106.7, 0.7), (21.0, 105.8, 0.6), (37.6, 127.0, 0.9),
    (-1.3, 36.8, 0.5), (9.0, 38.7, 0.5), (-26.2, 28.0, 0.6), (5.6, -0.2, 0.5), (33.6, -7.6, 0.5),
    (52.5, 13.4, 0.6), (50.1, 8.7, 0.5), (45.5, 9.2, 0.6), (40.4, -3.7, 0.6), (41.4, 2.2, 0.5),
    (59.9, 10.75, 0.3), (59.3, 18.1, 0.35), (55.0, 82.9, 0.35), (49.3, -123.1, 0.4), (47.6, -122.3, 0.5),
    (37.8, -122.4, 0.6), (33.4, -112.1, 0.5), (32.8, -96.8, 0.6), (25.8, -80.2, 0.6), (38.9, -77.0, 0.6),
    (42.4, -71.1, 0.5), (45.5, -73.6, 0.45), (-15.8, -47.9, 0.4), (-3.1, -60.0, 0.25), (13.5, 2.1, 0.25),
    (-4.3, 15.3, 0.5), (15.6, 32.5, 0.45), (36.8, 3.1, 0.45), (31.6, -8.0, 0.35), (30.3, -97.7, 0.4),
]


def night_lights(water, ice, height, albedo, rng):
    h, w = water.shape
    lon, lat = lat_lon_grid(w, h)
    land = (~water & ~ice).astype(np.float32)
    # Fertility: greener land, low elevation, temperate/tropical latitudes.
    green = np.clip(albedo[..., 1] - albedo[..., 0] * 0.7, 0, 1) * 3
    lowland = np.clip(1.0 - height * 2.2, 0, 1)
    climate = np.clip(1.0 - np.abs(np.abs(lat) - 30) / 38, 0, 1)
    coast = np.clip(C.blur(water.astype(np.float32), 6) * 3, 0, 1) * land
    density = land * (0.1 + green) * lowland * climate ** 2 * (0.6 + coast * 0.8)
    density = density / density.sum()
    lights = np.zeros((h, w), np.float32)
    # Scattered towns and villages.
    idx = rng.choice(h * w, size=160000, p=density.ravel())
    ys, xs = np.divmod(idx, w)
    np.add.at(lights, (ys, xs), rng.uniform(0.05, 0.5, len(idx)).astype(np.float32))
    # Cities: a bright core with a heavy-tailed sprawl, pulled along random
    # "corridors" so they read as road networks rather than discs.
    scale = w / 4096
    for clat, clon, cw in CITIES:
        n = int(5000 * cw)
        r = rng.exponential(2.2 + 5.0 * cw, n) * scale
        ang = rng.uniform(0, 2 * np.pi, n)
        spokes = rng.uniform(0, 2 * np.pi, 5)
        snap = rng.random(n) < 0.45
        ang = np.where(snap, spokes[rng.integers(0, 5, n)] + rng.normal(0, 0.08, n), ang)
        cy = (90 - clat) / 180 * h
        cx = (clon + 180) / 360 * w
        py = np.clip((cy + r * np.sin(ang)).astype(int), 0, h - 1)
        px = (cx + r * np.cos(ang) / max(np.cos(np.radians(clat)), 0.3)).astype(int) % w
        keep = land[py, px] > 0
        np.add.at(lights, (py[keep], px[keep]), rng.uniform(0.1, 0.6, keep.sum()).astype(np.float32))
    glow = lights * 0.9 + C.blur(lights, 1) * 1.2 + C.blur(lights, 4) * 0.8
    glow = 1 - np.exp(-glow * 1.1)
    col = np.stack([glow * 1.0, glow * 0.74, glow * 0.42], -1)
    return col


def build(quick=False):
    print("Earth textures")
    src = fetch_data()
    bm = C.load_image_array(src["bmng.jpg"])[..., :3]
    et = C.load_image_array(src["etopo1.jpg"])[..., :3]
    sr = C.load_image_array(src["shadedrelief.jpg"])[..., :3]
    w, h = (2048, 1024) if quick else (W, H)
    bm = C.resample(bm, w, h)
    et = C.resample(et, w, h)
    sr = C.resample(sr, w, h)

    height, water, ice = elevation_and_masks(et)
    # Smooth the mask edges a touch so coasts don't alias.
    water_soft = np.clip(C.blur(water.astype(np.float32), 1), 0, 1)

    # Albedo: gentle grade. Deepen oceans, lift land saturation, keep ice bright.
    alb = bm.copy()
    lum = alb.mean(-1, keepdims=True)
    alb = np.clip(lum + (alb - lum) * 1.18, 0, 1)
    alb = alb ** np.array([1.05, 1.02, 1.0])
    ocean = np.array([0.015, 0.05, 0.11])
    alb = alb * (1 - water_soft[..., None] * 0.35) + ocean * water_soft[..., None] * 0.35
    C.save_array(alb, os.path.join(C.TEXTURES, "earth_albedo.jpg"), quality=90)

    # Normals: coarse elevation plus shaded-relief detail, faded to zero at
    # the coast so shorelines don't become cliffs.
    detail = sr.mean(-1)
    detail = detail - C.blur(detail, 3)
    inland = np.clip(1 - C.blur(water.astype(np.float32), 3) * 2.5, 0, 1)
    land_height = (C.blur(np.where(water, 0.0, height), 2) * 0.6 + detail * 0.35) * inland
    nrm = normal_from_height(land_height, strength=w / 1024 * 3.5)
    C.save_array(nrm, os.path.join(C.TEXTURES, "earth_normal.jpg"), quality=90, colorspace="Non-Color")

    # Spec mask: R = ocean glint, G = ice, B = elevation (for the shader).
    spec = np.stack([water_soft, ice.astype(np.float32), np.clip(height * 1.4, 0, 1)], -1)
    C.save_array(spec, os.path.join(C.TEXTURES, "earth_spec.jpg"), quality=90, colorspace="Non-Color")

    lights = night_lights(water, ice, height, bm, np.random.default_rng(2071))
    C.save_array(lights, os.path.join(C.TEXTURES, "earth_lights.jpg"), quality=88)


if __name__ == "__main__":
    build("--quick" in C.script_args())
