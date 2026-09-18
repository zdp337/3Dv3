"""用干净空房间(5840)合成 9:16 猫咖背景，按参考图布局烘焙家具/吊扇/风铃/咖啡师。
猫保持为运行时图层，不烘焙。分两阶段：先把方形空房扩成 9:16（顶部补天花、底部补地板），
再在其上贴道具。坐标比例化，便于反复微调。预览输出 tools/_cafe_test.jpg。
"""
import os
from PIL import Image

ROOM = "art-export/cafe/room-bg.jpg"
ART = "art-export/props"
OUT = "miniprogram/assets/cafe.jpg"
W, H = 1080, 1920

# 1) 空房间放进 9:16 画布
room = Image.open(ROOM).convert("RGBA").resize((W, W), Image.LANCZOS)
ROOM_TOP = 240  # 房间顶部在画布的位置；上方补天花，下方补地板
canvas = Image.new("RGBA", (W, H))

# 顶部天花：取房间顶部平均色填充
top_strip = room.crop((0, 0, W, 12)).resize((W, ROOM_TOP), Image.LANCZOS)
canvas.alpha_composite(top_strip, (0, 0))
canvas.alpha_composite(room, (0, ROOM_TOP))
# 底部地板：取一整块干净木地板拉伸向下（无地毯、无重复缝）
floor_y = ROOM_TOP + W
wood = room.crop((0, int(W * 0.82), int(W * 0.23), int(W * 0.99)))
wood = wood.resize((W, H - floor_y), Image.LANCZOS)
canvas.alpha_composite(wood, (0, floor_y))

SHOW_PROPS = True
if SHOW_PROPS:
    overlays = [
        # path, 中心x, 底部y(top模式为顶部y), 宽度比例, flip, pin
        ("ceiling-fan.png", 0.50, 0.015, 0.40, False, "top"),
        ("wind-chime.png", 0.82, 0.16, 0.10, False, "top"),
        ("sofa.png", 0.10, 0.67, 0.40, True, "bottom"),
        ("cat-tree.png", 0.74, 0.70, 0.26, False, "bottom"),
        ("cat-bed.png", 0.09, 0.84, 0.30, False, "bottom"),
        ("yarn-ball.png", 0.46, 0.78, 0.11, False, "bottom"),
    ]
    for name, cx, vy, wf, flip, pin in overlays:
        im = Image.open(os.path.join(ART, name)).convert("RGBA")
        if flip:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        tw = int(W * wf)
        th = int(im.height * tw / im.width)
        im = im.resize((tw, th), Image.LANCZOS)
        x = int(W * cx - tw / 2)
        y = int(H * vy) if pin == "top" else int(H * vy - th)
        canvas.alpha_composite(im, (x, y))
    # 咖啡师：单独贴，藏在吧台后（腰部以下被吧台挡住）；比例缩小避免过大
    bar = Image.open(os.path.join(ART, "barista.png")).convert("RGBA")
    tw = int(W * 0.17)
    th = int(bar.height * tw / bar.width)
    bar = bar.resize((tw, th), Image.LANCZOS)
    canvas.alpha_composite(bar, (int(W * 0.38 - tw / 2), int(H * 0.405 - th)))

canvas.convert("RGB").save(OUT, quality=86)
print("saved", OUT, os.path.getsize(OUT) // 1024, "KB")
