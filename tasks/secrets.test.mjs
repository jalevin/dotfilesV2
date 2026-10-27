import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function run(mode) {
  const dir = mkdtempSync(join(tmpdir(), 'secrets-signin-'));
  try {
    writeFileSync(join(dir, 'op'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_LOG, JSON.stringify(args) + '\\n');
if (args.includes('signin')) {
  if (process.env.TEST_MODE === 'cancel') process.exit(1);
  fs.writeFileSync(process.env.TEST_STATE, 'authenticated');
  if (process.env.TEST_MODE === 'token') console.log('test-session-token');
} else if (args.includes('whoami')) {
  const authenticated = process.env.TEST_MODE === 'ready' ||
    (process.env.TEST_MODE !== 'unverified' && fs.existsSync(process.env.TEST_STATE));
  process.exit(authenticated ? 0 : 1);
}
`, { mode: 0o755 });
    const result = spawnSync('bash', ['-c', 'source "$1"; secrets_signin && secrets_op document list', 'test', resolve('tasks/secrets-common.sh')], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, OP_ACCOUNT: 'grafana.1password.com',
        TEST_MODE: mode, TEST_LOG: join(dir, 'log'), TEST_STATE: join(dir, 'state') },
    });
    const calls = readFileSync(join(dir, 'log'), 'utf8').trim().split('\n').map(JSON.parse);
    for (const args of calls) assert.deepEqual(args.slice(0, 2), ['--account', 'JOYZ5VXNMRHF5J4K6LXZYA7AHM']);
    assert.equal(result.stdout.includes('test-session-token'), false);
    return { result, calls };
  } finally {
    rmSync(dir, { recursive: true });
  }
}

test('authenticated accounts continue without signing in again', () => {
  const { result, calls } = run('ready');
  assert.equal(result.status, 0);
  assert.equal(calls.some(args => args.includes('signin')), false);
});
for (const mode of ['app', 'token']) {
  test(`automatic sign-in supports ${mode} authentication`, () => {
    const { result, calls } = run(mode);
    assert.equal(result.status, 0);
    assert.equal(calls.filter(args => args.includes('signin')).length, 1);
    const last = calls.at(-1);
    assert.ok(last.includes('document'));
    assert.equal(last.includes('--session'), mode === 'token');
  });
}
for (const mode of ['cancel', 'unverified']) {
  test(`${mode} sign-in prevents document operations`, () => {
    const { result, calls } = run(mode);
    assert.notEqual(result.status, 0);
    assert.equal(calls.some(args => args.includes('document')), false);
  });
}
