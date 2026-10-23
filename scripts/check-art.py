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


def _rel_lum(rgb) -> float:
    def lin(c: float) -> float:
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb[:3]
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def rim_contrast(im: Image.Image, felt_rgb) -> float:
    """WCAG 1.4.11 non-text contrast of a card's edge against the felt: the brightest tenth of the
    opaque outer 16px band (the rim line that draws the card's boundary) versus the felt's mean colour."""
    a = im.getchannel('A')
    w, h = im.size
    rim = sorted(_rel_lum(im.getpixel((x, y))) for x in range(w) for y in range(h) if a.getpixel((x, y)) >= 250 and (x < 16 or x >= w - 16 or y < 16 or y >= h - 16))
    p90 = rim[int(len(rim) * 0.9)] if rim else 0.0
    return (p90 + 0.05) / (_rel_lum(felt_rgb) + 0.05)


def remask_back(path: Path, standard: Image.Image, root: Path) -> dict | None:
    """Applies the canonical back's alpha to a delivered back whose silhouette differs (hand-off v1.2 §B).
    The original is kept under art/incoming/p8/original/ and the step is recorded beside the file.
    Only ever removes coverage: refuses if the new art would need pixels it never painted."""
    im = Image.open(path).convert('RGBA')
    sa = standard.getchannel('A')
    if im.size != standard.size or im.getchannel('A').tobytes() == sa.tobytes():
        return None
    a = im.getchannel('A')
    if any(x > 0 and y == 0 for x, y in zip(sa.tobytes(), a.tobytes())):
        raise SystemExit(f'{path.name}: the canonical silhouette covers pixels this art leaves empty; remask refused')
    keep = path.parent / 'original' / path.name
    keep.parent.mkdir(exist_ok=True)
    if not keep.exists():
        keep.write_bytes(path.read_bytes())
    out = im.copy()
    out.putalpha(sa)
    if out.tobytes() != out.rotate(180).tobytes():
        raise SystemExit(f'{path.name}: remasked result is not exactly 180-degree symmetric; refused')
    out.save(path)
    record = {'step': 'alpha replaced by the canonical back alpha (art/source/chatgpt-p3/back-300.png)', 'original': str(keep.relative_to(root)), 'original_sha256': sha256(keep), 'result_sha256': sha256(path), 'date': datetime.date.today().isoformat()}
    path.with_suffix('.remask.json').write_text(json.dumps(record, indent=2) + '\n')
    return record


BACK_IDS = {'back-cinder': 'cinder_etch', 'back-crown': 'crown_filigree'}


def check_back(path: Path, standard: Image.Image, felt_rgb) -> list[str]:
    problems = []
    im = Image.open(path)
    if im.size != (300, 420) or im.mode != 'RGBA':
        return [f'{im.size} {im.mode}, expected 300x420 RGBA']
    if im.tobytes() != im.rotate(180).tobytes():
        problems.append('not exactly symmetric under 180-degree rotation')
    if im.getchannel('A').tobytes() != standard.getchannel('A').tobytes():
        problems.append('alpha silhouette differs from the standard back')
    ratio = rim_contrast(im, felt_rgb)
    if ratio < 3:
        problems.append(f'card edge contrast with the felt {ratio:.2f}:1, below the 3:1 of WCAG 1.4.11')
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
    ap.add_argument('--remask-backs', action='store_true', help='apply the canonical alpha to delivered backs whose silhouette differs (recorded, originals kept)')
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
    backs_ready: list[str] = []
    if standard_path.exists() and felt_path.exists():
        standard = Image.open(standard_path).convert('RGBA')
        felt = Image.open(felt_path).convert('RGB')
        fw, fh = felt.size
        felt_rgb = ImageStat.Stat(felt.crop((int(fw * 0.15), int(fh * 0.3), int(fw * 0.85), int(fh * 0.62)))).mean
        for b in sorted(incoming.glob('back-*.png')) if incoming.exists() else []:
            remask = remask_back(b, standard, root) if args.remask_backs else None
            problems = check_back(b, standard, felt_rgb)
            entry = {'source': str(b.relative_to(root)), 'id': BACK_IDS.get(b.stem), 'sha256': sha256(b), 'status': 'rejected' if problems else 'delivered', 'problems': problems, 'edge_contrast': round(rim_contrast(Image.open(b).convert('RGBA'), felt_rgb), 2)}
            rec = b.with_suffix('.remask.json')
            if rec.exists():
                entry['remask'] = json.loads(rec.read_text())
            report['backs'].append(entry)
            if apply and not problems and BACK_IDS.get(b.stem):
                backs_dir = root / 'public/assets/backs'
                backs_dir.mkdir(parents=True, exist_ok=True)
                Image.open(b).convert('RGBA').save(backs_dir / f'{BACK_IDS[b.stem]}.webp', 'WEBP', quality=90, method=6)
                backs_ready.append(BACK_IDS[b.stem])
    if not report['backs']:
        report['backs'].append({'note': 'no cosmetic back delivered (art/incoming/p8/back-cinder.png, back-crown.png); both stay art pending'})

    if apply:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / 'index.json').write_text(json.dumps(sorted(index)) + '\n')
        backs_dir = root / 'public/assets/backs'
        backs_dir.mkdir(parents=True, exist_ok=True)
        for f in backs_dir.glob('*.webp'):
            if f.stem not in backs_ready:
                f.unlink()
        (backs_dir / 'index.json').write_text(json.dumps(sorted(backs_ready)) + '\n')
        for e in report['backs']:
            if not e.get('id'):
                continue
            aid = f"card.back.{e['id']}"
            asset = next((a for a in manifest['assets'] if a.get('id') == aid), None)
            if asset is None:
                asset = {'id': aid, 'source': e['source'], 'runtime': f"public/assets/backs/{e['id']}.webp", 'width': 300, 'height': 420, 'alpha': True, 'origin': 'ChatGPT visual direction v1.2 (programmatic vector art)', 'license': 'project original'}
                manifest['assets'].append(asset)
            asset['status'] = e['status']
            asset['check'] = {'date': today, 'sha256': e['sha256'], 'problems': e['problems'], 'edge_contrast': e['edge_contrast'], 'remask': e.get('remask'), 'detail': 'optional cosmetic: selectable once unlocked by the testament; same back on every face-down card'}
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
