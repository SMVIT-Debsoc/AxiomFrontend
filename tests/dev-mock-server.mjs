// Local test server with NO real auth: serves a build of the app and answers /api/* and socket.io
// from the isolated fixtures in tests/profiles.mjs. For local testing only; never deploy this.
//   npm run dev:mock           -> http://localhost:5175
//   /__as/participant          -> complete participant, lands on /dashboard
//   /__as/new                  -> new participant, lands on /complete-profile
//   /__as/admin                -> organiser, lands on /admin
//   /__as/nonadmin             -> participant opening /admin (Access Denied)
//   /__as/signedout            -> signed out, lands on /
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PROFILES, buildData, matchRoute} from './profiles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 5175);
const origin = `http://localhost:${port}`;
const outDir = path.join(root, 'node_modules', '.dev-mock-dist');

if (!process.env.MOCK_SKIP_BUILD) {
  const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', outDir, '--emptyOutDir'], {
    cwd: root, stdio: 'inherit',
    env: {...process.env, VITE_API_URL: '/api', VITE_SOCKET_URL: origin, VITE_SOCKET_TRANSPORTS: 'polling', VITE_GOOGLE_AUTH_ENABLED: 'true'},
  });
  if (build.status !== 0) process.exit(build.status || 1);
}

const SHORTCUTS = {
  participant: ['completeParticipant', '/dashboard'],
  new: ['newParticipant', '/complete-profile'],
  admin: ['admin', '/admin'],
  nonadmin: ['nonAdminTriesAdmin', '/admin'],
  signedout: ['signedOut', '/'],
};

let store;
function load(name) {
  const base = PROFILES[name];
  const data = buildData();
  store = {
    name, admin: base.admin, signedIn: base.signedIn, enrolled: base.enrolled,
    autoEnrollOnComplete: Boolean(base.autoEnrollOnComplete),
    self: base.self ? {...base.self} : null,
    roster: data.roster, event: data.event, rounds: data.rounds, rooms: data.rooms,
    checkIns: data.checkIns, debates: data.debates, googleSignIns: [], socketOpened: false,
  };
}
load('completeParticipant');

const MIME = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff'};
const send = (res, status, type, body) => { res.writeHead(status, {'content-type': type, 'cache-control': 'no-store'}); res.end(body); };

http.createServer((req, res) => {
  const url = new URL(req.url, origin);
  const shortcut = /^\/__as\/([a-z]+)$/.exec(url.pathname);
  if (shortcut) {
    const entry = SHORTCUTS[shortcut[1]];
    if (!entry) return send(res, 404, 'text/plain', `Unknown profile. Use: ${Object.keys(SHORTCUTS).join(', ')}`);
    load(entry[0]);
    res.writeHead(302, {location: entry[1]});
    return res.end();
  }
  if (url.pathname.startsWith('/_vercel/')) return send(res, 204, 'text/plain', '');
  if (url.pathname.startsWith('/socket.io')) {
    if (req.method === 'POST') return send(res, 200, 'text/plain', 'ok');
    if (!url.searchParams.get('sid')) return send(res, 200, 'text/plain', `0${JSON.stringify({sid: 'mock', upgrades: [], pingInterval: 25000, pingTimeout: 20000, maxPayloadSize: 1000000})}`);
    if (!store.socketOpened) { store.socketOpened = true; return send(res, 200, 'text/plain', '40{"sid":"mock"}'); }
    return setTimeout(() => send(res, 200, 'text/plain', '6'), 1000);
  }
  if (url.pathname.startsWith('/api/')) {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
      const p = url.pathname.slice(4);
      const matched = matchRoute(req.method, p);
      if (!matched) return send(res, 404, 'application/json', JSON.stringify({error: `Unmocked: ${req.method} ${p}`}));
      const [status, payload] = matched.handler(store, matched.params, body);
      send(res, status, 'application/json', JSON.stringify(payload));
    });
    return;
  }
  let file = path.join(outDir, decodeURIComponent(url.pathname));
  if (!file.startsWith(outDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(outDir, 'index.html');
  send(res, 200, MIME[path.extname(file)] || 'application/octet-stream', fs.readFileSync(file));
}).listen(port, () => {
  console.log(`\nMock server (no real auth) on ${origin}\n`);
  for (const [key, [, target]] of Object.entries(SHORTCUTS)) console.log(`  ${origin}/__as/${key.padEnd(11)} -> ${target}`);
  console.log('');
});
