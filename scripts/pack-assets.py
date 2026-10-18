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
    back = Image.open(ROOT / 'art/source/chatgpt-p2/back.png').convert('RGBA').resize((FW, FH), Image.LANCZOS)
    sheet.paste(back, ((52 % COLS) * FW, (52 // COLS) * FH))
    sheet.save(OUT / 'cards.webp', 'WEBP', quality=86, method=6)

    Image.open(GEN / 'table/felt.png').convert('RGB').save(OUT / 'felt.webp', 'WEBP', quality=82, method=6)
    (OUT / 'portraits').mkdir(exist_ok=True)
    for src in sorted((ROOT / 'art/source/chatgpt-p2/portraits').glob('*.png')):
        Image.open(src).convert('RGBA').resize((256, 256), Image.LANCZOS).save(OUT / f'portraits/{src.stem}.webp', 'WEBP', quality=88, method=6)
    for name, sub in [('lifechip', 'chips'), ('dealer-button', 'ui')]:
        Image.open(GEN / f'{sub}/{name}.png').save(OUT / f'{name}.png', optimize=True)
    for f in sorted(OUT.glob('**/*')):
        if f.is_file():
            print(f'{f.relative_to(ROOT)}: {f.stat().st_size // 1024} KB')

if __name__ == '__main__':
    main()
