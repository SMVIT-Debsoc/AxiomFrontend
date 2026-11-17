import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const readSrc = (rel) => readFile(new URL(`../${rel}`, import.meta.url), 'utf8');

test('App routes: five admin places, retired URLs redirect with query kept, deep links preserved', async () => {
  const app = await readSrc('src/App.jsx');
  for (const [from, to] of [
    ['overview', '/admin/setup'],
    ['events', '/admin/setup'],
    ['events/:id', '/admin/setup/:id'],
    ['rounds', '/admin/setup'],
    ['rooms', '/admin/setup?tab=rooms'],
    ['participants', '/admin/people?tab=registry'],
    ['leaderboard', '/admin/results?tab=standings'],
  ]) {
    assert.ok(app.includes(`path="${from}" element={<KeepQueryRedirect to="${to}" />}`), `${from} → ${to}`);
  }
  for (const keep of ['path="rounds/:id" element={<AdminRoundManagement />}', 'path="rounds/:id/promotion" element={<AdminPromotion />}', 'path="results/:id" element={<AdminResultSubmission />}']) {
    assert.ok(app.includes(keep), keep);
  }
  assert.match(app, /path="setup"/);
  assert.match(app, /path="people"/);
  assert.match(app, /path="results"/);
});

test('Display is guarded but outside the admin chrome; e-ballot is outside every guard', async () => {
  const app = await readSrc('src/App.jsx');
  const display = app.indexOf('path="/admin/display"');
  const layout = app.indexOf('<AdminLayout />');
  assert.ok(display > 0 && display < layout, 'display route is declared on its own, not inside AdminLayout');
  assert.match(app.slice(display, layout), /<AdminGuard>\s*<AdminEventProvider>\s*<AdminDisplay \/>/);
  const ballot = app.indexOf('path="/ballot/:token"');
  const workspace = app.indexOf('<WorkspaceProviders />');
  assert.ok(ballot > 0 && ballot < workspace, 'ballot route sits before the workspace/guarded routes');
  assert.doesNotMatch(app.slice(ballot, ballot + 120), /Guard/);
});

test('Command palette dispatches exactly the documented actions', async () => {
  const palette = await readSrc('src/components/ops/CommandPalette.jsx');
  for (const action of ['open-debate', 'open-room', 'find-debater', 'open-panel', 'set-station', 'publish-draw', 'publish-results']) {
    assert.ok(palette.includes(`"${action}"`), action);
  }
  for (const panel of ['draw', 'rooms', 'publish', 'motion', 'ballot-links', 'advance']) {
    assert.ok(palette.includes(`"${panel}"`), panel);
  }
  assert.match(palette, /"axiom:command"/);
  assert.match(palette, /"axiom:command-context"/);
  assert.match(palette, /role="dialog"/);
  assert.match(palette, /aria-activedescendant/);
});

test('Event context syncs ?event= and Edit Round sends advanceTarget only when changed', async () => {
  const provider = await readSrc('src/contexts/AdminEventProvider.jsx');
  assert.match(provider, /useSearchParams/);
  assert.match(provider, /replace: true/);
  assert.match(provider, /localStorage/);
  const modals = await readSrc('src/pages/admin/setup/RoundModals.jsx');
  assert.match(modals, /ROUND_EDIT_FIELDS = \[[^\]]*"advanceTarget"/);
  assert.match(modals, /changedFields\s*=\s*ROUND_EDIT_FIELDS\.filter/);
});

test('QR codes stay scannable: high error correction, carbon on white', async () => {
  const qr = await readSrc('src/components/ops/QrCode.jsx');
  assert.match(qr, /errorCorrectionLevel: "H"/);
  assert.match(qr, /dark: "#1D1E18", light: "#FFFFFF"/);
  assert.match(qr, /type: "svg"/);
});
