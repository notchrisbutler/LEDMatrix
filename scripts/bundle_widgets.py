#!/usr/bin/env python3
"""Bundle widget JS files into a single file for production."""
from pathlib import Path

WIDGETS_DIR = Path("web_interface/static/v3/js/widgets")
OUTPUT = Path("web_interface/static/v3/js/widgets.bundle.js")

# These must load first (base class and registry before everything else)
PRIORITY = ["base-widget.js", "registry.js", "notification.js", "plugin-loader.js"]


def bundle() -> None:
    files: list[Path] = []
    # Priority files first
    for name in PRIORITY:
        path = WIDGETS_DIR / name
        if path.exists():
            files.append(path)
    # Then remaining JS files alphabetically
    for path in sorted(WIDGETS_DIR.glob("*.js")):
        if path not in files:
            files.append(path)

    parts = [f"/* Widget Bundle - {len(files)} files */"]
    for f in files:
        parts.append(f"\n/* === {f.name} === */")
        parts.append(f.read_text())

    OUTPUT.write_text("\n".join(parts))
    print(f"Bundled {len(files)} widget files into {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    bundle()
