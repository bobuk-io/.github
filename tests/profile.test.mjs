import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, cpSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildProfile, publicRepositories } from '../scripts/profile.mjs';

const catalog = JSON.parse(readFileSync(new URL('../design/catalog.json', import.meta.url)));
const repo = (name, overrides = {}) => ({ name, full_name: `bobuk-io/${name}`, owner: { login: 'bobuk-io' }, private: false, visibility: 'public', archived: false, ...overrides });

test('requires explicit public visibility, ownership and matching full name', () => {
  assert.deepEqual(publicRepositories([
    repo('visible'), repo('private', { private: true }), repo('internal', { visibility: 'internal' }),
    repo('unknown', { visibility: undefined }), repo('unknown2', { private: undefined }),
    repo('foreign', { owner: { login: 'someone-else' } }), repo('mismatch', { full_name: 'else/mismatch' }),
    repo('bad/name'), null,
  ]).map(item => item.name), ['visible']);
  assert.throws(() => publicRepositories({}));
});

test('only public apps, infrastructure and corresponding assets appear', () => {
  const { readme, assets } = buildProfile([
    repo('ting'), repo('splash-finish', { private: true, visibility: 'private' }),
    repo('HAScS', { visibility: 'internal' }), repo('lowkey', { private: true }),
    repo('homebrew-tap'), repo('BobukKit', { private: true }),
    repo('secret-project', { private: true, visibility: 'private', description: 'secret description' }),
  ], catalog);
  assert.match(readme, /Your next app/);
  assert.match(readme, /brew install --cask bobuk-io\/tap\/ting/);
  assert.deepEqual(assets, ['banner-light.svg', 'banner-dark.svg', 'ting-icon.png']);
  for (const forbidden of ['Splash Finish', 'splash-finish', 'HAScS', 'hascs', 'Lowkey', 'lowkey', 'BobukKit', 'secret-project', 'secret description']) {
    assert.ok(!readme.includes(forbidden), forbidden);
  }
});

test('private tap removes brew commands and tap links, keeps public apps', () => {
  const { readme } = buildProfile([repo('ting'), repo('homebrew-tap', { private: true })], catalog);
  assert.ok(!readme.includes('brew install'));
  assert.ok(!readme.includes('homebrew-tap'));
  assert.match(readme, /https:\/\/bobuk.io\/apps\/ting\//);
});

test('unknown public repositories appear, metadata is escaped, .github is omitted', () => {
  const { readme } = buildProfile([
    repo('new-public', { description: '<script>alert("x")</script>' }), repo('.github'),
  ], catalog);
  assert.match(readme, /More public repositories/);
  assert.match(readme, /new-public/);
  assert.match(readme, /&lt;script&gt;/);
  assert.ok(!readme.includes('<script>'));
  assert.ok(!readme.includes('https://github.com/bobuk-io/.github'));
});

test('source preview links to source instructions, not an unpublished site page', () => {
  const { readme } = buildProfile([repo('lowkey')], catalog);
  assert.match(readme, /source preview/);
  assert.match(readme, /https:\/\/github.com\/bobuk-io\/lowkey#install-from-source/);
  assert.match(readme, /No binary release yet/);
  assert.ok(!readme.includes('https://bobuk.io/apps/lowkey/'));
});

test('empty inventory has no app or repo links; canonical site always remains', () => {
  const { readme, assets } = buildProfile([], catalog);
  assert.ok(!readme.includes('### Apps'));
  assert.ok(!readme.includes('https://github.com/bobuk-io/'));
  assert.match(readme, /https:\/\/bobuk.io\//);
  assert.deepEqual(assets, ['banner-light.svg', 'banner-dark.svg']);
});

test('archived apps no longer have installation promotions', () => {
  const { readme, assets } = buildProfile([repo('ting', { archived: true })], catalog);
  assert.ok(!readme.includes('brew install'));
  assert.match(readme, /ting<\/a> \(archived\)/);
  assert.ok(!assets.includes('ting-icon.png'));
});

test('prepare checks freshness, prunes stale assets and preserves files on API failure', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'org-profile-'));
  try {
    const root = fileURLToPath(new URL('../', import.meta.url));
    for (const dir of ['scripts', 'design']) cpSync(join(root, dir), join(tmp, dir), { recursive: true });
    const bin = join(tmp, 'gh');
    writeFileSync(bin, '#!/usr/bin/env node\nif(process.env.MOCK_FAIL)process.exit(1);console.log(JSON.stringify([JSON.parse(process.env.MOCK_REPOS)]));', { mode: 0o755 });
    const env = { ...process.env, PATH: `${tmp}:${process.env.PATH}`, MOCK_REPOS: JSON.stringify([repo('ting')]) };
    const run = (...args) => spawnSync(process.execPath, ['scripts/prepare.mjs', ...args], { cwd: tmp, env, encoding: 'utf8' });
    assert.equal(run().status, 0);
    const icon = join(tmp, 'profile/assets/ting-icon.png');
    assert.ok(existsSync(icon));
    assert.equal(run('--check').status, 0);
    env.MOCK_REPOS = JSON.stringify([repo('ting', { private: true, visibility: 'private' })]);
    assert.equal(run('--check').status, 1);
    assert.ok(existsSync(icon), 'check never writes');
    assert.equal(run().status, 0);
    assert.ok(!existsSync(icon), 'obsolete app icon removed');
    const before = readFileSync(join(tmp, 'profile/README.md'), 'utf8');
    env.MOCK_FAIL = '1';
    assert.notEqual(run().status, 0);
    assert.equal(readFileSync(join(tmp, 'profile/README.md'), 'utf8'), before);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
