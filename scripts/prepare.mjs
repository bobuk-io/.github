import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { buildProfile, ORG } from './profile.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/prepare.mjs [--check]');
const check = args.includes('--check');

// The endpoint asks only for public repositories, even with an owner token.
// --slurp preserves pagination boundaries. No raw API response is saved to disk.
const pages = JSON.parse(execFileSync('gh', [
  'api', '--paginate', '--slurp', `orgs/${ORG}/repos?type=public&per_page=100`,
], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
if (!Array.isArray(pages) || !pages.length || pages.some(page => !Array.isArray(page))) {
  throw new Error('Unexpected GitHub response; profile was not changed');
}
const catalog = JSON.parse(readFileSync(resolve(root, 'design/catalog.json'), 'utf8'));
const profile = buildProfile(pages.flat(), catalog);
const expected = new Map([['README.md', Buffer.from(profile.readme)]]);
for (const asset of profile.assets) {
  expected.set(`assets/${asset}`, readFileSync(resolve(root, 'design/assets', asset)));
}
const output = resolve(root, 'profile');
const existing = existsSync(output) ? readdirSync(output, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => resolve(entry.parentPath ?? entry.path, entry.name).slice(output.length + 1)) : [];
const changes = [...expected].filter(([path, data]) => {
  const target = resolve(output, path);
  return !existsSync(target) || !readFileSync(target).equals(data);
}).map(([path]) => path);
const obsolete = existing.filter(path => !expected.has(path));
if (check && (changes.length || obsolete.length)) {
  console.error('Profile is stale. Run npm run prepare:profile and review the diff.');
  process.exitCode = 1;
} else if (!check) {
  mkdirSync(resolve(output, 'assets'), { recursive: true });
  for (const [path, data] of expected) writeFileSync(resolve(output, path), data);
  for (const path of obsolete) rmSync(resolve(output, path));
  console.log(`Prepared public-only profile (${profile.assets.length - 2} apps). Removed ${obsolete.length} obsolete files.`);
} else {
  console.log('Profile matches current public repositories.');
}
