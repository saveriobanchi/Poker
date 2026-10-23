#!/usr/bin/env python3
"""Tests for scripts/check-art.py on synthetic fixtures (npm run test:art; needs Pillow).

The fixtures are geometric test shapes made here, in a temporary folder. They are
never written into the repository and are not artwork.
"""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent
SCRIPT = REPO / 'scripts/check-art.py'
SOURCES = json.loads((REPO / 'src/game/run/data/p8-visual-status.json').read_text())['sources']


def bust(path: Path, hue: int, size=(512, 512), mode='RGBA', opaque_bg=False, shift=0) -> None:
    im = Image.new('RGBA', size, (40, 40, 40, 255) if opaque_bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    w, h = size
    d.ellipse((w * 0.32 + shift, h * 0.08, w * 0.68 + shift, h * 0.5), fill=(hue, 120, 255 - hue, 255))
    d.rectangle((w * 0.15, h * 0.48, w * 0.85, h - 1), fill=(255 - hue, hue, 90, 255))
    for i in range(6):
        d.ellipse((w * 0.2 + i * 40 + hue % 30, h * 0.6 + (hue * i) % 120, w * 0.2 + i * 40 + 30 + hue % 30, h * 0.6 + (hue * i) % 120 + 30), fill=((hue * 7 + i * 40) % 255, 30, (hue * 3) % 255, 255))
    path.parent.mkdir(parents=True, exist_ok=True)
    (im if mode == 'RGBA' else im.convert(mode)).save(path)


class ArtPipeline(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        for rel in ['src/game/run/data/p8-visual-status.json', 'docs/asset-manifest.json', 'art/source/chatgpt-p3/adjudicator.png', 'art/source/chatgpt-p3/back-300.png', 'public/assets/felt.webp']:
            (self.root / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(REPO / rel, self.root / rel)
        (self.root / 'public/assets/portraits').mkdir(parents=True)
        for name in ['wagerer', 'vesper', 'oracle', 'corvin', 'adjudicator']:
            shutil.copy(REPO / f'public/assets/portraits/{name}.webp', self.root / f'public/assets/portraits/{name}.webp')

    def tearDown(self):
        shutil.rmtree(self.root)

    def run_art(self, *args):
        r = subprocess.run([sys.executable, '-I', str(SCRIPT), '--root', str(self.root), *args], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r

    def statuses(self):
        m = json.loads((self.root / 'docs/asset-manifest.json').read_text())
        return {a['source']: a['status'] for a in m['assets'] if a['id'].startswith('portrait.') and a['source'].startswith('art/incoming')}

    def index(self):
        return json.loads((self.root / 'public/assets/portraits/index.json').read_text())

    def test_nothing_delivered_keeps_needed_and_monograms(self):
        self.run_art('--apply')
        self.assertEqual(set(self.statuses().values()), {'needed'})
        self.assertEqual(self.index(), sorted(['adjudicator', 'corvin', 'oracle', 'vesper', 'wagerer']))

    def test_dry_run_changes_nothing(self):
        bust(self.root / SOURCES[1]['path'], 30)
        before = (self.root / 'docs/asset-manifest.json').read_text()
        self.run_art()
        self.assertEqual((self.root / 'docs/asset-manifest.json').read_text(), before)
        self.assertFalse((self.root / 'public/assets/portraits/mara-quill.webp').exists())

    def test_valid_file_is_delivered_then_integrated_only_by_a_person_and_reverts(self):
        src = self.root / SOURCES[1]['path']  # Mara Quill
        bust(src, 30)
        self.run_art('--apply')
        self.assertEqual(self.statuses()[SOURCES[1]['path']], 'delivered')
        self.assertIn('mara-quill', self.index())
        self.assertTrue((self.root / 'public/assets/portraits/mara-quill.webp').exists())
        r = subprocess.run([sys.executable, '-I', str(SCRIPT), '--root', str(self.root), '--apply', '--approve', 'mara-quill'], capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0, 'approval without a reviewer must be refused')
        r = subprocess.run([sys.executable, '-I', str(SCRIPT), '--root', str(self.root), '--apply', '--approve', 'mara-quill', '--reviewer', 'Director'], capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0, 'approval without provenance must be refused')
        src.with_suffix('.provenance.json').write_text(json.dumps({'author': 'test', 'method': 'synthetic fixture', 'license': 'test only', 'date': '2026-10-22'}))
        self.run_art('--apply', '--approve', 'mara-quill', '--reviewer', 'Director', '--note', '64px + iPhone 13/SE')
        self.assertEqual(self.statuses()[SOURCES[1]['path']], 'integrated')
        # Editing the file after approval drops it back to delivered.
        bust(src, 31, shift=4)
        self.run_art('--apply')
        self.assertEqual(self.statuses()[SOURCES[1]['path']], 'delivered')
        # Withdrawal restores the monogram.
        self.run_art('--apply', '--revert', 'mara-quill', '--note', 'face lost at 64px')
        self.assertNotIn('mara-quill', self.index())
        self.assertFalse((self.root / 'public/assets/portraits/mara-quill.webp').exists())

    def test_bad_files_are_rejected_and_not_packed(self):
        cases = [
            (SOURCES[1]['path'], dict(size=(600, 600))),
            (SOURCES[2]['path'], dict(mode='RGB')),
            (SOURCES[3]['path'], dict(opaque_bg=True)),
        ]
        for rel, kw in cases:
            bust(self.root / rel, 50, **kw)
        self.run_art('--apply')
        st = self.statuses()
        for rel, _ in cases:
            self.assertEqual(st[rel], 'rejected', rel)
            self.assertNotIn(Path(rel).stem, self.index())

    def test_near_duplicates_are_rejected(self):
        bust(self.root / SOURCES[4]['path'], 90)
        bust(self.root / SOURCES[5]['path'], 90)
        self.run_art('--apply')
        st = self.statuses()
        self.assertEqual(st[SOURCES[4]['path']], 'rejected')
        self.assertEqual(st[SOURCES[5]['path']], 'rejected')

    def test_failed_adjudicator_replacement_keeps_the_provisional_painting(self):
        bust(self.root / SOURCES[0]['path'], 70, mode='RGB')
        self.run_art('--apply')
        self.assertEqual(self.statuses()[SOURCES[0]['path']], 'rejected')
        self.assertIn('adjudicator', self.index())
        self.assertTrue((self.root / 'public/assets/portraits/adjudicator.webp').exists())


    def back(self, name, rim, fill, full_rect=False):
        std = Image.open(self.root / 'art/source/chatgpt-p3/back-300.png').convert('RGBA')
        im = Image.new('RGBA', (300, 420), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, 299, 419), fill=rim)
        d.rectangle((18, 18, 281, 401), fill=fill)
        if not full_rect:
            im.putalpha(std.getchannel('A'))
        p = self.root / f'art/incoming/p8/{name}.png'
        p.parent.mkdir(parents=True, exist_ok=True)
        im.save(p)
        return p

    def backs(self):
        return {Path(b['source']).stem: b for b in json.loads((self.root / 'docs/reports/art-status-p9.json').read_text())['backs'] if 'source' in b}

    def test_back_gates_edge_contrast_and_packs_passing_backs(self):
        self.back('back-cinder', (230, 200, 120, 255), (40, 20, 18, 255))  # bright rim: passes
        self.back('back-crown', (24, 46, 41, 255), (24, 46, 41, 255))  # rim the colour of the felt: fails
        self.run_art('--apply')
        b = self.backs()
        self.assertEqual(b['back-cinder']['status'], 'delivered', b['back-cinder'])
        self.assertEqual(b['back-crown']['status'], 'rejected')
        self.assertTrue(any('3:1' in x for x in b['back-crown']['problems']))
        self.assertEqual(json.loads((self.root / 'public/assets/backs/index.json').read_text()), ['cinder_etch'])

    def test_remask_applies_the_canonical_alpha_keeps_the_original_and_records_it(self):
        p = self.back('back-cinder', (230, 200, 120, 255), (40, 20, 18, 255), full_rect=True)
        self.run_art()
        self.assertEqual(self.backs()['back-cinder']['status'], 'rejected')
        self.run_art('--apply', '--remask-backs')
        b = self.backs()['back-cinder']
        self.assertEqual(b['status'], 'delivered', b)
        self.assertTrue((p.parent / 'original/back-cinder.png').exists())
        self.assertTrue(b['remask']['original_sha256'] != b['remask']['result_sha256'])

    def test_remask_refuses_art_smaller_than_the_canonical_silhouette(self):
        p = self.back('back-cinder', (230, 200, 120, 255), (40, 20, 18, 255))
        im = Image.open(p)
        im.putalpha(Image.new('L', (300, 420), 0))
        im.save(p)
        r = subprocess.run([sys.executable, '-I', str(SCRIPT), '--root', str(self.root), '--remask-backs'], capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)


if __name__ == '__main__':
    unittest.main()
