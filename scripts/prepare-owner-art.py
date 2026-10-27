#!/usr/bin/env python3
"""Prepares the art the project owner supplied on 2026-10-27 (art/source/owner-p10/, kept untouched).

Run with `python3 -I scripts/prepare-owner-art.py` (Pillow + NumPy). Every step is a matte or
framing operation; the only drawn addition is the card back's 2 px edge keyline. The outputs then go through the normal gates
(`npm run art`), exactly like any other delivered file.

  portraits  -> art/incoming/p4/adjudicator.png, art/incoming/p10/{vesper,oracle,corvin}.png
                512x512 RGBA. The supplied cut-outs had semi-transparent dark halos with red/green
                colour fringes; the matte is tightened, the fringe colours are replaced by the
                neighbouring painted colour, and the three painted-disc portraits are trimmed to
                their own disc so the ragged halo goes.
  emblems    -> public/assets/emblems/{ember,veil,thorn,mirror}.webp (256x256), same matte clean-up.
  card back  -> art/source/owner-p10/back-reliquary-300.png: the card area cropped from the dark
                surround, resized to 300x420, made exactly 180-degree symmetric (the upper half is
                kept and rotated into the lower half, as the gate requires), given the standard
                back's alpha silhouette and a 2 px copper keyline on its edge (the one drawn
                addition: without it the edge measures 2.2:1 against the table, under WCAG's 3:1). scripts/pack-assets.py uses it as the standard back.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art/source/owner-p10'

# Portrait framing: (output path, disc centre x, y and radius in source pixels, or None to keep the cut-out).
PORTRAITS = {
    'adjudicator': ('art/incoming/p4/adjudicator.png', (627, 622, 612)),
    'vesper': ('art/incoming/p10/vesper.png', (626, 636, 548)),
    'corvin': ('art/incoming/p10/corvin.png', (628, 606, 590)),
    'oracle': ('art/incoming/p10/oracle.png', (640, 628, 606)),
}
EMBLEMS = ['ember', 'veil', 'thorn', 'mirror']
COAL = np.array([14, 12, 11], np.float32) / 255


def drop_shadow(im: Image.Image) -> np.ndarray:
    """The dark smudge a cut-out tool leaves around a figure: near-black pixels connected to the
    transparent exterior. Returned as a soft 0..1 mask of what to remove."""
    from PIL import ImageDraw
    lum = np.asarray(im.convert('L'), dtype=np.float32) / 255
    a = np.asarray(im.getchannel('A'), dtype=np.float32) / 255
    open_ = ((a < 0.5) | (lum * a < 0.075)).astype(np.uint8) * 255
    m = Image.fromarray(open_)
    ImageDraw.floodfill(m, (0, 0), 128)
    gone = (np.asarray(m) == 128).astype(np.float32)
    return np.clip(blur(gone, 1.5) * 1.4, 0, 1)


def _box(x: np.ndarray, k: int, axis: int) -> np.ndarray:
    pad = [(0, 0)] * x.ndim
    pad[axis] = (k + 1, k)
    c = np.cumsum(np.pad(x, pad, mode='edge'), axis=axis, dtype=np.float64)
    hi = np.take(c, np.arange(2 * k + 1, c.shape[axis]), axis=axis)
    lo = np.take(c, np.arange(0, c.shape[axis] - 2 * k - 1), axis=axis)
    return ((hi - lo) / (2 * k + 1)).astype(np.float32)


def blur(x: np.ndarray, r: float) -> np.ndarray:
    """Approximate Gaussian blur of a float image: three box passes per axis."""
    k = max(1, int(round(r * 0.8)))
    for axis in (0, 1):
        for _ in range(3):
            x = _box(x, k, axis)
    return x


def clean_matte(im: Image.Image, lo: int, hi: int, erode: int) -> np.ndarray:
    """Returns float RGBA in 0..1 with a tightened alpha and fringe colours replaced from the interior."""
    a8 = im.getchannel('A')
    if erode:
        a8 = a8.filter(ImageFilter.MinFilter(erode * 2 + 1))
    a = np.asarray(a8, dtype=np.float32)
    alpha = np.clip((a - lo) / (hi - lo), 0, 1)
    alpha = blur(alpha, 1.0)
    rgb = np.asarray(im.convert('RGB'), dtype=np.float32) / 255
    solid = (np.asarray(im.getchannel('A'), dtype=np.float32) >= 248).astype(np.float32)
    solid = np.asarray(Image.fromarray((solid * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(7)), dtype=np.float32) / 255
    out = np.empty(rgb.shape[:2] + (4,), np.float32)
    w = blur(solid, 6) + 1e-6
    for c in range(3):
        fill = blur(rgb[..., c] * solid, 6) / w
        out[..., c] = rgb[..., c] * solid + fill * (1 - solid)
    out[..., 3] = alpha
    return out


def disc(shape, cx: float, cy: float, r: float, feather: float = 2.5) -> np.ndarray:
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]].astype(np.float32)
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    return np.clip((r - d) / feather + 0.5, 0, 1)


def to_image(arr: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA')


def frame_square(im: Image.Image, size: int, pad: float) -> Image.Image:
    box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    x0, y0, x1, y1 = box
    side = int(max(x1 - x0, y1 - y0) * (1 + pad))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(im, (int(side / 2 - cx), int(side / 2 - cy)))
    out = canvas.resize((size, size), Image.LANCZOS)
    a = np.asarray(out.getchannel('A')).copy()
    a[a < 6] = 0
    out.putalpha(Image.fromarray(a))
    return out


def portraits() -> dict:
    record = {}
    for name, (dest, circle) in PORTRAITS.items():
        src = SRC / f'portrait-{name}.png'
        im = Image.open(src).convert('RGBA')
        arr = clean_matte(im, 70, 235, 2)
        if circle:
            # Painted-disc portraits: the disc itself is the silhouette. Its few see-through pixels sit
            # on the game's coal ground, and everything outside the disc (the ragged halo) goes.
            m = arr[..., 3:4]
            arr[..., :3] = arr[..., :3] * m + COAL * (1 - m)
            arr[..., 3] = disc(arr.shape, *circle)
        else:
            arr[..., 3] *= 1 - drop_shadow(im)
        out = frame_square(to_image(arr), 512, 0.02)
        path = ROOT / dest
        path.parent.mkdir(parents=True, exist_ok=True)
        out.save(path, optimize=True)
        record[name] = {'source': str(src.relative_to(ROOT)), 'output': dest, 'disc': circle}
    return record


def emblems() -> dict:
    out_dir = ROOT / 'public/assets/emblems'
    out_dir.mkdir(parents=True, exist_ok=True)
    record = {}
    for name in EMBLEMS:
        src = SRC / f'emblem-{name}.png'
        arr = clean_matte(Image.open(src).convert('RGBA'), 60, 235, 2)
        frame_square(to_image(arr), 256, 0.04).save(out_dir / f'{name}.webp', 'WEBP', quality=90, method=6)
        record[name] = {'source': str(src.relative_to(ROOT)), 'output': f'public/assets/emblems/{name}.webp'}
    return record


def back() -> dict:
    im = Image.open(SRC / 'back-reliquary.png').convert('RGB')
    g = np.asarray(im.convert('L'), dtype=np.float32)
    # The card is the area brighter than the flat surround: find its edges from row/column profiles.
    cols = np.where(g.mean(axis=0) > g[:, :20].mean() + 12)[0]
    rows = np.where(g.mean(axis=1) > g[:20, :].mean() + 12)[0]
    card = im.crop((int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1)).resize((300, 420), Image.LANCZOS)
    top = card.crop((0, 0, 300, 210))
    sym = Image.new('RGB', (300, 420))
    sym.paste(top, (0, 0))
    sym.paste(top.rotate(180), (0, 210))
    standard = Image.open(ROOT / 'art/source/chatgpt-p3/back-300.png').convert('RGBA')
    out = sym.convert('RGBA')
    sa = standard.getchannel('A')
    out.putalpha(sa)
    # The art's own edge is a mottled dark band that disappears on the coal table (2.2:1). A 2 px
    # copper keyline along the silhouette gives the card edge 3:1 (WCAG 1.4.11); it follows the
    # alpha, so the symmetry is kept.
    inner = np.asarray(sa.filter(ImageFilter.MinFilter(5))) >= 128
    edge = (np.asarray(sa) >= 128) & ~inner
    px = np.asarray(out).copy()
    px[edge, :3] = (px[edge, :3] * 0.15 + np.array([214, 150, 104]) * 0.85).astype(np.uint8)
    out = Image.fromarray(px, 'RGBA')
    assert out.tobytes() == out.rotate(180).tobytes()
    dest = SRC / 'back-reliquary-300.png'
    out.save(dest, optimize=True)
    return {'source': 'art/source/owner-p10/back-reliquary.png', 'crop': [int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1], 'output': str(dest.relative_to(ROOT)), 'symmetry': 'upper half kept, rotated 180 degrees into the lower half', 'alpha': 'art/source/chatgpt-p3/back-300.png', 'keyline': '2 px copper (#D69668 at 85%) along the silhouette edge, for 3:1 edge contrast on the table'}


def main() -> None:
    record = {'supplied': '2026-10-27, by the project owner in the development session', 'portraits': portraits(), 'emblems': emblems(), 'back': back()}
    (SRC / 'preparation.json').write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps(record, indent=2))


if __name__ == '__main__':
    main()
