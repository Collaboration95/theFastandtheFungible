"""Bounded publisher retries, including remote-conflict refusal."""
import importlib.util
import pathlib
import subprocess
import unittest
import sys
sys.dont_write_bytecode = True
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('site_publish', pathlib.Path(__file__).with_name('site-publish.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class RetryTests(unittest.TestCase):
    def test_retry_then_success(self):
        fail = subprocess.CompletedProcess([], 1, '', 'remote advanced')
        ok = subprocess.CompletedProcess([], 0, '', '')
        with patch.object(module, 'git') as git, patch.object(module.subprocess, 'run', side_effect=[fail, ok, ok]) as run:
            module.push_with_retry('/tmp/pages')
            self.assertEqual(run.call_count, 3)
            git.assert_called_once_with('fetch', 'origin', 'gh-pages')
            self.assertFalse(any('--force' in call.args[0] for call in run.call_args_list))
    def test_exhausted_is_bounded(self):
        fail = subprocess.CompletedProcess([], 1, '', 'network unavailable')
        ok = subprocess.CompletedProcess([], 0, '', '')
        with patch.object(module, 'git'), patch.object(module.subprocess, 'run', side_effect=[fail, ok, fail, ok, fail]) as run:
            with self.assertRaisesRegex(SystemExit, 'after 3 push attempts'):
                module.push_with_retry('/tmp/pages')
            self.assertEqual(run.call_count, 5)
    def test_remote_conflict_stops(self):
        fail = subprocess.CompletedProcess([], 1, '', 'conflict')
        with patch.object(module, 'git') as git, patch.object(module.subprocess, 'run', return_value=fail) as run:
            with self.assertRaisesRegex(SystemExit, 'concurrent gh-pages changes conflict'):
                module.push_with_retry('/tmp/pages')
            self.assertEqual(run.call_count, 2)
            git.assert_any_call('rebase', '--abort', cwd='/tmp/pages', check=False)

if __name__ == '__main__':
    unittest.main()
