#!/usr/bin/env python3
"""Apply tracked agent preferences without replacing machine-local state."""

import copy
import json
import os
from pathlib import Path
import queue
import subprocess
import tempfile
import threading


ROOT = Path(__file__).resolve().parent.parent


def merge(current, desired, remove_null=True):
    result = copy.deepcopy(current)
    for key, value in desired.items():
        if value is None and remove_null:
            result.pop(key, None)
        elif isinstance(value, dict):
            previous = result.get(key, {})
            result[key] = merge(previous if isinstance(previous, dict) else {}, value, remove_null)
        else:
            result[key] = copy.deepcopy(value)
    return result


def backup(path, content):
    directory = path.parent / 'dotfiles-backups'
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, name = tempfile.mkstemp(prefix=path.name + '-', dir=directory)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(content)
    print('agent-settings: backup ' + name)


def atomic_write(path, content, original):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.' + path.name, dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(content)
        current = path.read_bytes() if path.exists() else None
        if current != original:
            raise RuntimeError(str(path) + ' changed during setup; rerun the task')
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def detach(path, expected_source, check):
    if not path.is_symlink():
        return False
    if path.resolve() != expected_source.resolve():
        raise RuntimeError('Refusing to replace an unmanaged symlink: ' + str(path))
    content = path.read_bytes()
    if not check:
        backup(path, content)
        atomic_write(path, content, content)
    return True


class CodexConfig:
    def __init__(self, codex_home):
        self.process = subprocess.Popen(
            ['codex', 'app-server'], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, text=True, cwd=codex_home.parent,
            env=dict(os.environ, CODEX_HOME=str(codex_home)),
        )
        self.responses = queue.Queue()
        self.request_id = 0

        def read():
            try:
                for line in self.process.stdout:
                    self.responses.put(json.loads(line))
            finally:
                self.responses.put(None)

        threading.Thread(target=read, daemon=True).start()

    def __enter__(self):
        try:
            self.request('initialize', {'clientInfo': {'name': 'dotfiles-settings', 'version': '1'}})
            self.send({'method': 'initialized', 'params': {}})
            return self
        except Exception:
            self.__exit__(None, None, None)
            raise

    def send(self, message):
        self.process.stdin.write(json.dumps(message) + '\n')
        self.process.stdin.flush()

    def request(self, method, params):
        self.request_id += 1
        self.send({'id': self.request_id, 'method': method, 'params': params})
        while True:
            try:
                response = self.responses.get(timeout=30)
            except queue.Empty:
                raise RuntimeError('Codex configuration request timed out: ' + method)
            if response is None:
                raise RuntimeError('Codex app-server exited during ' + method)
            if response.get('id') != self.request_id:
                continue
            if 'error' in response:
                raise RuntimeError(method + ': ' + response['error']['message'])
            return response['result']

    def __exit__(self, *_):
        self.process.terminate()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait()
        self.process.stdin.close()
        self.process.stdout.close()


def configure_codex(home, desired, check):
    codex_home = home / '.codex'
    path = codex_home / 'config.toml'
    if check and not codex_home.is_dir():
        print('agent-settings: Codex DRIFT (not configured yet)')
        return 1
    migrating = detach(path, ROOT / 'home/.codex/config.toml', check)
    codex_home.mkdir(parents=True, exist_ok=True)
    with CodexConfig(codex_home) as client:
        response = client.request('config/read', {'includeLayers': True})
        layer = next(layer for layer in response['layers']
                     if layer['name']['type'] == 'user' and not layer['name'].get('profile'))
        edits = []
        for key, value in desired.items():
            current = layer['config']
            for segment in key.split('.'):
                current = current.get(segment) if isinstance(current, dict) else None
            if current != value:
                edits.append({'keyPath': key, 'value': value, 'mergeStrategy': 'replace'})
        if edits and not check:
            if path.exists():
                backup(path, path.read_bytes())
            client.request('config/batchWrite', {
                'edits': edits, 'expectedVersion': layer['version'], 'reloadUserConfig': False,
            })
        changes = len(edits) + int(migrating)
        print('agent-settings: Codex ' + ('DRIFT' if check and changes else
              'updated' if changes else 'in sync'))
        return changes


def configure_claude(home, desired, check):
    path = home / '.claude/settings.json'
    migrating = detach(path, ROOT / 'home/.claude/settings.json', check)
    original = path.read_bytes() if path.exists() else None
    current = json.loads(original) if original else {}
    updated = merge(current, desired)
    changed = current != updated
    if changed and not check:
        if original is not None:
            backup(path, original)
        atomic_write(path, (json.dumps(updated, indent=2) + '\n').encode(), original)
    changes = int(changed or migrating)
    print('agent-settings: Claude ' + ('DRIFT' if check and changes else
          'updated' if changes else 'in sync'))
    return changes


def main():
    machine = os.environ.get('MISE_ENV', '')
    if machine not in ('grafana', 'personal'):
        raise RuntimeError('Set MISE_ENV to exactly grafana or personal (mise run stamp)')
    home = Path.home()
    if os.environ.get('CODEX_HOME') and Path(os.environ['CODEX_HOME']).resolve() != (home / '.codex').resolve():
        raise RuntimeError('Unset custom CODEX_HOME before converging this machine')
    source = ROOT / 'home/.ai/settings'
    shared = json.loads((source / 'shared.json').read_text())
    overlay = json.loads((source / (machine + '.json')).read_text())
    check = bool(os.environ.get('CHECK'))
    # Codex null values are explicit removals, so keep them through the merge.
    codex = dict(shared['codex'], **overlay.get('codex', {}))
    claude = merge(shared['claude'], overlay.get('claude', {}), remove_null=False)
    drift = configure_codex(home, codex, check)
    drift += configure_claude(home, claude, check)
    return int(check and drift > 0)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (RuntimeError, OSError, ValueError) as error:
        raise SystemExit('agent-settings: ' + str(error))
