"""Generate placeholder PNG icons for the extension."""
import base64
import os

ICON_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
ROOT = os.path.dirname(os.path.abspath(__file__))
ICONS = os.path.join(ROOT, "icons")
os.makedirs(ICONS, exist_ok=True)
b = base64.b64decode(ICON_B64)
for n in (16, 48, 128):
    path = os.path.join(ICONS, f"icon-{n}.png")
    with open(path, "wb") as f:
        f.write(b)
    print("wrote", path)
