import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
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
  assert.match(client, /signIn\.social/);
  assert.match(client, /VITE_GOOGLE_AUTH_ENABLED/);
  assert.doesNotMatch(client, /temporary-session|TEMP_.*PASSCODE/);
});
test('public account access is participant-only and Google remains credential-gated', async () => {
  const entry = await readFile(new URL('../src/components/brand/RoleAccess.jsx', import.meta.url), 'utf8');
  const login = await readFile(new URL('../src/pages/LoginSelectPage.jsx', import.meta.url), 'utf8');
  const form = await readFile(new URL('../src/auth/client.jsx', import.meta.url), 'utf8');
  assert.match(entry, /Participant access/);
  assert.doesNotMatch(`${entry}\n${login}`, /Sign in as Admin|I’m an admin|admin-key|validateKey/);
  assert.doesNotMatch(form, /axiom-auth-create-callout/);
  assert.match(form, /provider: "google"/);
});
test('production API and socket rewrites target the active Render API', async () => {
  const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const rewrites = new Map(vercel.rewrites.map(({source, destination}) => [source, destination]));
  assert.equal(rewrites.get('/api/(.*)'), 'https://axiom26-aezg.onrender.com/api/$1');
  assert.equal(rewrites.get('/socket.io/(.*)'), 'https://axiom26-aezg.onrender.com/socket.io/$1');
});
test('Azure deploy workflows are removed and Render deploy waits for CI', async () => {
  const workflowDirectory = new URL('../.github/workflows/', import.meta.url);
  const files = await readdir(workflowDirectory);
  assert.equal(files.some(file => file.toLowerCase().includes('azure')), false,
    'Azure deployment workflow is still active.');
  const workflow = await readFile(new URL('../.github/workflows/render-deploy.yml', import.meta.url), 'utf8');
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /npm run test:browser/);
  assert.match(workflow, /RENDER_DEPLOY_HOOK_URL/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /inputs\.deploy == true/);
  assert.match(workflow, /branches: \[main\]/);
  assert.equal(config.build.outDir, 'dist', 'Frontend production artifacts must still use Vite dist output.');
});
