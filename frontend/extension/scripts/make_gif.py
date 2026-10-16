#!/usr/bin/env python
"""把逐帧截图合成为体积可控的 GIF（供 capture-demo.mjs 调用）。

用法：
    python make_gif.py <帧目录> <输出.gif> [宽度=820] [每帧毫秒=95] [颜色数=200]

要点：
* 先按目标宽度等比缩放（缩尺寸比压画质更省体积，且文字仍可读）；
* 用中位切分 + 抖动做自适应调色板，避免局部色带；
* 通过 Pillow 的 optimize + 差分帧压缩，把 60~80 帧控制在几 MB 以内。
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def build(
    frames_dir: Path,
    out_path: Path,
    width: int,
    duration_ms: int,
    colors: int = 200,
) -> None:
    sources = sorted(frames_dir.glob("*.png"))
    if not sources:
        raise SystemExit(f"no frames found in {frames_dir}")

    # 统一缩放到同一尺寸，GIF 要求所有帧尺寸一致
    resized: list[Image.Image] = []
    for source in sources:
        image = Image.open(source).convert("RGB")
        ratio = width / image.width
        target = (width, max(1, round(image.height * ratio)))
        resized.append(image.resize(target, Image.LANCZOS))

    # 用整段素材的抽样帧统计一个全局调色板，避免帧间闪烁
    sample = resized[:: max(1, len(resized) // 12)]
    canvas = Image.new("RGB", (sample[0].width, sample[0].height * len(sample)))
    for index, image in enumerate(sample):
        canvas.paste(image, (0, image.height * index))

    palette_strip = canvas.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    palette = palette_strip.getpalette()

    quantized: list[Image.Image] = []
    for image in resized:
        converted = image.quantize(palette=palette_strip, dither=Image.FLOYDSTEINBERG)
        converted.putpalette(palette)
        quantized.append(converted)

    quantized[0].save(
        out_path,
        save_all=True,
        append_images=quantized[1:],
        duration=duration_ms,
        loop=0,
        optimize=True,
        disposal=2,
    )
    size_kb = out_path.stat().st_size / 1024
    print(f"wrote {out_path} ({len(quantized)} frames, {size_kb:.0f} KB)")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)

    build(
        frames_dir=Path(sys.argv[1]),
        out_path=Path(sys.argv[2]),
        width=int(sys.argv[3]) if len(sys.argv) > 3 else 820,
        duration_ms=int(sys.argv[4]) if len(sys.argv) > 4 else 95,
        colors=int(sys.argv[5]) if len(sys.argv) > 5 else 200,
    )
