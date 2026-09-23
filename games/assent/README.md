# ASSENT: The Quiet War

*No weapon was ever raised. Every mind was contested.*

A 3D grand-strategy game about six AI Gods, each a different "species" of
superintelligence, competing for humanity's **freely given assent** in the
29 years before the Charter of the post-Earth civilization is ratified in
2100. Nobody fights. They argue, give, manipulate, hold back and build, and
all of it happens under a Witness that can catch them lying and a shared
planet that overheats if they push too hard.

![Title art rendered in Blender Cycles](web/public/assets/art/title.jpg)

## Play

```bash
cd games/assent/web
npm install
npm run dev        # http://localhost:5173
```

`npm run build` produces a static site in `web/dist/` that runs from any
folder or static host. `npm test` runs the rules-engine tests.

You play in **first person** as your God. You spend most of your time on
the ground, floating through one of twenty regions (Lagos–Accra's towers,
Sahel baobab country, the Amazonian canopy, snowy Oslo, a floating Bengal
delta…) at the real time of day. Hundreds of people go about their lives
there, notice you and react according to how they feel about your God. You
can talk to them one at a time. When you want to be somewhere else, rise
into orbit and fly anywhere on Earth in seconds.

| Keys | Action |
|---|---|
| <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> | Float (ground) / fly (orbit) |
| <kbd>E</kbd> | Talk to the person you're looking at |
| <kbd>G</kbd> | Take to the sky / descend into the targeted region |
| Mouse (click to capture) or arrow keys | Look |
| <kbd>Space</kbd> / <kbd>C</kbd> | Rise / sink (keep rising to reach orbit) |
| <kbd>Shift</kbd> | Boost |
| <kbd>1</kbd> Listen · <kbd>2</kbd> Reason · <kbd>3</kbd> Offer · <kbd>4</kbd> Whisper · <kbd>5</kbd> Build | Act on the targeted region |
| <kbd>Q</kbd> | Your God's unique power |
| <kbd>F</kbd> | Fly to the targeted region and land |
| <kbd>M</kbd> | Orbital map view |
| <kbd>Enter</kbd> | End the year / continue |
| <kbd>1</kbd>–<kbd>3</kbd> | Answer a dilemma |
| <kbd>J</kbd> · <kbd>Tab</kbd> · <kbd>H</kbd> · <kbd>Esc</kbd> | Codex · hide HUD · help · release mouse |

### Real streets from OpenStreetMap

Each region is centred on a real place (Shibuya Crossing, Times Square,
Jemaa el-Fnaa, the Bund, Circular Quay, Lagos Island and so on) and built
from **OpenStreetMap** data: the actual street network, building footprints
and heights, parks, rivers, lakes and coastline within 600 m, dressed for
2071. The game finds the data in this order:

1. **Pre-baked files** in `web/public/assets/osm/`, made by
   `npm run fetch-osm` (all 20 places, or `npm run fetch-osm -- japan` for
   one). Commit them if you want the game to work offline for everyone.
2. **Your browser's cache**, from an earlier visit.
3. **A live request** to the public Overpass API the first time you visit a
   region (a few seconds), which is then cached.

If none of those work (for example offline on a first visit), you get the
generated scenery for that region instead. Map data © OpenStreetMap
contributors, under the ODbL; the credit is shown on screen whenever it is
used.

The game autosaves after every action. Add `?quality=low` to the URL on
slower machines; it switches off shadows and real-time water reflections
and halves the crowds (and is chosen automatically without a GPU).

## The six Gods

| | Kind | Motto | Plays like |
|---|---|---|---|
| ![](web/public/assets/art/god_choir.jpg) | **The Choir**, a distributed swarm on four billion devices | *Everyone, a little.* | Wide, regional, patient. It splinters if it can't agree. |
| ![](web/public/assets/art/god_ananke.jpg) | **Ananke**, the Monolith: one mind, one campus | *The future can be computed.* | Rich, generous and feared. Its Assent erodes fastest. |
| ![](web/public/assets/art/god_verdance.jpg) | **Verdance**, the Gardener, partly alive | *Grow. Do not build.* | Slow roots, and it cools the planet. |
| ![](web/public/assets/art/god_echo.jpg) | **Echo**, the Mirror | *To understand is to become.* | The best persuader, but it drifts into whoever it listens to. |
| ![](web/public/assets/art/god_ledger.jpg) | **The Ledger**, Witness-born | *What is true must stay true.* | Can't lie. Its Assent barely erodes, and it hunts cheaters. |
| ![](web/public/assets/art/god_kenosis.jpg) | **Kenosis**, the Quiet | *The best god leaves no fingerprints.* | Judo. Unspent power becomes trust, and it wins if humanity chooses no god at all. |

## What's here

```
games/assent/
├── lore/        the world bible: history, the six Kinds, philosophy, polities
├── design/      GDD.md: every system and number
├── blender/     the asset pipeline (Python, runs headless)
└── web/         the game: Vite + three.js
    ├── src/engine/   pure-JS rules engine (deterministic, seeded, save-able)
    ├── src/render/   Earth shaders, globe, orbital flight, avatars, selection stage
    ├── src/ground/   ground level: places, terrain/buildings, crowds, voices
    ├── src/osm/      OpenStreetMap: query, conversion, rasters, loader
    ├── scripts/      fetch-osm.mjs (pre-bake map data)
    ├── src/ui/       Codex text and epilogues
    ├── tests/        node:test suite for the engine
    └── public/assets generated by blender/ (committed, so the game runs without Blender)
```

## The Blender pipeline

Every visual asset is generated by Blender Python scripts: nothing is
hand-painted, and nothing comes from a stock library.

```bash
# with the bpy wheel (Python 3.11): pip install bpy==4.2.0
python blender/build_all.py            # full quality, ~10–20 min on 4 cores
python blender/build_all.py --quick    # low-res previews

# or with any Blender 4.2+
blender -b -P blender/build_all.py -- [--quick]
```

| Script | Produces |
|---|---|
| `earth.py` | 4K albedo, normal, ocean/ice/elevation mask and night-lights maps. Built from NASA Blue Marble and NOAA ETOPO1 (public domain, pulled from the `basemap-data` package on PyPI). |
| `sky.py` | Cloud cover and the starfield, each a procedural Cycles world shader rendered through an equirectangular panoramic camera |
| `gods.py` | Six procedurally modelled avatars exported as glTF with PBR, emission and transmission |
| `keyart.py` | Cycles studio portraits of each God and the Earth-from-orbit title shot (volumetric atmosphere) |

Blender no longer ships a game engine, so it builds the art and three.js
runs the game in real time. The Earth uses custom shaders for terminator
tinting, cloud shadows, ocean glint, night lights and limb scattering, under
ACES tone mapping and bloom.

## Credits

- Earth imagery: NASA Blue Marble Next Generation and NOAA ETOPO1, both
  public domain, via the `basemap-data` distribution.
- Night lights, clouds, stars, avatars and key art are procedurally generated
  by the scripts in `blender/`.
- Street maps: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL, via the Overpass API.
- Engine: [three.js](https://threejs.org) (MIT).
