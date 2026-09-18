"""阶段2 序列帧导出：把猫的动作条切成逐帧 PNG（JS 逐帧切 src 播放）。
对齐策略：按内容包围盒底部中心对齐到统一画布，消除竖向漂移（否则循环会跳）。
朝向约定：默认朝右（与静态姿势图一致；facing<0 时由 CSS scaleX(-1) 翻转）。
体积：导出宽 132px + 调色板量化（96 色），单帧约 4KB，保证主包 < 2MB。
JOBS 里每条 = 一个「猫×动作」动画集 → miniprogram/assets/cats/<out>/00.png ...
"""
import os
from PIL import Image
import numpy as np

EXPORT_W = 132          # 导出单帧最大宽（猫渲染约 132rpx，132px 足够）
MARGIN_BOTTOM = 8
MAXH_RATIO = 0.92       # 内容最大高度占导出画布比例
QUANT_COLORS = 96       # 调色板量化色数（0 = 不量化，保留 RGBA）

# 金渐层 live 源图 ABCD 四行 = 四个动作；三花潜行/走路条
JOBS = [
    {"src": "art-export/cats/calico/pounce-12.png", "n": 12, "out": "calico-walk", "flip": False},
    {"src": "art-export/cats/golden/tailwag-6.png", "n": 6, "out": "golden-idle", "flip": False},   # B行 摆尾→idle
    {"src": "art-export/cats/golden/groom-6.png", "n": 6, "out": "golden-groom", "flip": False},     # C行 理毛→groom
    {"src": "art-export/cats/golden/sleepy-6.png", "n": 6, "out": "golden-sleep", "flip": False},    # D行 困→sleep
    {"src": "art-export/cats/golden/meow-6.png", "n": 6, "out": "golden-meow", "flip": False},       # A行 喵叫→interact
]


def save_frame(canvas, path):
    if QUANT_COLORS:
        canvas.quantize(colors=QUANT_COLORS, method=Image.FASTOCTREE, dither=Image.NONE).save(path, optimize=True)
    else:
        canvas.save(path, optimize=True)


def export(job):
    strip = Image.open(job["src"]).convert("RGBA")
    W, H = strip.size
    n = job["n"]
    cell = W // n
    a_full = np.array(strip)[:, :, 3]
    out_dir = os.path.join("miniprogram", "assets", "cats", job["out"])
    os.makedirs(out_dir, exist_ok=True)
    fh = round(EXPORT_W * MAXH_RATIO) + MARGIN_BOTTOM + 6
    total_kb = 0
    for i in range(n):
        cell_img = strip.crop((i * cell, 0, (i + 1) * cell, H))
        col = a_full[:, i * cell:(i + 1) * cell]
        ys, xs = np.where(col > 20)
        content = cell_img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        if job["flip"]:
            content = content.transpose(Image.FLIP_LEFT_RIGHT)
        cw, ch = content.size
        s = min(EXPORT_W / cw, (EXPORT_W * MAXH_RATIO) / ch, 1.0)
        if s < 1.0:
            content = content.resize((round(cw * s), round(ch * s)), Image.LANCZOS)
            cw, ch = content.size
        canvas = Image.new("RGBA", (EXPORT_W, fh), (0, 0, 0, 0))
        x = (EXPORT_W - cw) // 2
        y = fh - MARGIN_BOTTOM - ch
        canvas.alpha_composite(content, (x, y))
        p = os.path.join(out_dir, f"{i:02d}.png")
        save_frame(canvas, p)
        total_kb += os.path.getsize(p) // 1024
    print(job["out"], "->", out_dir, n, "frames", total_kb, "KB")


if __name__ == "__main__":
    for j in JOBS:
        export(j)
