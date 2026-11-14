import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

// Isolated UI fixtures only. Never use these sessions as real-authentication evidence.
// All business API/socket traffic is intercepted; no production records are changed.
const origin = 'http://127.0.0.1:5175';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5175', '--strictPort'], {
  env: {
    ...process.env,
    VITE_AUTH_MOCK: 'true',
    VITE_API_URL: '/api',
    VITE_SOCKET_URL: 'http://127.0.0.1:5175',
    VITE_GOOGLE_AUTH_ENABLED: 'true'
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', data => {serverLog += data;});
server.stderr.on('data', data => {serverLog += data;});
const artifacts = new URL('../audit-artifacts/', import.meta.url);
await mkdir(artifacts, {recursive: true});
let browser;
const results = [];
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForServer() {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (server.exitCode !== null) throw new Error(`Audit server stopped: ${serverLog.slice(-600)}`);
    try {
      const response = await fetch(origin, {signal: AbortSignal.timeout(500)});
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Audit server did not start: ${serverLog.slice(-1200)}`);
}

async function fixture(page, {
  signedIn = false,
  admin = false,
  complete = true,
  profileError = false,
  enrolled = false,
  enrollError = false,
  enrollFalse = false,
  checkedIn = false,
  checkInError = false,
  window = 'open',
  published = false,
  resultsPublished = false,
  assigned = false,
  autoEnrollOnProfileComplete = false,
  whatsappLink = null,
  createEventError = false
} = {}) {
  const now = Date.now();
  const user = {
    id: 'u1',
    firstName: 'Audit',
    lastName: 'Participant',
    email: 'audit@example.invalid',
    college: complete ? 'Test College' : '',
    mobile: complete ? '9999999999' : '',
    usn: complete ? '1MS21CS001' : ''
  };

  const round = {
    id: 'r1',
    eventId: 'e1',
    name: 'Audit Round',
    roundNumber: 1,
    status: 'ONGOING',
    pairingsPublished: published,
    resultsPublished,
    checkInStartTime: new Date(now + (window === 'future' ? 5000 : -60000)).toISOString(),
    checkInEndTime: new Date(now + (window === 'closed' ? -1000 : 60000)).toISOString()
  };

  const event = {
    id: 'e1',
    name: 'Audit Tournament',
    description: 'Isolated fixture',
    status: 'ONGOING',
    startDate: new Date(now).toISOString(),
    endDate: new Date(now + 86400000).toISOString(),
    whatsappLink,
    rounds: [round],
    _count: {participants: 0, rounds: 1}
  };

  const debate = {
    id: 'd1',
    roundId: 'r1',
    eventId: 'e1',
    debater1Id: 'u1',
    debater2Id: 'u2',
    debater1: user,
    debater2: {id: 'u2', firstName: 'Audit', lastName: 'Opponent'},
    room: {id: 'room1', name: 'Audit Hall'},
    judgeName: 'Audit Judge',
    status: 'COMPLETED',
    winnerId: 'u1',
    debater1Score: 80,
    debater2Score: 75,
    isPromoted: true,
    resultsPublished
  };

  round.debates = assigned ? [debate] : [];

  const state = {
    user,
    round,
    event,
    debate,
    enrolled,
    checkedIn,
    signedIn,
    autoEnrollOnProfileComplete,
    requests: [],
    events: [event]
  };

  await page.addInitScript(({signedIn, user, admin}) => {
    const initial = {
      signedIn,
      user: signedIn ? user : null,
      admin
    };
    window.__FIXTURE_AUTH__ = initial;
    try {
      if (sessionStorage.getItem('__fixture_auth__') === null) {
        sessionStorage.setItem('__fixture_auth__', JSON.stringify(initial));
      }
    } catch {}
  }, {
    signedIn,
    user: {
      id: 'u1',
      fullName: 'Audit Participant',
      firstName: 'Audit',
      lastName: 'Participant',
      primaryEmailAddress: {emailAddress: 'audit@example.invalid'}
    },
    admin
  });

  await page.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.startsWith('/socket.io')) return route.fulfill({status: 503, body: 'Fixture socket unavailable'});
    if (url.pathname.startsWith('/api/')) {
      const path = url.pathname.slice(4);
      const method = req.method();
      state.requests.push({path, method, body: req.postData()});
      const reply = (data, status = 200) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(data)});
      const headerAdminKey = req.headers()['x-admin-secret-key'];
      const isSecretKeyAdmin = headerAdminKey === 'fixture-admin-key';

      if (path === '/admin/validate-key' && method === 'POST') {
        const body = req.postDataJSON() || {};
        if (body.secretKey === 'fixture-admin-key') return reply({success: true, valid: true});
        return reply({success: false, valid: false, error: 'Invalid Admin Secret Key'}, 403);
      }
      if (path === '/admin/me') return reply((admin || isSecretKeyAdmin) ? {success: true, admin: {id: 'a1'}} : {error: 'Forbidden'}, (admin || isSecretKeyAdmin) ? 200 : 403);
      if (path === '/admin/onboard' && method === 'POST') {
        const body = req.postDataJSON() || {};
        if (body.secretKey) return reply({success: true, admin: {id: 'a1'}});
        return reply({success: false, error: 'Invalid secret key'}, 400);
      }
      if (path === '/rounds/event/e1') return reply({success: true, rounds: [state.round]});
      if (path === '/rooms') return reply({success: true, rooms: []});
      if (path === '/admin/rounds/r1/performers') return reply({success: true, performers: [], resultsPublished});
      if (path === '/users/me') {
        if (profileError) return reply({success: false, error: 'Failed to fetch user details'}, 500);
        return reply({success: true, user: state.user});
      }
      if (path === '/users/profile' && method === 'PUT') {
        Object.assign(state.user, req.postDataJSON());
        const autoEnrollment = state.autoEnrollOnProfileComplete ? {id: 'e1', name: state.event.name} : null;
        if (autoEnrollment) state.enrolled = true;
        return reply({success: true, user: state.user, autoEnrollment});
      }
      if (path === '/events' && method === 'POST') {
        if (createEventError) return reply({success: false, error: 'Invalid Admin Secret Key'}, 403);
        const data = req.postDataJSON();
        state.events.push({...data, id: 'e2', status: 'UPCOMING', rounds: []});
        return reply({success: true, event: state.events.at(-1)});
      }
      if (path === '/events' && method === 'GET') return reply({success: true, events: state.events});
      if (path === '/events/e1/enrollment-status') return reply({success: true, isEnrolled: state.enrolled});
      if (path === '/events/e1/enroll') {
        if (enrollError) return reply({error: 'Enrollment denied'}, 403);
        if (enrollFalse) return reply({success: false, error: 'Enrollment denied'});
        state.enrolled = true;
        return reply({success: true});
      }
      if (path === '/events/e1/participants') return reply({success: true, participants: state.enrolled ? [state.user] : []});
      if (path === '/events/e1' && method === 'PUT') {
        Object.assign(state.event, req.postDataJSON());
        return reply({success: true, event: state.event});
      }
      if (path === '/events/e1' && method === 'DELETE') {
        state.events = [];
        return reply({success: true});
      }
      if (path === '/events/e1') return reply({success: true, event: state.event});
      if (path === '/rounds/r1') return reply({success: true, round: state.round});
      if (path === '/check-in/round/r1/me') return reply({success: true, isCheckedIn: state.checkedIn});
      if (path === '/check-in') {
        if (checkInError) return reply({error: 'Check-in denied'}, 403);
        state.checkedIn = true;
        return reply({success: true});
      }
      if (path === '/debates/d1/result' && method === 'POST') {
        const body = req.postDataJSON() || {};
        Object.assign(state.debate, {
          debater1Score: body.debater1Score,
          debater2Score: body.debater2Score,
          winnerId: body.winnerId,
          status: 'COMPLETED'
        });
        return reply({success: true, debate: state.debate});
      }
      if (path === '/debates/my-debates' || path === '/debates/round/r1') return reply({success: true, debates: assigned ? [state.debate] : []});
      if (path === '/stats/leaderboard') return reply({success: true, leaderboard: []});
      if (path === '/stats/my-stats') return reply({success: true, stats: {totalDebates: 0, wins: 0, losses: 0}});
      return reply({error: `Unimplemented fixture: ${method} ${path}`}, 404);
    }
    if (url.origin !== origin) return route.abort();
    return route.continue();
  });

  return state;
}

async function run(name, setup, scenario, kind = 'UI fixture') {
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, timezoneId: 'Asia/Kolkata'});
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    const state = await fixture(page, setup);
    await scenario(page, state);
    assert.deepEqual(errors, [], 'Uncaught browser errors');
    results.push({name, kind, status: 'PASS'});
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({name, kind, status: 'FAIL', evidence: error.message.slice(0, 900)});
    await page.screenshot({path: new URL(`${results.length}-failure.png`, artifacts).pathname, fullPage: true}).catch(() => {});
    console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`);
  } finally {
    await context.close();
  }
}

