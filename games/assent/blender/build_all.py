"""Build every ASSENT asset: Earth textures, sky, avatars and key art.

    python blender/build_all.py [--quick]              # bpy wheel from PyPI
    blender -b -P blender/build_all.py -- [--quick]    # any Blender 4.2+

--quick renders small, low-sample previews for iteration. Without it the full
set takes roughly 10-20 minutes on a 4-core CPU.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common as C  # noqa: E402
import earth  # noqa: E402
import gods  # noqa: E402
import keyart  # noqa: E402
import sky  # noqa: E402


def main():
    args = C.script_args()
    quick = "--quick" in args
    start = time.time()
    earth.build(quick)
    sky.build(quick)
    gods.build(quick)
    keyart.build(quick)
    print(f"Done in {time.time() - start:.0f}s. Assets are in {os.path.relpath(C.ASSETS, os.getcwd())}")


if __name__ == "__main__":
    main()
