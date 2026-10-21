#!/usr/bin/env python3
"""Art gate for P8 (design v1.0 §05, §12). Needs Pillow.

  python3 scripts/check-art.py            # check, write the status report and the 64 px proof sheet
  python3 scripts/check-art.py --pack     # also pack portraits that pass into public/assets/portraits

Portraits: the seven manifest sources must be 512x512 RGBA with a transparent
exterior. Card backs (art/incoming/p8/back-*.png): 300x420 RGBA, the same alpha
silhouette as the standard back, exact 180-degree symmetry, and enough contrast
with the felt. Nothing here edits the asset manifest: a person moves a status to
'delivered' or 'integrated' only after looking at the real files on a phone.
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageStat

ROOT = Path(__file__).resolve().parent.parent
STATUS = json.loads((ROOT / 'src/game/run/data/p8-visual-status.json').read_text())
OUT_PORTRAITS = ROOT / 'public/assets/portraits'
PAINTED = ['wagerer', 'vesper', 'oracle', 'corvin', 'adjudicator']  # already in the game


def runtime_name(path: str) -> str:
    return Path(path).stem


def check_portrait(path: Path) -> list[str]:
    problems = []
    im = Image.open(path)
    if im.size != (512, 512):
        problems.append(f'size {im.size}, expected 512x512')
    if im.mode != 'RGBA':
        problems.append(f'mode {im.mode}, expected RGBA')
        return problems
    a = im.getchannel('A')
    corners = [a.getpixel(p) for p in [(0, 0), (511, 0), (0, 511), (511, 511)]]
    if any(c != 0 for c in corners):
        problems.append('corners are not transparent')
    border = [a.getpixel((x, 0)) for x in range(512)] + [a.getpixel((0, y)) for y in range(512)]
    if sum(1 for v in border if v > 0) > 0.25 * len(border):
        problems.append('exterior is not transparent (top/left border mostly opaque)')
    if ImageStat.Stat(a).mean[0] < 40:
        problems.append('almost fully transparent')
    return problems


def check_back(path: Path, standard: Image.Image, felt_lum: float) -> list[str]:
    problems = []
    im = Image.open(path)
    if im.size != (300, 420) or im.mode != 'RGBA':
        return [f'{im.size} {im.mode}, expected 300x420 RGBA']
    if im.tobytes() != im.rotate(180).tobytes():
        problems.append('not exactly symmetric under 180-degree rotation')
    if im.getchannel('A').tobytes() != standard.getchannel('A').tobytes():
        problems.append('alpha silhouette differs from the standard back')
    lum = ImageStat.Stat(im.convert('L'), mask=im.getchannel('A')).mean[0]
    if abs(lum - felt_lum) < 25:
        problems.append(f'too little contrast with the felt (luminance {lum:.0f} vs {felt_lum:.0f})')
    return problems


def circle(im: Image.Image, size: int = 64) -> Image.Image:
    im = im.convert('RGBA').resize((size, size), Image.LANCZOS)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    disc = Image.new('RGBA', (size, size), (35, 26, 24, 255))
    disc.alpha_composite(im)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(disc, (0, 0), mask)
    return out


def monogram(name: str, size: int = 64) -> Image.Image:
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    d.ellipse((0, 0, size - 1, size - 1), fill=(58, 42, 36, 255), outline=(201, 162, 74, 255), width=2)
    initials = ''.join(w[0] for w in name.split() if w[0].isupper() and w != 'The')[:2]
    try:
        font = ImageFont.truetype('DejaVuSerif-Bold.ttf', 22)
    except OSError:
        font = ImageFont.load_default()
    box = d.textbbox((0, 0), initials, font=font)
    d.text(((size - box[2] + box[0]) / 2, (size - box[3] + box[1]) / 2 - 2), initials, fill=(243, 210, 122, 255), font=font)
    return out


def main(pack: bool) -> None:
    report = {'portraits': [], 'backs': []}
    tiles = []
    for name in PAINTED:
        label = 'Adjudicator (provisional)' if name == 'adjudicator' else name.title() + ' (painted)'
        tiles.append((label, circle(Image.open(OUT_PORTRAITS / f'{name}.webp'))))
    ready = list(PAINTED)
    for src in STATUS['sources']:
        path = ROOT / src['path']
        entry = {'character': src['character'], 'source': src['path'], 'present': path.exists()}
        if path.exists():
            problems = check_portrait(path)
            entry['problems'] = problems
            entry['status'] = 'passes checks: awaiting human 64px review' if not problems else 'fails checks'
            tiles.append((src['character'] + (' (new)' if not problems else ' (FAILS)'), circle(Image.open(path))))
            if pack and not problems:
                Image.open(path).convert('RGBA').resize((256, 256), Image.LANCZOS).save(OUT_PORTRAITS / f'{runtime_name(src["path"])}.webp', 'WEBP', quality=88, method=6)
                ready.append(runtime_name(src['path']))
        else:
            entry['status'] = 'needed: source file not delivered'
            tiles.append((src['character'] + ' (monogram)', monogram(src['character'])))
        report['portraits'].append(entry)
    standard = Image.open(ROOT / 'art/source/chatgpt-p3/back-300.png').convert('RGBA')
    felt_lum = ImageStat.Stat(Image.open(ROOT / 'public/assets/felt.webp').convert('L')).mean[0]
    for b in sorted((ROOT / 'art/incoming/p8').glob('back-*.png')) if (ROOT / 'art/incoming/p8').exists() else []:
        problems = check_back(b, standard, felt_lum)
        report['backs'].append({'source': str(b.relative_to(ROOT)), 'problems': problems})
    if not report['backs']:
        report['backs'].append({'note': 'no cosmetic back delivered (art/incoming/p8/back-cinder.png, back-crown.png); only the standard back is usable'})
    if pack:
        (OUT_PORTRAITS / 'index.json').write_text(json.dumps(sorted(set(ready))) + '\n')
    # 64 px proof sheet at 2x for legibility of labels.
    cols = 4
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 190, rows * 110), (11, 16, 19))
    d = ImageDraw.Draw(sheet)
    for i, (label, tile) in enumerate(tiles):
        x, y = (i % cols) * 190 + 63, (i // cols) * 110 + 8
        sheet.paste(tile, (x, y), tile)
        d.text(((i % cols) * 190 + 6, y + 70), label[:30], fill=(239, 231, 213))
    proof = ROOT / 'docs/briefs/008/portrait-64-proof.png'
    proof.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(proof)
    (ROOT / 'docs/reports').mkdir(exist_ok=True)
    (ROOT / 'docs/reports/art-status-p8.json').write_text(json.dumps(report, indent=2) + '\n')
    for p in report['portraits']:
        print(f"{p['character']:20} {p['status']}")
    print(json.dumps(report['backs']))


if __name__ == '__main__':
    main('--pack' in sys.argv)
