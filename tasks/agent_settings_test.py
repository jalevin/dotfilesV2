import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('agent_settings', ROOT / 'tasks/agent-settings.py')
settings = importlib.util.module_from_spec(spec)
spec.loader.exec_module(settings)


class AgentSettingsTests(unittest.TestCase):
    def run_task(self, home, machine, check=False):
        env = dict(os.environ, HOME=str(home), CODEX_HOME=str(home / '.codex'), MISE_ENV=machine)
        env.pop('CHECK', None)
        if check:
            env['CHECK'] = '1'
        return subprocess.run(
            ['python3', str(ROOT / 'tasks/agent-settings.py')], env=env,
            capture_output=True, text=True, timeout=60,
        )

    def test_machine_switch_preserves_runtime_state_and_check_is_read_only(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            (home / '.codex').mkdir()
            codex = home / '.codex/config.toml'
            codex.write_text('''# Preserve this comment and this retired Hive path.
[projects."/old/hive/worktree"]
trust_level = "trusted"
[mcp_servers.custom]
url = "http://localhost:9999/mcp"
[desktop]
customPreference = true
''')
            (home / '.claude').mkdir()
            claude = home / '.claude/settings.json'
            claude.write_text(json.dumps({'customPreference': True, 'enabledPlugins': {'mine@local': True}}))
            local = home / '.claude/settings.local.json'
            local.write_text('{"model":"local-model"}')

            before = {p: p.read_bytes() for p in (codex, claude, local)}
            result = self.run_task(home, 'grafana', check=True)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertEqual(before, {p: p.read_bytes() for p in before})
            self.assertFalse(list(home.glob('*/dotfiles-backups')))

            result = self.run_task(home, 'grafana')
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('airbud-mcp-prod', codex.read_text())
            self.assertTrue(json.loads(claude.read_text())['enabledPlugins']['grafana-enghub@grafana-ai-kit'])
            self.assertEqual(self.run_task(home, 'grafana', check=True).returncode, 0)

            result = self.run_task(home, 'personal')
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertNotIn('airbud-mcp-prod', codex.read_text())
            for value in ('# Preserve this comment', '/old/hive/worktree', 'localhost:9999', 'customPreference'):
                self.assertIn(value, codex.read_text())
            current = json.loads(claude.read_text())
            self.assertTrue(current['customPreference'])
            self.assertTrue(current['enabledPlugins']['mine@local'])
            self.assertFalse(current['enabledPlugins']['grafana-enghub@grafana-ai-kit'])
            self.assertNotIn('grafana-ai-kit', current['extraKnownMarketplaces'])
            self.assertTrue(current['enabledPlugins']['plannotator@plannotator'])
            self.assertEqual(local.read_bytes(), before[local])
            self.assertEqual(self.run_task(home, 'personal', check=True).returncode, 0)

    def test_migration_copies_state_without_writing_through_symlink(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'source.json'
            source.write_text('{"local":true}')
            target = root / 'settings.json'
            target.symlink_to(source)
            self.assertTrue(settings.detach(target, source, check=True))
            self.assertTrue(target.is_symlink())
            settings.detach(target, source, check=False)
            self.assertFalse(target.is_symlink())
            self.assertEqual(target.read_bytes(), source.read_bytes())
            settings.atomic_write(target, b'{"updated":true}', target.read_bytes())
            self.assertEqual(source.read_text(), '{"local":true}')
            other = root / 'other.json'
            other.symlink_to(source)
            with self.assertRaises(RuntimeError):
                settings.detach(other, root / 'unmanaged.json', check=False)


if __name__ == '__main__':
    unittest.main()
