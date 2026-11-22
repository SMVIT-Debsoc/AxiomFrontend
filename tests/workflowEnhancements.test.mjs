import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';

const readSrc = (rel) => readFile(new URL(`../${rel}`, import.meta.url), 'utf8');
// The Live page is split into station files under src/pages/admin/live/.
const readTree = async (rel) => {
  const entries = await readdir(new URL(`../${rel}`, import.meta.url), {recursive: true});
  const files = entries.filter((f) => /\.jsx?$/.test(f)).sort();
  return (await Promise.all(files.map((f) => readSrc(`${rel}/${f}`)))).join('\n');
};

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

test('AllocateRoomsModal keeps timing defaults and permits debates shorter than 25 minutes', async () => {
  // Moved out of AdminRoundManagement (now a redirect into Live).
  const roundMgmt = await readSrc('src/pages/admin/live/modals/AllocateRoomsModal.jsx');
  assert.match(roundMgmt, /speakingTime:\s*7/);
  assert.match(roundMgmt, /bufferTime:\s*11/);
  assert.match(roundMgmt, /gap:\s*5/);
  assert.match(roundMgmt, /const debateDuration = speaking \* 2 \+ buffer;/);
  assert.doesNotMatch(roundMgmt, /minBufferNeeded|minimum enforced|Math\.max\(25/);
  assert.match(roundMgmt, /ax-room-selected/);
});

test('AdminLive and the Setup round dialog default check-in window to 20 minutes and expose preview pairings modal', async () => {
  const adminLive = (await readSrc('src/pages/admin/AdminLive.jsx')) + (await readTree('src/pages/admin/live'));
  // Create/Edit Round moved from AdminEventDetails into the shared Setup round dialogs.
  const adminEventDetails = await readSrc('src/pages/admin/setup/RoundModals.jsx');

  assert.match(adminLive, /Date\.now\(\)\s*\+\s*20\s*\*\s*60000/);
  assert.match(adminEventDetails, /Date\.now\(\)\s*\+\s*20\s*\*\s*60000/);
  assert.match(adminLive, /PairingPreviewModal/);
  assert.match(adminLive, /CheckInWindowStrip/);
  assert.match(adminLive, /inline-promotion-panel/);
});

test('AdminLayout has exactly five destinations while App preserves legacy routes', async () => {
  const layout = await readSrc('src/layouts/AdminLayout.jsx');
  const app = await readSrc('src/App.jsx');

  // One list drives both the desktop sidebar and the phone bottom bar.
  const navMatches = [...layout.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(navMatches, ['Live', 'Setup', 'People', 'Results', 'Display']);

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
