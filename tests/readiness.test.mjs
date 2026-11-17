import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {resolveConfig} from 'vite';
import {SITE_ORIGIN, ORGANISER_URL} from '../src/config/seo.js';

const config = await resolveConfig({logLevel:'silent'}, 'build', 'production');

async function transformPage(file) {
  const html = await readFile(new URL('../' + file, import.meta.url), 'utf8');
  const plugin = config.plugins.find(({name}) => name === 'public-page-html');
  return plugin.transformIndexHtml(html, {filename: file});
}

test('public HTML has discoverable content, distinct canonical metadata and absolute social images', async () => {
  for (const [file, path, expectedTitle] of [
    ['index.html', '/', 'AXIOM 4.0 Debate Tournament | SMVIT DebSoc'],
    ['about.html', '/about', 'About AXIOM 4.0 | Parliamentary Debate at Sir MVIT'],
  ]) {
    const {html, tags} = await transformPage(file);
    const meta = key => tags.find(({attrs}) => attrs.name === key || attrs.property === key)?.attrs.content;
    assert.equal(tags.find(({tag}) => tag === 'title').children, expectedTitle);
    assert.equal(tags.find(({attrs}) => attrs.rel === 'canonical').attrs.href, SITE_ORIGIN + path);
    assert.equal(meta('og:url'), SITE_ORIGIN + path);
    assert.match(meta('description'), /Sir MVIT in Bengaluru/);
    assert.equal(meta('robots'), undefined);
    for (const prefix of ['og', 'twitter']) {
      assert.equal(meta(prefix + ':title'), expectedTitle);
      assert.equal(meta(prefix + ':description'), meta('description'));
      assert.equal(meta(prefix + ':image'), SITE_ORIGIN + '/brand/social-card.png');
    }
    assert.match(html, /<h1>[^<]*AXIOM 4\.0/);
    assert.match(html, /<div id="root"><\/div>\s*<noscript>\s*<main class="public-page-summary">/);
    assert.match(html, /<script type="module" src="\/src\/main\.jsx"><\/script>/);
    assert.ok(html.includes(`href="${ORGANISER_URL}"`));
    if (path === '/') {
      assert.match(meta('description'), /collegiate debate tournament.*register as a debater/i);
      const website = JSON.parse(tags.find(({tag}) => tag === 'script').children);
      assert.equal(website.publisher.url, ORGANISER_URL);
    }
  }
});

test('sitemap contains only public canonical URLs and workspace HTML opts out of indexing', async () => {
  const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]),
    [SITE_ORIGIN + '/', SITE_ORIGIN + '/about']);
  const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8');
  assert.ok(robots.includes('Sitemap: ' + SITE_ORIGIN + '/sitemap.xml'));
  const {tags} = await transformPage('app.html');
  assert.ok(tags.some(({attrs}) => attrs.name === 'robots' && attrs.content === 'noindex'));
  assert.ok(!tags.some(({attrs}) => attrs.rel === 'canonical'));
});

test('only the homepage preloads the responsive hero and public HTML avoids an external font stylesheet', async () => {
  const {html, tags} = await transformPage('index.html');
  const hero = tags.find(({attrs}) => attrs.rel === 'preload' && attrs.as === 'image');
  assert.equal(hero.attrs.fetchpriority, 'high');
  assert.match(hero.attrs.imagesrcset, /shiva-music-sm\.webp 335w, .*shiva-music-lg\.webp 609w/);
  assert.match(hero.attrs.imagesizes, /145px/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|public-summary\.css/);
  const {tags: aboutTags} = await transformPage('about.html');
  assert.ok(!aboutTags.some(({attrs}) => attrs.rel === 'preload' && attrs.as === 'image'));
});

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
  assert.equal(rewrites.has('/(.*)'), false);
  assert.equal(rewrites.get('/:workspace(dashboard|admin|sign-in|sign-up)/:path*'), '/app');
  assert.equal(rewrites.get('/:entry(sso-callback|auth-redirect|complete-profile|login-select|forgot-password|reset-password|get-started)'), '/app');
  assert.equal(vercel.cleanUrls, true);
  assert.equal(vercel.redirects[0].destination, SITE_ORIGIN + '/:path*');
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
