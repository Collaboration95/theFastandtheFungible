"""Offline parser checks: python3 -m unittest discover -s evolution -p test_sff.py"""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('build_data', Path(__file__).with_name('build_data.py'))
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class SffTests(unittest.TestCase):
    source = '''# SFF push
## Plan
### Tue 3 Nov
not a changelog day
## Changelog
### Tue 3 Nov
- A ship (#258).
  Continued line.
- Wasted spend 39.5% → 20% (fixture).
### Mon 2 Nov
- Earlier ship: search → purchase → cited answer.
'''

    def data(self, history=None):
        def read(_repo, _ref, path, optional=False):
            return self.source if path.endswith('.md') else history
        with patch.object(build, 'read_main', side_effect=read), patch.object(build, 'git', return_value=b'a' * 40):
            return build.sff_data('unused')

    def test_days_only_from_changelog_and_metric_not_invented(self):
        data = self.data()
        self.assertEqual([d['date'] for d in data['cards']], ['2026-11-03', '2026-11-02'])
        self.assertEqual(data['cards'][0]['ships'][0], 'A ship (#258). Continued line.')
        self.assertEqual(len(data['cards'][0]['metrics']), 1)
        self.assertEqual(data['cards'][1]['metrics'], [])

    def test_missing_scorecard_stays_missing(self):
        data = self.data()
        self.assertFalse(data['scorecard_available'])
        self.assertEqual(data['scorecard'], [])

    def test_history_keeps_zero_null_mode_and_commit_skips_bad_rows(self):
        row = dict(mode='fixture', sha='a' * 40, metrics=dict(wastedSpendPct=0, selectionF1=None))
        data = self.data(json.dumps(row) + '\nnot json\n[]\n')
        self.assertEqual(data['scorecard'], [row])
        self.assertEqual(data['skipped_scorecard_rows'], 2)

    def test_sff_regeneration_preserves_october_data(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / 'data.js'
            original = dict(commits=[[1, 2, 3]], agents=dict(tokens=42), last_day='2026-10-11')
            out.write_text('window.EVO = ' + json.dumps(original) + ';\n')
            with patch.object(build, 'OUT', out), patch.object(build, 'sff_data', return_value=dict(cards=[], scorecard=[], source_sha='a'*40)):
                build.update_sff('unused')
            result = json.loads(out.read_text().split('window.EVO = ')[1].strip().removesuffix(';'))
            self.assertEqual({k: result[k] for k in original}, original)


if __name__ == '__main__':
    unittest.main()
