"""
美术资源处理流水线：
- 源图为 RGB（背景是烘焙进像素的浅色/棋盘格），统一做「边缘连通浅色」去背 -> 加 alpha 透明通道。
- 猫咪精灵表按网格切帧，每帧只保留最大连通块（自动去掉序号/字母标签/Meow气泡/水印），
  再按所有帧的公共包围盒对齐裁切，输出横向 sprite strip + 单帧。
- 道具单体图：去背 + 自动裁切，输出透明 PNG。
用法：python tools/process_art.py
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = "美术资源"
V3 = os.path.join(SRC, "猫咖素材V3.0")
# 处理后的素材先放仓库根 art-export/ 暂存区，不直接进 miniprogram，
# 避免未接入前就撑爆主包 2MB 限制；接入动画系统时再按分包/CDN 搬运。
OUT = "art-export"


def find(folder, keyword):
    for f in os.listdir(folder):
        if keyword in f and f.lower().endswith(".png"):
            return os.path.join(folder, f)
    raise FileNotFoundError(keyword + " in " + folder)


def foreground_mask(rgb):
    """返回前景布尔mask：去掉与边缘连通的浅色/低饱和背景，保留被描边包住的浅色（白毛等）。"""
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    mn = np.minimum(np.minimum(r, g), b)
    mx = np.maximum(np.maximum(r, g), b)
    lightish = (mn > 200) & ((mx - mn) < 30)
    bg = np.zeros(lightish.shape, dtype=bool)
    # 边缘连通的浅色才算背景
    lbl, n = ndimage.label(lightish)
    border_labels = set(lbl[0, :]) | set(lbl[-1, :]) | set(lbl[:, 0]) | set(lbl[:, -1])
    border_labels.discard(0)
    if border_labels:
        bg = np.isin(lbl, list(border_labels))
    fg = ~bg
    # 去掉前景里的细碎噪点
    fg = ndimage.binary_opening(fg, iterations=1)
    fg = ndimage.binary_closing(fg, iterations=2)
    return fg


def to_rgba(rgb, fg):
    h, w = fg.shape
    rgba = np.dstack([rgb, np.where(fg, 255, 0).astype(np.uint8)])
    return rgba


def largest_component(fg):
    lbl, n = ndimage.label(fg)
    if n == 0:
        return fg
    sizes = ndimage.sum(np.ones_like(lbl), lbl, range(1, n + 1))
    keep = np.argmax(sizes) + 1
    return lbl == keep


def bbox(mask):
    ys, xs = np.where(mask)
    if len(ys) == 0:
        return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def autocrop_rgba(rgba, pad=8):
    a = rgba[:, :, 3] > 8
    bb = bbox(a)
    if bb is None:
        return Image.fromarray(rgba)
    x0, y0, x1, y1 = bb
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(rgba.shape[1], x1 + pad); y1 = min(rgba.shape[0], y1 + pad)
    return Image.fromarray(rgba[y0:y1, x0:x1])


def process_prop(src, out_name, max_dim=512):
    rgb = np.array(Image.open(src).convert("RGB"))
    fg = foreground_mask(rgb)
    fg = largest_component(fg)
    rgba = to_rgba(rgb, fg)
    img = autocrop_rgba(rgba, pad=6)
    if max(img.size) > max_dim:
        s = max_dim / max(img.size)
        img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    os.makedirs(os.path.dirname(out_name), exist_ok=True)
    img.save(out_name)
    print("prop ->", out_name, img.size)


def process_sheet(src, out_dir, rows, cols, frame_h=256, strips=None, flip=False):
    """strips: None=整张当一个动作；或 list[(name, start_index, count)] 指定多段动作。"""
    rgb = np.array(Image.open(src).convert("RGB"))
    if flip:
        rgb = rgb[:, ::-1, :].copy()
    fg = foreground_mask(rgb)
    H, W = fg.shape
    ch, cw = H // rows, W // cols
    cells = []  # 每帧的 (rgba_full_cell, local_fg)
    for r in range(rows):
        for c in range(cols):
            y0, x0 = r * ch, c * cw
            cell_rgb = rgb[y0:y0 + ch, x0:x0 + cw]
            cell_fg = fg[y0:y0 + ch, x0:x0 + cw]
            cell_fg = largest_component(cell_fg)  # 去标签/序号/气泡/水印
            cells.append((cell_rgb, cell_fg))
    # 公共包围盒，保证逐帧对齐
    boxes = [bbox(f) for _, f in cells if bbox(f) is not None]
    gx0 = min(b[0] for b in boxes); gy0 = min(b[1] for b in boxes)
    gx1 = max(b[2] for b in boxes); gy1 = max(b[3] for b in boxes)
    pad = 6
    gx0 = max(0, gx0 - pad); gy0 = max(0, gy0 - pad)
    gx1 = min(cw, gx1 + pad); gy1 = min(ch, gy1 + pad)
    fw, fh = gx1 - gx0, gy1 - gy0
    scale = frame_h / fh
    out_w = round(fw * scale)
    frames = []
    for cell_rgb, cell_fg in cells:
        rgba = to_rgba(cell_rgb, cell_fg)
        crop = rgba[gy0:gy1, gx0:gx1]
        img = Image.fromarray(crop).resize((out_w, frame_h), Image.LANCZOS)
        frames.append(img)

    os.makedirs(out_dir, exist_ok=True)
    fdir = os.path.join(out_dir, "frames")  # 单帧仅作参考
    os.makedirs(fdir, exist_ok=True)
    for i, img in enumerate(frames):
        img.save(os.path.join(fdir, f"{i:02d}.png"))

    segs = strips or [("all", 0, len(frames))]
    for name, start, count in segs:
        seg = frames[start:start + count]
        strip = Image.new("RGBA", (out_w * len(seg), frame_h), (0, 0, 0, 0))
        for i, img in enumerate(seg):
            strip.paste(img, (i * out_w, 0))
        path = os.path.join(out_dir, f"{name}-{len(seg)}.png")
        strip.save(path)
        print("strip ->", path, strip.size)
    print(f"  frame cell={out_w}x{frame_h}, total {len(frames)} frames")


def main():
    # ---- 场景背景：不去背，整图缩放保存 ----
    room = find(V3, "5840")
    bg = Image.open(room).convert("RGB")
    if max(bg.size) > 1280:
        s = 1280 / max(bg.size)
        bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
    os.makedirs(os.path.join(OUT, "cafe"), exist_ok=True)
    bg.save(os.path.join(OUT, "cafe", "room-bg.jpg"), quality=86)
    print("scene ->", "cafe/room-bg.jpg", bg.size)

    # ---- 道具 ----
    props = {
        "6757": "props/sofa.png",
        "3992": "props/cat-bed.png",
        "4592": "props/cat-tree.png",
        "9155": "props/yarn-ball.png",
        "5573": "props/ceiling-fan.png",
        "2698": "props/wind-chime.png",
        "7116": "props/barista.png",
    }
    for kw, out in props.items():
        process_prop(find(V3, kw), os.path.join(OUT, out))

    # ---- 单姿势静态猫（定妆照 / 静态降级用）----
    statics = {
        "8461": "cats/statics/orange-sit.png",
        "7751": "cats/statics/mainecoon-sit.png",
        "3951": "cats/statics/calico-sit.png",
        "4347": "cats/statics/black-stand.png",
        "4247": "cats/statics/black-sleep.png",
    }
    for kw, out in statics.items():
        process_prop(find(V3, kw), os.path.join(OUT, out))

    # ---- 精灵表 ----
    process_sheet(find(SRC, "三花猫"), os.path.join(OUT, "cats", "calico"),
                  rows=3, cols=4, strips=[("pounce", 0, 12)])
    process_sheet(find(SRC, "睡觉黑猫"), os.path.join(OUT, "cats", "black"),
                  rows=3, cols=4, strips=[("sleep", 0, 12)])
    process_sheet(find(SRC, "站立猫咪"), os.path.join(OUT, "cats", "black-stand"),
                  rows=3, cols=4, strips=[("stand", 0, 12)])
    process_sheet(find(SRC, "缅因猫"), os.path.join(OUT, "cats", "mainecoon"),
                  rows=4, cols=4, strips=[("rest", 0, 16)])
    process_sheet(find(SRC, "金渐层"), os.path.join(OUT, "cats", "golden"),
                  rows=4, cols=6, strips=[("meow", 0, 6), ("tailwag", 6, 6),
                                           ("groom", 12, 6), ("sleepy", 18, 6)])


if __name__ == "__main__":
    main()
