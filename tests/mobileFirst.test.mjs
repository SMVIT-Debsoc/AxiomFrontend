import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const readSrc = (rel) => readFile(new URL(`../${rel}`, import.meta.url), 'utf8');

test('iosViewportFix updates --vh and --app-dvh passively without swallowing rapid taps or forcing +1px overflow', async () => {
  const iosFix = await readSrc('src/utils/iosViewportFix.js');
  assert.match(iosFix, /--vh/);
  assert.match(iosFix, /--app-dvh/);
  assert.match(iosFix, /visualViewport/);
  assert.doesNotMatch(iosFix, /preventDefault\(\)/, 'Must not block rapid <300ms touch taps via touchend preventDefault');
  assert.doesNotMatch(iosFix, /innerHeight\s*\+\s*1/, 'Must not force +1px root overflow on fixed dvh layouts');
});

test('index.css enforces mobile overflow-x clip, dvh root, single-column mobile footer, and bottom-sheet dialog ergonomics', async () => {
  const css = await readSrc('src/index.css');
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /min-height:\s*100dvh/);
  assert.match(css, /\.axiom-footer-top\s*\{\s*grid-template-columns:\s*1fr;/);
  assert.match(css, /\.axiom-dialog:not\(\.axiom-dialog--drawer\)\s*\{\s*align-items:\s*flex-end;/);
});

test('public pages and Google auth variants use fluid mobile typography and full-width mobile CTAs', async () => {
  const landing = await readSrc('src/pages/LandingPage.jsx');
  const client = await readSrc('src/auth/client.jsx');
  const discourse = await readSrc('src/components/brand/DiscourseSections.jsx');

  assert.match(landing, /text-\[clamp\(3\.25rem,14vw,4\.5rem\)\]/);
  assert.match(landing, /pb-\[calc\(1rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(client, /min-h-\[60px\]\s+sm:h-\[68px\]/);
  assert.match(client, /wrap:\s*"w-full md:w-auto"/);
  assert.match(discourse, /w-full sm:w-auto justify-center/);
});

test('participant workspace and profile forms enforce dvh containers, 16px mobile input font floor, and 44px touch targets', async () => {
  const layout = await readSrc('src/layouts/DashboardLayout.jsx');
  const profile = await readSrc('src/pages/dashboard/Profile.jsx');
  const completeProfile = await readSrc('src/pages/dashboard/CompleteProfile.jsx');
  const dashboardHome = await readSrc('src/pages/dashboard/DashboardHome.jsx');

  assert.match(layout, /h-dvh/);
  assert.match(layout, /pb-\[calc\(5\.75rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(profile, /min-h-11 bg-background border border-border rounded-lg px-3\.5 py-2\.5 text-base sm:text-sm/);
  assert.match(profile, /lg:hidden rounded-xl border border-border bg-card p-4/);
  assert.match(completeProfile, /pb-\[calc\(1\.25rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(dashboardHome, /w-full sm:w-auto min-h-11 px-5 rounded-xl bg-primary/);
});

test('organiser console provides dedicated mobile card layouts alongside desktop tables and 44px touch targets', async () => {
  const adminLayout = await readSrc('src/layouts/AdminLayout.jsx');
  const adminLive = await readSrc('src/pages/admin/AdminLive.jsx');
  const adminParticipants = await readSrc('src/pages/admin/AdminParticipants.jsx');
  const adminLeaderboard = await readSrc('src/pages/admin/AdminLeaderboard.jsx');
  const adminPromotion = await readSrc('src/pages/admin/AdminPromotion.jsx');
  const adminEventDetails = await readSrc('src/pages/admin/AdminEventDetails.jsx');
  const inlineSheet = await readSrc('src/components/admin/InlineResultSheet.jsx');

  assert.match(adminLayout, /pb-\[calc\(10\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(adminLive, /grid grid-cols-2 sm:flex sm:flex-wrap w-full sm:w-auto items-center gap-1\.5/);
  assert.match(adminLive, /ul className="m-0 flex list-none flex-col gap-2 p-0 max-h-\[460px\] overflow-y-auto md:hidden"/);
  assert.match(adminParticipants, /div className="md:hidden space-y-3"/);
  assert.match(adminLeaderboard, /aria-label="Mobile tournament standings"/);
  assert.match(adminPromotion, /div className="md:hidden divide-y divide-border"/);
  assert.match(adminEventDetails, /div className="md:hidden space-y-2\.5"/);
  assert.match(inlineSheet, /items-end sm:items-center/);
  assert.match(inlineSheet, /h-11 w-11/);
});
