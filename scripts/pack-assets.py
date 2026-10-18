#!/usr/bin/env python3
"""Packs source art into small runtime files under public/assets/ (needs Pillow).

- cards.webp: 8x7 sprite sheet of 300x420 frames. Frame i is engine card i
  ((rank - 2) * 4 + suit, suits c,d,h,s); frame 52 is the card back.
- felt.webp, portraits/*.webp (256x256), chip and dealer button PNGs.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / 'art/generated'
OUT = ROOT / 'public/assets'
RANKS = '23456789TJQKA'
SUITS = 'cdhs'
FW, FH, COLS = 300, 420, 8

def main():
    for old in ['cards', 'table', 'chips', 'ui']:
        d = OUT / old
        if d.exists():
            for f in d.iterdir():
                if f.suffix == '.png' and f.name != 'back.png':
                    f.unlink()
    sheet = Image.new('RGBA', (FW * COLS, FH * 7), (0, 0, 0, 0))
    for r, rank in enumerate(RANKS):
        for s, suit in enumerate(SUITS):
            i = r * 4 + s
            im = Image.open(GEN / f'cards/{rank}{suit}.png').convert('RGBA')
            sheet.paste(im, ((i % COLS) * FW, (i // COLS) * FH))
    # Design v0.5: the exactly 180-degree-symmetric 300x420 back (checked below).
    back = Image.open(ROOT / 'art/source/chatgpt-p3/back-300.png').convert('RGBA')
    assert back.size == (FW, FH) and back.tobytes() == back.rotate(180).tobytes(), 'card back must be 300x420 and exactly symmetric'
    sheet.paste(back, ((52 % COLS) * FW, (52 // COLS) * FH))
    sheet.save(OUT / 'cards.webp', 'WEBP', quality=86, method=6)

    Image.open(GEN / 'table/felt.png').convert('RGB').save(OUT / 'felt.webp', 'WEBP', quality=82, method=6)
    (OUT / 'portraits').mkdir(exist_ok=True)
    portraits = sorted((ROOT / 'art/source/chatgpt-p2/portraits').glob('*.png')) + [ROOT / 'art/source/chatgpt-p3/adjudicator.png']
    for src in portraits:
        Image.open(src).convert('RGBA').resize((256, 256), Image.LANCZOS).save(OUT / f'portraits/{src.stem}.webp', 'WEBP', quality=88, method=6)
    (OUT / 'ui').mkdir(exist_ok=True)
    p3 = ROOT / 'art/source/chatgpt-p3'
    # Three-slice the contract (960x1200) so ornaments never stretch: top band, repeatable middle, bottom band.
    contract = Image.open(p3 / 'last-claim-contract.png').convert('RGBA')
    for name, box in [('top', (0, 0, 960, 240)), ('mid', (0, 400, 960, 600)), ('bottom', (0, 1000, 960, 1200))]:
        band = contract.crop(box)
        band.resize((640, band.height * 2 // 3), Image.LANCZOS).save(OUT / f'ui/contract-{name}.webp', 'WEBP', quality=86, method=6)
    old = OUT / 'ui/contract.webp'
    if old.exists():
        old.unlink()
    Image.open(p3 / 'ledger-title-card.png').convert('RGBA').resize((800, 420), Image.LANCZOS).save(OUT / 'ui/ledger-title.webp', 'WEBP', quality=86, method=6)
    Image.open(p3 / 'ledger-seal.png').convert('RGBA').resize((128, 128), Image.LANCZOS).save(OUT / 'ui/ledger-seal.webp', 'WEBP', quality=90, method=6)
    for name, sub in [('lifechip', 'chips'), ('dealer-button', 'ui')]:
        Image.open(GEN / f'{sub}/{name}.png').save(OUT / f'{name}.png', optimize=True)
    for f in sorted(OUT.glob('**/*')):
        if f.is_file():
            print(f'{f.relative_to(ROOT)}: {f.stat().st_size // 1024} KB')

if __name__ == '__main__':
    main()
