"""把阶段1需要的小体积素材从 art-export/ 导出进 miniprogram/assets/（主包可用）。
- 背景：art-export/cafe/room-bg.jpg -> miniprogram/assets/cafe.jpg（覆盖旧图，场景配置不变）
- 4 只猫静态立绘：缩到 maxdim 256 -> miniprogram/assets/cats/<key>.png
"""
import os
from PIL import Image

ART = "art-export"
OUT = os.path.join("miniprogram", "assets")

# 背景
bg = Image.open(os.path.join(ART, "cafe", "room-bg.jpg")).convert("RGB")
bg.save(os.path.join(OUT, "cafe.jpg"), quality=86)
print("bg -> assets/cafe.jpg", bg.size)

# 猫静态立绘：源 -> 目标key
cats = {
    "orange-sit": "golden",
    "black-stand": "black",
    "calico-sit": "calico",
    "mainecoon-sit": "mainecoon",
}
os.makedirs(os.path.join(OUT, "cats"), exist_ok=True)
for src, key in cats.items():
    im = Image.open(os.path.join(ART, "cats", "statics", src + ".png")).convert("RGBA")
    if max(im.size) > 256:
        s = 256 / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    p = os.path.join(OUT, "cats", key + ".png")
    im.save(p)
    print("cat ->", p, im.size, os.path.getsize(p) // 1024, "KB")

# 场景道具：缩到 maxdim 360 进主包
props = ["sofa", "cat-bed", "cat-tree", "yarn-ball", "ceiling-fan", "wind-chime"]
os.makedirs(os.path.join(OUT, "props"), exist_ok=True)
for name in props:
    im = Image.open(os.path.join(ART, "props", name + ".png")).convert("RGBA")
    if max(im.size) > 360:
        s = 360 / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    p = os.path.join(OUT, "props", name + ".png")
    im.save(p)
    print("prop ->", p, im.size, os.path.getsize(p) // 1024, "KB")
