#!/usr/bin/env python3
"""Art gate and portrait pipeline (design v1.0 §05, §12; v1.1 §06, §07). Needs Pillow.

  npm run art:check                     # dry run: check, write the status report and the 64 px proof sheet
  npm run art                           # also apply: pack passing portraits, update the manifest and index
  python3 scripts/check-art.py --apply --approve mara-quill --reviewer NAME --note "64px + iPhone 13/SE screenshots"
                                         # record a human review: the file (by SHA-256) becomes 'integrated'
  python3 scripts/check-art.py --apply --revert mara-quill --note "why"
                                         # withdraw a portrait: monogram restored, status back to 'needed'

Statuses (docs/asset-manifest.json):
  needed     no source file at the manifest path. The game shows the gold monogram.
  rejected   a source exists but fails a machine check. Not packed; monogram shown.
  delivered  the source passes every machine check, so it is packed and shown in the
             game for review. It still needs a person to look at the 64 px proof and
             iPhone 13 / SE screenshots.
  integrated a person approved exactly this file (its SHA-256 is recorded in
             art/approvals.json). Any later change to the file returns it to 'delivered'.
             Approval also needs a provenance note beside the file
             (e.g. art/incoming/p4/mara-quill.provenance.json: {"author", "method", "license", "date"}).

Portraits: 512x512 RGBA, a genuinely transparent exterior (alpha 0, not a painted
checkerboard), a bust filling enough of the frame to survive a 64 px circle, and not
a near-duplicate of another portrait. Card backs (art/incoming/p8/back-*.png):
300x420 RGBA, the standard back's exact alpha silhouette, exact 180-degree symmetry
and enough contrast with the felt. Nothing here draws, generates or edits artwork.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat

PAINTED = ['wagerer', 'vesper', 'oracle', 'corvin', 'adjudicator']  # already in the game (P2/P3 art)
# Where a painted portrait's original lives, to restore it if its replacement is withdrawn or fails.
ORIGINAL = {'adjudicator': 'art/source/chatgpt-p3/adjudicator.png'}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def runtime_name(path: str) -> str:
    return Path(path).stem


def check_portrait(path: Path) -> list[str]:
    problems = []
    try:
        im = Image.open(path)
        im.load()
    except Exception as e:  # unreadable or not an image
        return [f'unreadable: {e}']
    if im.format != 'PNG':
        problems.append(f'format {im.format}, expected PNG')
    if im.size != (512, 512):
        problems.append(f'size {im.size}, expected 512x512')
    if im.mode != 'RGBA':
        problems.append(f'mode {im.mode}, expected RGBA')
        return problems
    w, h = im.size
    a = im.getchannel('A')
    corners = [a.getpixel(p) for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
    if any(c != 0 for c in corners):
        problems.append('corners are not alpha-zero (painted background or checkerboard?)')
    border = [a.getpixel((x, 0)) for x in range(w)] + [a.getpixel((0, y)) for y in range(h)] + [a.getpixel((w - 1, y)) for y in range(h)]
    if sum(1 for v in border if v > 0) > 0.25 * len(border):
        problems.append('exterior is not transparent (top/side borders mostly opaque)')
    hist = a.histogram()
    transparent = hist[0] / (w * h)
    if transparent < 0.08:
        problems.append(f'only {transparent:.0%} of pixels are alpha-zero: no real transparent exterior')
    if ImageStat.Stat(a).mean[0] < 40:
        problems.append('almost fully transparent')
    box = a.point(lambda v: 255 if v > 16 else 0).getbbox()
    if box:
        bw, bh = box[2] - box[0], box[3] - box[1]
        if bw < 0.5 * w:
            problems.append(f'bust only {bw / w:.0%} of the width: too narrow for a 64 px circle')
        if box[1] > 0.3 * h:
            problems.append('figure starts below the upper 30%: the head would be lost in the circle crop')
        if bh < 0.6 * h:
            problems.append(f'figure only {bh / h:.0%} of the height: not a chest-up bust')
    return problems


def fingerprint(path: Path) -> Image.Image:
    im = Image.open(path).convert('RGBA')
    flat = Image.new('RGBA', im.size, (0, 0, 0, 255))
    flat.alpha_composite(im)
    return flat.convert('L').resize((32, 32), Image.LANCZOS)


def near_duplicates(paths: dict[str, Path]) -> dict[str, list[str]]:
    """Pairs of sources that are (almost) the same picture: a copy, a recolor or a re-crop."""
    prints = {k: fingerprint(p) for k, p in paths.items()}
    out: dict[str, list[str]] = {}
    keys = sorted(prints)
    for i, x in enumerate(keys):
        for y in keys[i + 1:]:
            diff = ImageStat.Stat(ImageChops.difference(prints[x], prints[y])).mean[0]
            if diff < 6:
                out.setdefault(x, []).append(y)
                out.setdefault(y, []).append(x)
    return out


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


def load_json(path: Path, default):
    return json.loads(path.read_text()) if path.exists() else default


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default=str(Path(__file__).resolve().parent.parent))
    ap.add_argument('--apply', action='store_true', help='pack passing portraits, update the manifest and the runtime index')
    ap.add_argument('--pack', action='store_true', help='alias of --apply (P8 name)')
    ap.add_argument('--approve', action='append', default=[], help='runtime name approved by a person after the 64 px and phone review')
    ap.add_argument('--revert', action='append', default=[], help='runtime name to withdraw (monogram restored)')
    ap.add_argument('--reviewer', default='')
    ap.add_argument('--note', default='')
    ap.add_argument('--proof', default='docs/briefs/009/portrait-64-proof.png')
    ap.add_argument('--report', default='docs/reports/art-status-p9.json')
    args = ap.parse_args()
    apply = args.apply or args.pack
    root = Path(args.root)
    status_src = json.loads((root / 'src/game/run/data/p8-visual-status.json').read_text())
    manifest_path = root / 'docs/asset-manifest.json'
    manifest = load_json(manifest_path, {'assets': []})
    approvals_path = root / 'art/approvals.json'
    approvals = load_json(approvals_path, {'approvals': [], 'reverts': []})
    out_dir = root / 'public/assets/portraits'
    today = datetime.date.today().isoformat()

    if (args.approve or args.revert) and not apply:
        ap.error('--approve and --revert change files: use them with --apply')
    if args.approve and not args.reviewer:
        ap.error('--approve needs --reviewer (the person who looked at the 64 px proof and the phone screenshots)')

    sources = {runtime_name(s['path']): (s, root / s['path']) for s in status_src['sources']}
    for name in args.approve + args.revert:
        if name not in sources:
            ap.error(f'unknown portrait {name!r}; known: {", ".join(sorted(sources))}')

    present = {k: p for k, (_, p) in sources.items() if p.exists()}
    dupes = near_duplicates({**present, **{k: out_dir / f'{k}.webp' for k in PAINTED if (out_dir / f'{k}.webp').exists() and k not in present}}) if present else {}

    report = {'generated': today, 'portraits': [], 'backs': []}
    tiles = []
    for name in PAINTED:
        f = out_dir / f'{name}.webp'
        if f.exists() and name not in present:
            label = 'Adjudicator (provisional)' if name == 'adjudicator' else name.title() + ' (painted)'
            tiles.append((label, circle(Image.open(f))))
    index = set(load_json(out_dir / 'index.json', PAINTED)) if apply else None
    for name, (src, path) in sources.items():
        entry = {'character': src['character'], 'runtime': name, 'source': src['path'], 'present': path.exists()}
        if name in args.revert:
            approvals['reverts'].append({'runtime': name, 'date': today, 'note': args.note, 'sha256': sha256(path) if path.exists() else None})
            approvals['approvals'] = [a for a in approvals['approvals'] if a['runtime'] != name]
        if not path.exists():
            entry['status'] = 'needed'
            entry['detail'] = 'source file not delivered'
            tiles.append((src['character'] + ' (monogram)', monogram(src['character'])))
        else:
            digest = sha256(path)
            entry['sha256'] = digest
            problems = check_portrait(path)
            if name in dupes:
                problems.append('near-duplicate of ' + ', '.join(dupes[name]))
            entry['problems'] = problems
            prov_path = path.with_suffix('.provenance.json')
            entry['provenance'] = load_json(prov_path, None)
            if name in args.revert:
                entry['status'] = 'needed'
                entry['detail'] = f'withdrawn on {today}: {args.note or "no reason given"}'
                tiles.append((src['character'] + ' (withdrawn)', monogram(src['character'])))
            elif problems:
                entry['status'] = 'rejected'
                entry['detail'] = 'fails machine checks; not packed, monogram kept'
                tiles.append((src['character'] + ' (FAILS)', circle(Image.open(path))))
            else:
                if name in args.approve and not entry['provenance']:
                    ap.error(f'{name}: no provenance note at {prov_path.relative_to(root)}; record author, method and license before approval')
                if name in args.approve:
                    approvals['approvals'] = [a for a in approvals['approvals'] if a['runtime'] != name]
                    approvals['approvals'].append({'runtime': name, 'sha256': digest, 'reviewer': args.reviewer, 'date': today, 'note': args.note})
                approved = any(a['runtime'] == name and a['sha256'] == digest for a in approvals['approvals'])
                entry['status'] = 'integrated' if approved else 'delivered'
                entry['detail'] = 'approved by a person for this exact file' if approved else 'passes machine checks; packed for the 64 px and phone review'
                tiles.append((src['character'] + (' (integrated)' if approved else ' (delivered)'), circle(Image.open(path))))
        if apply:
            runtime = out_dir / f'{name}.webp'
            if entry['status'] in ('delivered', 'integrated'):
                Image.open(path).convert('RGBA').resize((256, 256), Image.LANCZOS).save(runtime, 'WEBP', quality=88, method=6)
                index.add(name)
            elif name not in PAINTED:
                # Revert to the monogram: no runtime file, not listed.
                if runtime.exists():
                    runtime.unlink()
                index.discard(name)
            else:
                # A painted P2/P3 portrait stays (or is restored) if its replacement is missing, fails or is withdrawn.
                original = root / ORIGINAL.get(name, '')
                if name in ORIGINAL and original.is_file():
                    Image.open(original).convert('RGBA').resize((256, 256), Image.LANCZOS).save(runtime, 'WEBP', quality=88, method=6)
                index.add(name)
        report['portraits'].append(entry)

    standard_path = root / 'art/source/chatgpt-p3/back-300.png'
    felt_path = root / 'public/assets/felt.webp'
    incoming = root / 'art/incoming/p8'
    if standard_path.exists() and felt_path.exists():
        standard = Image.open(standard_path).convert('RGBA')
        felt_lum = ImageStat.Stat(Image.open(felt_path).convert('L')).mean[0]
        for b in sorted(incoming.glob('back-*.png')) if incoming.exists() else []:
            problems = check_back(b, standard, felt_lum)
            report['backs'].append({'source': str(b.relative_to(root)), 'status': 'rejected' if problems else 'delivered', 'problems': problems})
    if not report['backs']:
        report['backs'].append({'note': 'no cosmetic back delivered (art/incoming/p8/back-cinder.png, back-crown.png); both stay art pending'})

    if apply:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / 'index.json').write_text(json.dumps(sorted(index)) + '\n')
        by_source = {e['source']: e for e in report['portraits']}
        for asset in manifest['assets']:
            e = by_source.get(asset.get('source'))
            if e and asset.get('id', '').startswith('portrait.'):
                asset['status'] = e['status']
                asset['check'] = {'date': today, 'sha256': e.get('sha256'), 'problems': e.get('problems', []), 'detail': e['detail'], 'provenance': e.get('provenance')}
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
        approvals_path.parent.mkdir(parents=True, exist_ok=True)
        approvals_path.write_text(json.dumps(approvals, indent=2) + '\n')

    cols = 4
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 190, max(1, rows) * 110), (11, 16, 19))
    d = ImageDraw.Draw(sheet)
    for i, (label, tile) in enumerate(tiles):
        x, y = (i % cols) * 190 + 63, (i // cols) * 110 + 8
        sheet.paste(tile, (x, y), tile)
        d.text(((i % cols) * 190 + 6, y + 70), label[:30], fill=(239, 231, 213))
    proof = root / args.proof
    proof.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(proof)
    rep = root / args.report
    rep.parent.mkdir(parents=True, exist_ok=True)
    rep.write_text(json.dumps(report, indent=2) + '\n')
    for p in report['portraits']:
        print(f"{p['character']:20} {p['status']:10} {p['detail']}")
    print(json.dumps(report['backs']))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
