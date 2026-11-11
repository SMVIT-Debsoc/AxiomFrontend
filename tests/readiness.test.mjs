import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {resolveConfig} from 'vite';

const config = await resolveConfig({logLevel:'silent'}, 'build', 'production');
test('production build must not select temporary authentication', () => {
  assert.equal(config.plugins.some(plugin => plugin.name.includes('temporary-auth')), false,
    'Temporary authentication server middleware must not be part of the production build.');
});
test('user-required Clerk integration must exist in this checkout', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  assert.ok(pkg.dependencies?.['@clerk/clerk-react'], 'Clerk client dependency is missing.');
  assert.equal(pkg.dependencies?.['better-auth'], undefined, 'Better Auth client must not be shipped.');
  const client = await readFile(new URL('../src/auth/client.jsx', import.meta.url), 'utf8');
  assert.match(client, /@clerk\/clerk-react/);
  assert.match(client, /ClerkProvider/);
  assert.match(client, /strategy: "oauth_google"/);
  assert.match(client, /clerkPublishableKey/);
  assert.doesNotMatch(client, /temporary-session|TEMP_.*PASSCODE/);
});
test('public account access is participant-only and Google remains credential-gated', async () => {
  const landing = await readFile(new URL('../src/pages/LandingPage.jsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/auth/client.jsx', import.meta.url), 'utf8');
  assert.match(landing, /GoogleAuthButton/);
  assert.doesNotMatch(landing, /Sign in as Admin|admin-key|validateKey/);
  assert.match(client, /strategy: "oauth_google"/);
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
