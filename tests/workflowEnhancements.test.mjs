import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const readSrc = (rel) => readFile(new URL(`../${rel}`, import.meta.url), 'utf8');

test('check-in mutation invalidates both check-in and rounds caches cleanly', async () => {
  const source = (await readSrc('src/services/api.js'))
    .replaceAll('import.meta.env', '({VITE_API_URL: "https://fixture.invalid/api/"})')
    .replace(
      /const isBrowser[\s\S]*?const DEFAULT_API_BASE_URL[^\n]*;/,
      'const isBrowser = true; const isLocalhost = false; const DEFAULT_API_BASE_URL = "https://fixture.invalid/api";'
    );
  const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

  let getCount = 0;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === 'PUT') {
      return new Response(JSON.stringify({success: true}), {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    getCount++;
    return new Response(JSON.stringify({success: true, round: {id: 'r1', fetchIndex: getCount}}), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    });
  };

  try {
    const first = await api.apiRequest('/rounds/r1', 'GET', null, 'tok');
    const cached = await api.apiRequest('/rounds/r1', 'GET', null, 'tok');
    assert.equal(first.round.fetchIndex, 1);
    assert.equal(cached.round.fetchIndex, 1);

    await api.apiRequest('/check-in/round/r1/user/u2', 'PUT', {status: 'PRESENT'}, 'tok');
    const afterCheckIn = await api.apiRequest('/rounds/r1', 'GET', null, 'tok');
    assert.equal(afterCheckIn.round.fetchIndex, 2);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('AllocateRoomsModal enforces 7m default speaker time, 11m buffer, 5m gap, and 25m minimum floor', async () => {
  const roundMgmt = await readSrc('src/pages/admin/AdminRoundManagement.jsx');
  assert.match(roundMgmt, /speakingTime:\s*7/);
  assert.match(roundMgmt, /bufferTime:\s*11/);
  assert.match(roundMgmt, /gap:\s*5/);
  assert.match(roundMgmt, /Math\.max\(25,\s*speaking\s*\*\s*2\s*\+\s*effectiveBuffer\)/);
  assert.match(roundMgmt, /ax-room-selected/);
});

test('AdminLive and AdminEventDetails default check-in window to 20 minutes and expose preview pairings modal', async () => {
  const adminLive = await readSrc('src/pages/admin/AdminLive.jsx');
  const adminEventDetails = await readSrc('src/pages/admin/AdminEventDetails.jsx');

  assert.match(adminLive, /Date\.now\(\)\s*\+\s*20\s*\*\s*60000/);
  assert.match(adminEventDetails, /Date\.now\(\)\s*\+\s*20\s*\*\s*60000/);
  assert.match(adminLive, /PairingPreviewModal/);
  assert.match(adminLive, /CheckInWindowStrip/);
  assert.match(adminLive, /inline-promotion-panel/);
});

test('AdminLayout reduces primary navigation to 4 cohesive items while App preserves legacy routes', async () => {
  const layout = await readSrc('src/layouts/AdminLayout.jsx');
  const app = await readSrc('src/App.jsx');

  const navMatches = [...layout.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(navMatches, [
    'Live Round',
    'Events & Rooms',
    'Participants',
    'Results & Standings',
    'Live',
    'Events',
    'People',
    'Results',
  ]);

  for (const legacyPath of ['rounds/:id/promotion', 'overview', 'rooms', 'leaderboard', 'participants', 'settings']) {
    assert.ok(app.includes(legacyPath), `Expected legacy route ${legacyPath} in App.jsx`);
  }
});

test('DashboardHome and GameOverCard show open/close times, inline results, and Instagram elimination view', async () => {
  const dashboard = await readSrc('src/pages/dashboard/DashboardHome.jsx');
  const gameOver = await readSrc('src/components/dashboard/GameOverCard.jsx');
  const css = await readSrc('src/index.css');

  assert.match(dashboard, /Opens/);
  assert.match(dashboard, /Closes/);
  assert.match(dashboard, /ResultsHubSection/);
  assert.match(dashboard, /inline-results-desktop/);
  assert.match(dashboard, /isEliminatedInEvent/);
  assert.ok(gameOver.includes('https://www.instagram.com/smvit_debsoc/'));
  assert.ok(css.includes('.ax-signal-win'));
  assert.ok(css.includes('.ax-signal-loss'));
  assert.ok(!css.includes('--axiom-status-danger: #B8D5C5'));
});
