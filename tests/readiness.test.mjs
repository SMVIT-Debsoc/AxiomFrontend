import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveConfig} from 'vite';

const config = await resolveConfig({logLevel:'silent'}, 'build', 'production');
test('production build must not select temporary authentication', () => {
  assert.equal(config.plugins.some(plugin => plugin.name.includes('temporary-auth')), false,
    'Temporary authentication server middleware must not be part of the production build.');
});
test('user-required Better Auth integration must exist in this checkout', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  assert.ok(pkg.dependencies?.['better-auth'], 'Better Auth client dependency is missing.');
  assert.equal(pkg.dependencies?.['@clerk/clerk-react'], undefined, 'Clerk client must not be shipped.');
  const client = await readFile(new URL('../src/auth/client.jsx', import.meta.url), 'utf8');
  assert.match(client, /createAuthClient/);
  assert.match(client, /better-auth\/react/);
  assert.match(client, /signUp\.email/);
  assert.match(client, /signIn\.email/);
  assert.doesNotMatch(client, /temporary-session|TEMP_.*PASSCODE/);
});
test('Azure static deployment output must match Vite build output', async () => {
  const yaml = await readFile(new URL('../.github/workflows/azure-static-web-apps-brave-coast-0915f1900.yml', import.meta.url), 'utf8');
  const output = yaml.match(/output_location:\s*["']?([^"'\s]+)/)?.[1];
  assert.equal(output, config.build.outDir, 'Azure workflow points at a different output directory from Vite.');
});
