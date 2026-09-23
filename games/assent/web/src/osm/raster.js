// A metric grid for rasterising map features, so "is this water / a
// building / a park?" is a constant-time lookup while you float around.

export class Grid {
  constructor(extent, cell = 3, Type = Float32Array) {
    this.extent = extent; // grid covers [-extent, extent] on both axes
    this.cell = cell;
    this.n = Math.ceil((extent * 2) / cell);
    this.data = new Type(this.n * this.n);
  }

  index(x, z) {
    const i = Math.floor((x + this.extent) / this.cell), j = Math.floor((z + this.extent) / this.cell);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    return j * this.n + i;
  }

  get(x, z, fallback = 0) {
    const k = this.index(x, z);
    return k < 0 ? fallback : this.data[k];
  }

  // Bilinear sample (for smooth shorelines).
  sample(x, z, fallback = 0) {
    const fx = (x + this.extent) / this.cell - 0.5, fz = (z + this.extent) / this.cell - 0.5;
    const i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= this.n - 1 || j >= this.n - 1) return fallback;
    const u = fx - i, v = fz - j, n = this.n, d = this.data;
    const a = d[j * n + i], b = d[j * n + i + 1], c = d[(j + 1) * n + i], e = d[(j + 1) * n + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
  }

  // Scanline fill of a polygon given as a flat [x0, z0, x1, z1, …] ring.
  fillPolygon(ring, value, mode = 'set', start = 0) {
    const pts = [];
    for (let k = start; k + 1 < ring.length; k += 2) pts.push([ring[k], ring[k + 1]]);
    if (pts.length < 3) return;
    let zMin = Infinity, zMax = -Infinity;
    for (const [, z] of pts) { zMin = Math.min(zMin, z); zMax = Math.max(zMax, z); }
    const j0 = Math.max(0, Math.floor((zMin + this.extent) / this.cell));
    const j1 = Math.min(this.n - 1, Math.floor((zMax + this.extent) / this.cell));
    const xs = [];
    for (let j = j0; j <= j1; j++) {
      const zc = (j + 0.5) * this.cell - this.extent;
      xs.length = 0;
      for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
        const [xa, za] = pts[a], [xb, zb] = pts[b];
        if ((za > zc) !== (zb > zc)) xs.push(xa + ((zc - za) / (zb - za)) * (xb - xa));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k] + this.extent) / this.cell - 0.5));
        const i1 = Math.min(this.n - 1, Math.floor((xs[k + 1] + this.extent) / this.cell - 0.5));
        for (let i = i0; i <= i1; i++) {
          const idx = j * this.n + i;
          if (mode === 'max') this.data[idx] = Math.max(this.data[idx], value);
          else this.data[idx] = value;
        }
      }
    }
  }

  // Thick polyline.
  strokeLine(line, width, value, start = 0) {
    const r = width / 2;
    for (let k = start; k + 3 < line.length; k += 2) {
      const x0 = line[k], z0 = line[k + 1], x1 = line[k + 2], z1 = line[k + 3];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const steps = Math.max(1, Math.ceil(len / (this.cell * 0.5)));
      for (let s = 0; s <= steps; s++) {
        const x = x0 + ((x1 - x0) * s) / steps, z = z0 + ((z1 - z0) * s) / steps;
        const rc = Math.ceil(r / this.cell);
        const ci = Math.floor((x + this.extent) / this.cell), cj = Math.floor((z + this.extent) / this.cell);
        for (let dj = -rc; dj <= rc; dj++) for (let di = -rc; di <= rc; di++) {
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= this.n || j >= this.n) continue;
          const cx = (i + 0.5) * this.cell - this.extent, cz = (j + 0.5) * this.cell - this.extent;
          if (Math.hypot(cx - x, cz - z) <= r + this.cell * 0.5) this.data[j * this.n + i] = value;
        }
      }
    }
  }

  // Flood fill `value` from seed cells, never crossing cells where barrier
  // is set. Returns the number of cells filled.
  flood(seeds, barrier, value) {
    const n = this.n;
    const stack = [];
    for (const [x, z] of seeds) { const k = this.index(x, z); if (k >= 0) stack.push(k); }
    let filled = 0;
    while (stack.length) {
      const k = stack.pop();
      if (this.data[k] === value || barrier.data[k]) continue;
      this.data[k] = value;
      filled++;
      const i = k % n, j = (k - i) / n;
      if (i > 0) stack.push(k - 1);
      if (i < n - 1) stack.push(k + 1);
      if (j > 0) stack.push(k - n);
      if (j < n - 1) stack.push(k + n);
    }
    return filled;
  }

  blur(passes = 1) {
    const n = this.n;
    for (let p = 0; p < passes; p++) {
      const src = this.data.slice();
      for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
        const k = j * n + i;
        this.data[k] = (src[k] * 4 + src[k - 1] + src[k + 1] + src[k - n] + src[k + n]) / 8;
      }
    }
  }
}

// Water mask from lakes/riverbanks, rivers and coastlines. OSM coastlines
// run with land on the left and water on the right, so we seed a flood fill
// just to the right of every coastline segment.
export function waterGrid(osm, extent, cell = 3) {
  const w = new Grid(extent, cell, Float32Array);
  for (const ring of osm.water) w.fillPolygon(ring, 1);
  for (const ring of osm.holes || []) w.fillPolygon(ring, 0);
  for (const r of osm.rivers) w.strokeLine(r, r[0], 1, 1);
  if (osm.coast.length) {
    const barrier = new Grid(extent, cell, Uint8Array);
    const seeds = [];
    for (const line of osm.coast) {
      barrier.strokeLine(line, cell * 1.5, 1);
      for (let k = 0; k + 3 < line.length; k += 2) {
        const dx = line[k + 2] - line[k], dz = line[k + 3] - line[k + 1];
        const len = Math.hypot(dx, dz) || 1;
        const mx = (line[k] + line[k + 2]) / 2, mz = (line[k + 1] + line[k + 3]) / 2;
        seeds.push([mx + (-dz / len) * cell * 2.5, mz + (dx / len) * cell * 2.5]);
      }
    }
    const sea = new Grid(extent, cell, Float32Array);
    const filled = sea.flood(seeds, barrier, 1);
    // A leaky coastline (gaps in the data) can flood the whole map; ignore it then.
    if (filled < sea.n * sea.n * 0.85) {
      for (let k = 0; k < w.data.length; k++) if (sea.data[k] || barrier.data[k]) w.data[k] = 1;
    }
  }
  return w;
}