const visible = async (page, text) => {
  await page.getByText(text, {exact: true}).first().waitFor({state: 'visible'});
};

try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    ...(process.env.AUDIT_BROWSER_EXECUTABLE ? {executablePath: process.env.AUDIT_BROWSER_EXECUTABLE} : {})
  });

  await run('public entry offers participant sign-in with Google and AXIOM experience', {}, async page => {
    await page.goto(origin + '/');
    await page.waitForURL(origin + '/');
    await page.getByRole('button', {name: /Register with Google|Sign in/}).first().waitFor({state: 'visible'});
    await page.locator('#how-title').waitFor({state: 'visible'});
    await page.locator('#faq-title').waitFor({state: 'visible'});
    await page.locator('#cta-title').waitFor({state: 'visible'});
    await page.getByRole('button', {name: /Admin Portal|Admin/}).first().waitFor({state: 'visible'});
    assert.equal(await page.getByLabel('Admin Secret Key', {exact: true}).count(), 0, 'Admin secret key is exposed before opening portal modal');
  }, 'Public UI');

  for (const path of ['/dashboard', '/dashboard/events', '/dashboard/events/e1', '/dashboard/events/e1/rounds/r1', '/complete-profile', '/admin', '/admin/events']) {
    await run(`signed-out access to ${path} is blocked`, {}, async page => {
      await page.goto(origin + path);
      await page.waitForURL(origin + '/');
    }, 'Anonymous route guard fixture');
  }

  for (const path of ['/login-select', '/get-started', '/sign-in', '/sign-up', '/forgot-password', '/reset-password']) {
    await run(`legacy route ${path} redirects to landing page`, {}, async page => {
      await page.goto(origin + path);
      await page.waitForURL(origin + '/');
    }, 'Legacy route redirect');
  }

  await run('Admin Portal trigger opens modal with Admin Secret Key field', {}, async page => {
    await page.goto(origin + '/');
    await page.getByRole('button', {name: 'Admin Portal', exact: true}).click();
    await page.getByRole('dialog').waitFor({state: 'visible'});
    await page.getByLabel('Admin Secret Key', {exact: true}).waitFor({state: 'visible'});
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
  });

  await run('admin flow with valid key directs to /admin', {signedIn: true, admin: true}, async page => {
    await page.goto(origin + '/');
    await page.evaluate(() => {
      sessionStorage.setItem('adminAuthFlow', 'true');
      sessionStorage.setItem('adminSecretKey', 'fixture-admin-key');
    });
    await page.goto(origin + '/auth-redirect');
    await page.waitForURL('**/admin');
  });

  await run('secret key alone unlocks /admin without Google sign-in', {signedIn: false, admin: false}, async page => {
    await page.goto(origin + '/');
    await page.getByRole('button', {name: 'Admin Portal', exact: true}).click();
    await page.getByRole('dialog').waitFor({state: 'visible'});
    await page.getByLabel('Admin Secret Key', {exact: true}).fill('wrong-key');
    await page.getByRole('button', {name: 'Enter Admin Console', exact: true}).click();
    await visible(page, 'Invalid Admin Secret Key');
    await page.getByLabel('Admin Secret Key', {exact: true}).fill('fixture-admin-key');
    await page.getByRole('button', {name: 'Enter Admin Console', exact: true}).click();
    await page.waitForURL('**/admin');
    await visible(page, 'Exit Admin');
  });

  await run('admin-connected whatsapp link displays first-login modal and main dashboard banner', {
    signedIn: true,
    whatsappLink: 'https://chat.whatsapp.com/AuditGroup123'
  }, async page => {
    await page.goto(origin + '/dashboard');
    await page.getByRole('dialog').waitFor({state: 'visible'});
    const modalJoin = page.getByRole('dialog').getByRole('link', {name: /Join WhatsApp Community/});
    assert.equal(await modalJoin.getAttribute('href'), 'https://chat.whatsapp.com/AuditGroup123');
    await page.getByRole('button', {name: /Continue to Dashboard/}).click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    const bannerJoin = page.getByRole('region', {name: 'Official WhatsApp Community'}).getByRole('link', {name: /Join Official WhatsApp Group/});
    await bannerJoin.waitFor({state: 'visible'});
    assert.equal(await bannerJoin.getAttribute('href'), 'https://chat.whatsapp.com/AuditGroup123');
  });

  await run('clicking Sign in on landing page when session already exists redirects to workspace', {signedIn: true}, async page => {
    await page.goto(origin + '/');
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
    await page.waitForURL('**/dashboard');
    assert.equal(await page.getByRole('alert').count(), 0);
  });

  await run('incomplete profile directs participant to /complete-profile', {signedIn: true, complete: false}, async page => {
    await page.goto(origin + '/auth-redirect');
    await page.waitForURL('**/complete-profile');
    await page.getByRole('heading', {name: /Almost in, Audit/}).waitFor({state: 'visible'});
  });

  await run('profile completion auto-enrolls into tournament', {signedIn: true, complete: false, autoEnrollOnProfileComplete: true}, async (page, state) => {
    await page.goto(origin + '/complete-profile');
    await page.getByRole('heading', {name: /Almost in, Audit/}).waitFor({state: 'visible'});
    await page.getByLabel('College').fill('Test College');
    await page.getByLabel('Mobile number').fill('9999999999');
    await page.getByLabel('USN / student ID').fill('1MS21CS001');
    await page.getByRole('button', {name: 'Finish registration'}).first().click();
    await page.getByRole('heading', {name: /You're in, Audit/}).waitFor({state: 'visible'});
    await page.getByRole('link', {name: 'View Audit Tournament'}).click();
    await page.waitForURL('**/dashboard/events/e1');
    await visible(page, 'Enrolled');
    assert.equal(state.enrolled, true);
  });

  await run('profile sync failure displays recovery card with retry button', {signedIn: true, profileError: true}, async page => {
    await page.goto(origin + '/complete-profile');
    await visible(page, 'Account setup is unavailable');
    await visible(page, 'Failed to fetch user details');
    await page.getByRole('button', {name: 'Retry'}).waitFor({state: 'visible'});
  });

  await run('explicit event enrollment persists across reload', {signedIn: true}, async (page, state) => {
    await page.goto(origin + '/dashboard/events/e1');
    await page.getByRole('button', {name: 'Enroll Now'}).click();
    await visible(page, 'Enrolled Successfully!');
    assert.ok(state.enrolled);
    await page.reload();
    await visible(page, 'Enrolled');
    assert.equal(await page.getByRole('button', {name: 'Enroll Now'}).count(), 0);
  });

  await run('HTTP-denied enrollment displays error and keeps enroll action', {signedIn: true, enrollError: true}, async page => {
    await page.goto(origin + '/dashboard/events/e1');
    await page.getByRole('button', {name: 'Enroll Now'}).click();
    await visible(page, 'Enrollment Failed');
    assert.equal(await page.getByText('Enrolled Successfully!', {exact: true}).count(), 0);
    await page.getByRole('button', {name: 'Enroll Now'}).waitFor();
  });

  await run('business-rejected enrollment must not show success', {signedIn: true, enrollFalse: true}, async (page, state) => {
    await page.goto(origin + '/dashboard/events/e1');
    await page.getByRole('button', {name: 'Enroll Now'}).click();
    await page.waitForFunction(() => /Enrollment Failed|Enrolled Successfully!/.test(document.body.innerText));
    assert.equal(await page.getByText('Enrolled Successfully!', {exact: true}).count(), 0, 'success:false was rendered as a successful enrollment');
    assert.equal(state.enrolled, false);
  });

  await run('open round check-in persists across reload', {signedIn: true, enrolled: true}, async (page, state) => {
    await page.goto(origin + '/dashboard/events/e1/rounds/r1');
    await page.getByRole('button', {name: 'Check In Now'}).click();
    await visible(page, "You're Checked In");
    assert.ok(state.checkedIn);
    await page.reload();
    await visible(page, "You're Checked In");
  });

  await run('closed round window prevents check-in', {signedIn: true, window: 'closed'}, async page => {
    await page.goto(origin + '/dashboard/events/e1/rounds/r1');
    await visible(page, 'Check-in Not Available');
    assert.equal(await page.getByRole('button', {name: 'Check In Now'}).count(), 0);
  });

  await run('denied round check-in does not display presence', {signedIn: true, checkInError: true}, async page => {
    await page.goto(origin + '/dashboard/events/e1/rounds/r1');
    await page.getByRole('button', {name: 'Check In Now'}).click();
    await visible(page, 'Check-in Failed');
    assert.equal(await page.getByText("You're Checked In", {exact: true}).count(), 0);
  });

  await run('published pairing displays opponent, position and room', {signedIn: true, published: true, assigned: true}, async page => {
    await page.goto(origin + '/dashboard/events/e1/rounds/r1');
    await visible(page, 'Audit Opponent');
    await visible(page, 'Government');
    await visible(page, 'Audit Hall');
    await visible(page, 'Audit Judge');
  });

  await run('unpublished pairings hide opponent and room', {signedIn: true, published: false, assigned: true}, async page => {
    await page.goto(origin + '/dashboard/events/e1/rounds/r1');
    await visible(page, 'Audit Round');
    assert.equal(await page.getByText('Audit Hall', {exact: true}).count(), 0);
    assert.equal(await page.getByText('Audit Opponent', {exact: true}).count(), 0);
  });

  await run('unpublished results show awaiting selection', {signedIn: true, assigned: true}, async page => {
    await page.goto(origin + '/dashboard/events/e1/results');
    await visible(page, 'AWAITING SELECTION');
    assert.equal(await page.getByText('QUALIFIED', {exact: true}).count(), 0);
  });

  await run('published promotion is visible in event results', {signedIn: true, assigned: true, resultsPublished: true}, async page => {
    await page.goto(origin + '/dashboard/events/e1/results');
    await visible(page, 'QUALIFIED');
  });

  await run('check-in window opening updates the button without a reload', {signedIn: true, window: 'future'}, async page => {
    await page.clock.install({time: new Date()});
    await page.goto(origin + '/dashboard/events/e1/rounds/r1');
    await visible(page, 'Check-in Not Available');
    await page.clock.fastForward(10000);
    await page.getByRole('button', {name: 'Check In Now'}).waitFor();
  });

  await run('check-in window closing removes the action without a reload', {signedIn: true}, async page => {
    await page.clock.install({time: new Date()});
    await page.goto(origin + '/dashboard/events/e1/rounds/r1');
    await page.getByRole('button', {name: 'Check In Now'}).waitFor();
    await page.clock.fastForward(90000);
    await visible(page, 'Check-in Not Available');
  });

  await run('participant cannot open admin workspace', {signedIn: true}, async page => {
    await page.goto(origin + '/admin/events');
    await visible(page, 'You do not have admin access');
    assert.equal(await page.getByRole('button', {name: 'Create Event'}).count(), 0);
  });

  await run('admin event creation sends dates and updates list', {signedIn: true, admin: true}, async (page, state) => {
    await page.goto(origin + '/admin/events');
    await page.getByRole('button', {name: 'Create Event', exact: true}).click();
    await page.getByLabel('Tournament Name').fill('New Audit Tournament');
    await page.getByLabel('Start Date (local time)').fill('2026-10-12T10:00');
    await page.getByLabel('End Date (local time)').fill('2026-10-12T18:00');
    await page.getByRole('button', {name: 'Create Event', exact: true}).last().click();
    await visible(page, 'New Audit Tournament');
    assert.equal(state.events.at(-1).startDate, '2026-10-12T04:30:00.000Z');
  });

  await run('create event modal surfaces server error inline when POST /events fails', {signedIn: true, admin: true, createEventError: true}, async page => {
    await page.goto(origin + '/admin/events');
    await page.getByRole('button', {name: 'Create Event', exact: true}).click();
    await page.getByLabel('Tournament Name').fill('Failing Tournament');
    await page.getByLabel('Start Date (local time)').fill('2026-10-12T10:00');
    await page.getByLabel('End Date (local time)').fill('2026-10-12T18:00');
    await page.getByRole('button', {name: 'Create Event', exact: true}).last().click();
    await visible(page, 'Invalid Admin Secret Key');
  });

  await run('live round refresh updates pairings without flashing a loading skeleton', {signedIn: true, published: false, assigned: true}, async (page, state) => {
    await page.goto(origin + '/dashboard/events/e1/rounds/r1');
    await visible(page, 'Audit Round');
    assert.equal(await page.getByText('Audit Opponent', {exact: true}).count(), 0);
    state.round.pairingsPublished = true;
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await visible(page, 'Audit Opponent');
    await visible(page, 'Audit Hall');
    assert.equal(await page.locator('.animate-pulse').count(), 0);
  });

  await run('admin event edit persists across reload', {signedIn: true, admin: true}, async (page, state) => {
    await page.goto(origin + '/admin/events');
    await page.getByRole('button', {name: 'Edit tournament Audit Tournament', exact: true}).click();
    await page.getByLabel('Tournament Name').fill('Updated Audit Tournament');
    await page.getByRole('button', {name: 'Save Changes', exact: true}).click();
    await page.locator('main').getByText('Updated Audit Tournament', {exact: true}).first().waitFor({state: 'visible'});
    assert.equal(state.event.name, 'Updated Audit Tournament');
    await page.reload();
    await page.locator('main').getByText('Updated Audit Tournament', {exact: true}).first().waitFor({state: 'visible'});
  });

  await run('admin event delete persists across reload', {signedIn: true, admin: true}, async (page, state) => {
    page.on('dialog', dialog => dialog.accept());
    await page.goto(origin + '/admin/events');
    await page.getByRole('button', {name: 'Delete tournament Audit Tournament', exact: true}).click();
    await visible(page, 'Event deleted successfully');
    assert.equal(state.events.length, 0);
    await page.reload();
    await page.getByRole('button', {name: 'Create Event', exact: true}).waitFor();
    assert.equal(await page.getByText('Audit Tournament', {exact: true}).count(), 0);
  });

  await run('mobile dashboard command view switches between segmented tabs with no horizontal overflow', {signedIn: true, assigned: true}, async page => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(origin + '/dashboard');
    await page.getByRole('tab', {name: 'Live Matchup'}).waitFor({state: 'visible'});
    await visible(page, 'Audit Tournament');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

    await page.getByRole('tab', {name: /Rounds/}).click();
    await visible(page, 'Audit Round');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

    await page.getByRole('tab', {name: 'Results'}).click();
    await visible(page, 'Tournament Results & Standings');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  });

  await run('first-time login shows visual navigation guide strip, advances steps, and persists dismissal across reload', {signedIn: true}, async page => {
    await page.goto(origin + '/dashboard');
    const guideRegion = page.getByRole('region', {name: 'First-time login visual guide'});
    await guideRegion.waitFor({state: 'visible'});
    await visible(guideRegion, 'No check-in, no mic.');

    await guideRegion.getByRole('button', {name: 'Next Tip'}).click();
    await visible(guideRegion, 'GOV opens. OPP claps back.');

    await guideRegion.getByRole('button', {name: 'Got it'}).click();
    assert.equal(await page.getByRole('region', {name: 'First-time login visual guide'}).count(), 0);

    await page.reload();
    await page.getByRole('tab', {name: 'Live Matchup'}).waitFor({state: 'visible'});
    assert.equal(await page.getByRole('region', {name: 'First-time login visual guide'}).count(), 0);
  });

  await run('header Guide button opens interactive 4-step visual guide modal on mobile without overflow', {signedIn: true}, async page => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(origin + '/dashboard');
    await page.getByRole('button', {name: 'Open quick navigation guide'}).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({state: 'visible'});
    await visible(dialog, 'How to Navigate the Arena');
    await visible(dialog, 'No check-in, no mic.');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

    await dialog.getByRole('tab', {name: /04/}).click();
    await visible(dialog, 'Scores stay backstage. Qualification hits the stage.');
    await dialog.getByRole('button', {name: /Got It, Let's Debate/}).click();
    assert.equal(await page.getByRole('dialog').count(), 0);
  });

  await run('admin inline result entry automatically tags higher score as winner', {signedIn: true, admin: true, assigned: true, published: true}, async (page, state) => {
    state.debate.status = 'SCHEDULED';
    state.debate.winnerId = null;
    state.debate.debater1Score = null;
    state.debate.debater2Score = null;
    await page.goto(origin + '/admin/rounds/r1');
    await page.getByRole('button', {name: /Debates/}).click();
    await page.getByRole('button', {name: 'Enter Result'}).first().click();
    await page.getByRole('heading', {name: /Score Debate/}).waitFor({state: 'visible'});

    const input1 = page.locator('#score-debater-1-d1');
    const input2 = page.locator('#score-debater-2-d1');
    await input1.fill('92');
    await input2.fill('78');

    await visible(page, 'Winner Auto-Selected');
    await page.getByRole('button', {name: 'Save Result'}).click();
    await page.getByRole('heading', {name: /Score Debate/}).waitFor({state: 'hidden'});
    assert.equal(state.debate.debater1Score, 92);
    assert.equal(state.debate.debater2Score, 78);
    assert.equal(state.debate.winnerId, 'u1');
  });

  await run('sign-out returns to landing page', {signedIn: true}, async page => {
    await page.goto(origin + '/dashboard');
    await page.getByRole('button', {name: /Account menu for/}).click();
    await page.getByRole('menuitem', {name: 'Sign out'}).click();
    await page.waitForURL(origin + '/');
  });

  await run('unknown route displays a usable recovery page', {}, async page => {
    await page.goto(origin + '/unknown-audit-route');
    await page.getByRole('link', {name: 'Go to AXIOM'}).waitFor({state: 'visible'});
  });

  await run('mobile landing page has no horizontal page overflow', {}, async page => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(origin + '/');
    await page.getByRole('button', {name: /Register with Google|Continue with Google/}).first().waitFor({state: 'visible'});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  });

} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await writeFile(new URL('browser-results.json', artifacts), JSON.stringify({scope: 'Isolated UI fixtures; not live auth/backend verification', results}, null, 2) + '\n');
}

const failed = results.filter(result => result.status === 'FAIL').length;
console.log(`\n${results.length - failed} passed; ${failed} failed. Details: audit-artifacts/browser-results.json`);
process.exitCode = failed ? 1 : 0;
