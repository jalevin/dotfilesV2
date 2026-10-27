import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync, appendFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture({ input = '', mode = '', local = ['local ssh\n', 'local hosts\n'], remote = { 'ssh-config': 'remote ssh\n', 'hosts-file': 'remote hosts\n' } } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'secrets-resolve-test-'));
  try {
    for (const file of ['secrets-common.sh', 'secrets-resolve.sh']) copyFileSync(resolve('tasks', file), join(dir, file));
    appendFileSync(join(dir, 'secrets-common.sh'), '\nsecrets_each_file() { "$@" ssh-config "$TEST_DIR/ssh"; "$@" hosts-file "$TEST_DIR/hosts"; }\n');
    for (const [index, name] of ['ssh', 'hosts'].entries()) if (local[index] !== null) writeFileSync(join(dir, name), local[index]);
    writeFileSync(join(dir, 'remote.json'), JSON.stringify(remote));
    writeFileSync(join(dir, 'op'), `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path');
const args = process.argv.slice(2), dir = process.env.TEST_DIR;
if (args[0] !== '--account' || args[1] !== 'JOYZ5VXNMRHF5J4K6LXZYA7AHM') process.exit(9);
args.splice(0, 2);
if (args[0] === 'whoami') process.exit(0);
fs.appendFileSync(path.join(dir, 'calls'), JSON.stringify(args) + '\\n');
const file = path.join(dir, 'remote.json'), docs = JSON.parse(fs.readFileSync(file));
if (args[1] === 'list') {
  const counter = path.join(dir, 'count');
  const count = fs.existsSync(counter) ? Number(fs.readFileSync(counter)) + 1 : 1;
  fs.writeFileSync(counter, String(count));
  if (count === 2 && process.env.TEST_MODE === 'remote-race') { docs['ssh-config'] = 'changed remotely'; fs.writeFileSync(file, JSON.stringify(docs)); }
  if (count === 2 && process.env.TEST_MODE === 'local-race') fs.writeFileSync(path.join(dir, 'ssh'), 'changed locally');
  console.log(JSON.stringify(Object.keys(docs).map(title => ({ title, id: title }))));
} else if (args[1] === 'get') {
  if (process.env.TEST_MODE === 'read-error') process.exit(1);
  process.stdout.write(docs[args[2]]);
} else if (args[1] === 'edit' || args[1] === 'create') {
  const create = args[1] === 'create';
  docs[create ? args[4] : args[2]] = fs.readFileSync(args[create ? 2 : 3], 'utf8');
  fs.writeFileSync(file, JSON.stringify(docs));
}
`, { mode: 0o755 });
    writeFileSync(join(dir, 'editor'), '#!/bin/bash\nprintf "merged contents\\n" > "$1"\n', { mode: 0o755 });
    const result = spawnSync('bash', [join(dir, 'secrets-resolve.sh')], { input, encoding: 'utf8',
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, TEST_DIR: dir, TEST_MODE: mode,
        VISUAL: join(dir, 'editor'), OP_ACCOUNT: 'grafana.1password.com' } });
    const calls = existsSync(join(dir, 'calls')) ? readFileSync(join(dir, 'calls'), 'utf8').trim().split('\n').map(JSON.parse) : [];
    const snapshot = result.stdout.match(/Edit (.+)\/merged;/)?.[1];
    if (snapshot) assert.equal(existsSync(snapshot), false, 'temporary copies must be removed');
    return { result, calls, remote: JSON.parse(readFileSync(join(dir, 'remote.json'))),
      local: ['ssh', 'hosts'].map(name => existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : null),
      mode: statSync(join(dir, 'hosts')).mode & 0o777 };
  } finally { rmSync(dir, { recursive: true }); }
}

test('resolve can push one file and pull another in one run', () => {
  const out = fixture({ input: 'p\nl\n' });
  assert.equal(out.result.status, 0, out.result.stderr);
  assert.equal(out.remote['ssh-config'], 'local ssh\n');
  assert.equal(out.local[1], 'remote hosts\n');
  assert.equal(out.mode, 0o600);
});
test('skip and quit leave both sides unchanged', () => {
  const out = fixture({ input: '\nq\n' });
  assert.equal(out.result.status, 0);
  assert.deepEqual(out.local, ['local ssh\n', 'local hosts\n']);
  assert.equal(out.calls.some(args => ['edit', 'create'].includes(args[1])), false);
});
test('confirmed merge updates both sides and removes temporary files', () => {
  const out = fixture({ input: 'e\ny\ns\n' });
  assert.equal(out.result.status, 0, out.result.stderr);
  assert.equal(out.remote['ssh-config'], 'merged contents\n');
  assert.equal(out.local[0], 'merged contents\n');
});
test('missing remote document can be explicitly created', () => {
  const out = fixture({ input: 'p\ns\n', remote: { 'hosts-file': 'remote hosts\n' } });
  assert.equal(out.result.status, 0, out.result.stderr);
  assert.equal(out.remote['ssh-config'], 'local ssh\n');
});
test('missing local file can be explicitly pulled', () => {
  const out = fixture({ input: 'l\ns\n', local: [null, 'local hosts\n'] });
  assert.equal(out.result.status, 0, out.result.stderr);
  assert.equal(out.local[0], 'remote ssh\n');
});
for (const mode of ['read-error', 'remote-race', 'local-race']) {
  test(`${mode} stops resolution without uploading`, () => {
    const out = fixture({ mode, input: 'p\ns\n' });
    assert.notEqual(out.result.status, 0);
    assert.equal(out.calls.some(args => ['edit', 'create'].includes(args[1])), false);
  });
}
test('SOPS key belongs only to the personal environment', () => {
  for (const env of ['grafana', '', 'personal', 'grafana,personal']) {
    const out = spawnSync('bash', ['-c', 'source "$1"; show() { echo "$1"; }; secrets_each_file show', 'test', resolve('tasks/secrets-common.sh')],
      { encoding: 'utf8', env: { ...process.env, MISE_ENV: env } });
    assert.equal(out.status, 0);
    assert.equal(out.stdout.includes('sops-age-key'), env.includes('personal'));
    assert.ok(out.stdout.includes('ssh-config') && out.stdout.includes('hosts-file'));
  }
});
