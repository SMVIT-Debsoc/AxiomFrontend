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
      if (path === '/debates/d1' && method === 'GET') return reply({success: true, debate: state.debate});
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
    await visible(page, 'Check-in Window Closed');
    assert.equal(await page.getByRole('button', {name: 'Check In Now'}).count(), 0);
  });

  await run('denied round check-in does not display presence', {signedIn: true, checkInError: true}, async page => {
    await page.goto(origin + '/dashboard/events/e1/rounds/r1');
    await page.getByRole('button', {name: 'Check In Now'}).click();
    await visible(page, 'Check-in Failed');
    assert.equal(await page.getByText("You're Checked In", {exact: true}).count(), 0);
  });

  for (const [path, confirmation] of [
    ['/dashboard', 'Presence Verified'],
    ['/dashboard/events/e1/rounds/r1', "You're Checked In"],
  ]) {
    for (const [statusPath, errorMessage] of [
      ['/api/check-in/round/r1/me', 'Could not refresh your check-in status.'],
      ['/api/debates/my-debates', 'Could not refresh your debate assignment.'],
    ]) {
      await run(`${path} blocks check-in until ${statusPath} recovers`, {signedIn: true, enrolled: true}, async (page, state) => {
        let failStatus = true;
        let releaseRetry;
        const retryResponse = new Promise(resolve => { releaseRetry = resolve; });
        await page.route(url => url.pathname === statusPath, async route => {
          if (failStatus) return route.fulfill({status: 503, json: {success: false, error: 'Fixture unavailable'}});
          await retryResponse;
          return route.fallback();
        });

        const unavailable = page.getByRole('button', {name: 'Status unavailable'});
        const loading = page.getByRole('button', {name: 'Loading status…'});
        try {
          await page.goto(origin + path);
          await visible(page, errorMessage);
          await unavailable.waitFor();
          assert.ok(await unavailable.isDisabled());
          assert.equal(state.checkedIn, false);

          failStatus = false;
          await page.getByRole('button', {name: 'Retry', exact: true}).click();
          await loading.waitFor();
          assert.ok(await loading.isDisabled());
          assert.equal(state.checkedIn, false);
        } finally {
          releaseRetry();
        }

        await page.getByRole('button', {name: 'Check In Now'}).click();
        await visible(page, confirmation);
        assert.equal(state.checkedIn, true);
        assert.equal(await page.getByText(errorMessage, {exact: true}).count(), 0);
        await page.reload();
        await visible(page, confirmation);
      });
    }
  }

  await run('published pairing displays opponent, position and room', {signedIn: true, published: true, assigned: true}, async page => {
    await page.goto(origin + '/dashboard/events/e1/rounds/r1');
    await visible(page, 'Audit Opponent');
    await visible(page, 'Government (GOV)');
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
    await visible(page, 'Check-in Not Started Yet');
    await page.clock.fastForward(10000);
    await page.getByRole('button', {name: 'Check In Now'}).waitFor();
  });

  await run('check-in window closing removes the action without a reload', {signedIn: true}, async page => {
    await page.clock.install({time: new Date()});
    await page.goto(origin + '/dashboard/events/e1/rounds/r1');
    await page.getByRole('button', {name: 'Check In Now'}).waitFor();
    await page.clock.fastForward(90000);
    await visible(page, 'Check-in Window Closed');
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
    await visible(page, 'All Results & Event Standings');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  });

  await run('dashboard becomes usable before check-in and standings responses finish', {
    signedIn: true,
    enrolled: true,
    resultsPublished: true,
  }, async page => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route('**/api/check-in/round/r1/me', async route => {
      await held;
      return route.fallback();
    });
    await page.route('**/api/stats/leaderboard?*', async route => {
      await held;
      return route.fallback();
    });

    try {
      await page.goto(origin + '/dashboard');
      await visible(page, 'Audit Tournament');
      assert.ok(await page.getByRole('button', {name: 'Loading status…'}).isDisabled());
    } finally {
      release();
    }
    const checkIn = page.getByRole('button', {name: 'Check In Now'});
    await checkIn.click();
    await visible(page, 'Presence Verified');
  });

  await run('dashboard return shows cached tournament while a slow refresh runs', {signedIn: true}, async (page, state) => {
    await page.goto(origin + '/dashboard');
    await visible(page, 'Audit Tournament');
    await page.getByRole('link', {name: 'Tournament Hub'}).click();
    await page.waitForURL('**/dashboard/events/e1');
    await page.getByRole('link', {name: 'Back to Tournaments'}).waitFor();
    await page.clock.setFixedTime(new Date(Date.now() + 30000));

    let release;
    const held = new Promise(resolve => { release = resolve; });
    const request = page.waitForRequest(/\/api\/events\?view=dashboard/);
    await page.route(/\/api\/events\?view=dashboard/, async route => {
      await held;
      return route.fallback();
    });
    state.event.name = 'Refreshed Tournament';
    try {
      await page.goBack();
      await page.waitForURL('**/dashboard');
      await request;
      await visible(page, 'Audit Tournament');
    } finally {
      release();
    }
    await visible(page, 'Refreshed Tournament');
  });

  await run('round title renders while personal check-in status is pending', {signedIn: true, enrolled: true}, async page => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route('**/api/check-in/round/r1/me', async route => {
      await held;
      return route.fallback();
    });
    try {
      await page.goto(origin + '/dashboard/events/e1/rounds/r1');
      await visible(page, 'Audit Round');
      assert.ok(await page.getByRole('button', {name: 'Loading status…'}).isDisabled());
    } finally {
      release();
    }
    await page.getByRole('button', {name: 'Check In Now'}).waitFor();
  });

  await run('tournament overview renders before enrollment verification', {signedIn: true, enrolled: true}, async page => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route('**/api/events/e1/enrollment-status', async route => {
      await held;
      return route.fallback();
    });
    try {
      await page.goto(origin + '/dashboard/events/e1');
      await visible(page, 'Audit Tournament');
      assert.ok(await page.getByRole('button', {name: 'Checking enrollment…'}).isDisabled());
    } finally {
      release();
    }
    await page.getByRole('button', {name: 'Enrolled'}).waitFor();
  });

  for (const missingTimeout of [false, true]) {
    await run(`debater dashboard and event load without AbortSignal.any${missingTimeout ? ' or timeout' : ''}`, {
      signedIn: true, enrolled: true,
    }, async page => {
      await page.addInitScript(missingTimeout => {
        delete AbortSignal.any;
        if (missingTimeout) delete AbortSignal.timeout;
      }, missingTimeout);
      await page.goto(origin + '/dashboard');
      await visible(page, 'Audit Tournament');
      await page.goto(origin + '/dashboard/events/e1');
      await visible(page, 'Audit Round');
      await page.getByRole('button', {name: 'Enrolled'}).waitFor();
    });
  }

  await run('tournament list preview survives an overview failure and retry', {signedIn: true, enrolled: true}, async page => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route(/\/api\/events\/e1\?view=overview$/, async route => {
      await held;
      await route.fulfill({status: 503, json: {success: false, error: 'Unavailable'}});
    }, {times: 1});
    try {
      await page.goto(origin + '/dashboard/events');
      await page.getByRole('link', {name: 'View Details'}).first().click();
      await visible(page, 'Loading event details…');
      await visible(page, 'Audit Tournament');
      assert.equal(await page.getByText('No rounds have been scheduled yet.').count(), 0);
    } finally {
      release();
    }
    await visible(page, 'Could not refresh the event details. Please try again.');
    await page.getByRole('button', {name: 'Retry', exact: true}).click();
    await visible(page, 'Audit Round');
  });

  await run('tournament direct link shows not found for a 404', {signedIn: true}, async page => {
    await page.route(/\/api\/events\/e1\?view=overview$/, route =>
      route.fulfill({status: 404, json: {success: false, error: 'Event not found'}}));
    await page.goto(origin + '/dashboard/events/e1');
    await visible(page, 'Event Not Found');
    assert.equal(await page.getByRole('button', {name: 'Retry', exact: true}).count(), 0);
  });

  await run('personal results render before standings finish', {
    signedIn: true, assigned: true, resultsPublished: true,
  }, async page => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route(/\/api\/stats\/leaderboard\?/, async route => {
      await held;
      return route.fallback();
    });
    try {
      await page.goto(origin + '/dashboard/events/e1/results');
      await visible(page, 'QUALIFIED');
      await page.getByRole('tab', {name: /Leaderboard|Standings/}).click();
      await visible(page, 'Loading standings…');
    } finally {
      release();
    }
  });

  await run('focusing a tournament link preloads its route without fetching its data', {signedIn: true}, async (page) => {
    await page.goto(origin + '/dashboard');
    const link = page.getByRole('link', {name: 'Tournament Hub'});
    await link.waitFor();
    let eventRequests = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/events/e1') eventRequests += 1;
    });
    const preloaded = page.waitForRequest((request) =>
      new URL(request.url()).pathname === '/src/pages/dashboard/EventDetails.jsx'
    );
    await link.focus();
    await preloaded;
    assert.equal(eventRequests, 0);
    await link.click();
    await page.getByRole('link', {name: 'Back to Tournaments'}).waitFor();
    assert.equal(eventRequests > 0, true);
  });

  await run('standings can be retried without leaving personal results', {
    signedIn: true, assigned: true, resultsPublished: true,
  }, async page => {
    let attempts = 0;
    await page.route(/\/api\/stats\/leaderboard\?/, async route => {
      attempts += 1;
      if (attempts > 1) return route.fallback();
      return route.fulfill({status: 503, json: {success: false, error: 'Standings temporarily unavailable'}});
    });
    await page.goto(origin + '/dashboard/events/e1/results');
    await visible(page, 'QUALIFIED');
    await page.getByRole('tab', {name: 'Standings'}).click();
    await visible(page, 'Could not refresh standings.');
    await page.getByRole('button', {name: 'Retry', exact: true}).click();
    await visible(page, 'No standings yet');
    await page.getByRole('tab', {name: 'My Results'}).click();
    await visible(page, 'QUALIFIED');
  });

  for (const {path, tab, theme, width} of [
    {path: '/dashboard', tab: 'Results', theme: 'light', width: 390},
    {path: '/dashboard/events/e1/results', tab: 'Standings', theme: 'dark', width: 390},
    {path: '/admin/leaderboard', theme: 'dark', width: 1280},
  ]) {
    await run(`podium highlights the top three rows on ${path}`, {
      signedIn: true, admin: path.startsWith('/admin'), assigned: true, resultsPublished: true,
    }, async (page, state) => {
      await page.setViewportSize({width, height: 800});
      await page.addInitScript(theme => localStorage.setItem('axiom-theme', theme), theme);
      const leaderboard = ['First', 'Second', 'Third', 'Fourth'].map((firstName, index) => ({
        rank: index + 1,
        user: {...state.user, id: index ? `rank-${index}` : state.user.id, firstName, lastName: 'Fixture Debater'},
        stats: {wins: 3 - index, winRate: 75 - index * 25, totalScore: 300 - index * 50},
      }));
      await page.route(url => url.pathname === '/api/stats/leaderboard', route =>
        route.fulfill({json: {success: true, leaderboard}}));
      await page.goto(origin + path);
      if (tab) await page.getByRole('tab', {name: tab, exact: true}).click();
      const gold = page.locator('[data-podium="gold"]');
      await visible(gold, 'gold');
      const colors = await page.locator('[data-podium]').evaluateAll(rows => rows.map(row => {
        const style = getComputedStyle(row);
        return {medal: row.dataset.podium, background: style.backgroundImage, edge: style.boxShadow};
      }));
      assert.deepEqual(colors.map(({medal}) => medal), ['gold', 'silver', 'bronze']);
      assert.equal(new Set(colors.map(({background}) => background)).size, 3);
      assert.ok(colors.every(({background, edge}) => background.startsWith('linear-gradient') && edge.includes('inset')));
      assert.equal(await page.locator('[data-podium]').filter({hasText: 'Fourth Fixture Debater'}).count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (tab) {
        assert.match(await gold.innerText(), /you/i);
      } else {
        await page.getByPlaceholder('Search debater by name or college...').fill('Fourth');
        await visible(page, 'Fourth Fixture Debater');
        assert.equal(await page.locator('[data-podium]').count(), 0);
      }
      if (tab === 'Standings') await page.screenshot({path: 'audit-artifacts/standings-podium-mobile.png'});
    });
  }

  await run('first visit offers the site tour and remembers Skip after reload', {signedIn: true, window: 'closed'}, async page => {
    await page.goto(origin + '/dashboard');
    const invitation = page.getByRole('region', {name: 'Take a tour of AXIOM'});
    await invitation.getByRole('button', {name: 'Skip for now'}).click();
    await invitation.waitFor({state: 'hidden'});
    await page.reload();
    await page.getByRole('tab', {name: 'Live Matchup'}).waitFor({state: 'visible'});
    assert.equal(await page.evaluate(() => localStorage.getItem('axiom.site-tour.v1.u1')), 'dismissed');
    assert.equal(await invitation.count(), 0);
  });

  await run('site tour invitation waits for the WhatsApp prompt', {
    signedIn: true, window: 'closed', whatsappLink: 'https://chat.whatsapp.com/test',
  }, async page => {
    await page.goto(origin + '/dashboard');
    const whatsapp = page.getByRole('dialog');
    await whatsapp.waitFor();
    const invitation = page.getByRole('region', {name: 'Take a tour of AXIOM'});
    assert.equal(await invitation.count(), 0);
    await whatsapp.getByRole('button', {name: 'Close', exact: true}).click();
    await invitation.waitFor();
  });

  for (const viewport of [{width: 390, height: 740}, {width: 1280, height: 800}]) {
    await run(`site tour follows the real debater journey at ${viewport.width}px`, {
      signedIn: true, enrolled: true, assigned: true, published: true,
    }, async (page, state) => {
      await page.setViewportSize(viewport);
      state.debate.status = 'SCHEDULED';
      state.debate.debater1Position = viewport.width === 390 ? 'OPP' : 'GOV';
      state.debate.startTime = '2026-11-17T10:00:00.000Z';
      state.debate.endTime = '2026-11-17T10:20:00.000Z';
      state.round.motion = 'This House would make public transport free';
      state.events.unshift({...state.event, id: 'e2', name: 'Another Tournament', status: 'UPCOMING'});
      const writes = [];
      page.on('request', request => {
        if (request.method() === 'POST' && /\/api\/(?:check-in|events\/[^/]+\/enroll)$/.test(new URL(request.url()).pathname)) {
          writes.push(request.url());
        }
      });
      await page.goto(origin + '/dashboard');
      await page.getByRole('button', {name: 'Check In Now'}).waitFor();
      assert.equal(await page.getByRole('region', {name: 'Take a tour of AXIOM'}).count(), 0);
      await page.getByRole('button', {name: 'Site Tour', exact: true}).click();
      await page.getByRole('button', {name: 'Start tour'}).click();
      const dialog = page.getByRole('dialog');
      const next = dialog.getByRole('button', {name: 'Next', exact: true});
      const roundPath = '/dashboard/events/e1/rounds/r1';
      const steps = [
        ['Start on your dashboard', 'overview', '/dashboard'],
        ['Find your tournament', 'event-link', '/dashboard/events'],
        ['Join the tournament', 'enrollment', '/dashboard/events/e1'],
        ['See your round schedule', 'rounds', '/dashboard'],
        ['Check in before you debate', 'check-in', roundPath],
        ['Find your side and opponent', 'side', roundPath],
        ['Find your room and debate time', 'room', roundPath],
        ['Find the debate topic', 'motion', roundPath],
        ['See if you advance', 'results', '/dashboard'],
        ['Keep your details up to date', 'profile', '/dashboard/profile'],
      ];
      for (const [index, [title, anchor, path]] of steps.entries()) {
        await page.waitForURL(origin + path);
        await dialog.getByRole('heading', {name: title, exact: true}).waitFor();
        await page.waitForFunction(anchor => {
          const event = anchor === 'event-link' ? '[href="/dashboard/events/e1"]' : '';
          const target = document.querySelector(`[data-tour-anchor="${anchor}"]${event}`)?.getBoundingClientRect();
          const highlight = document.querySelector('[data-testid="tour-highlight"]')?.getBoundingClientRect();
          const panel = document.querySelector('.site-tour-panel')?.getBoundingClientRect();
          const arrow = document.querySelector('.site-tour-arrow')?.getBoundingClientRect();
          return target && highlight && panel && arrow && Math.abs(target.top - highlight.top) < 4 &&
            Math.abs(highlight.left - target.left) < 4 && panel.left >= 0 && panel.right <= innerWidth &&
            (panel.top >= highlight.bottom || panel.bottom <= highlight.top) &&
            arrow.left < highlight.right && arrow.right > highlight.left &&
            Math.min(Math.abs(arrow.bottom - panel.top), Math.abs(arrow.top - panel.bottom)) <= 2;
        }, anchor);
        const highlighted = page.locator(`[data-tour-anchor="${anchor}"]`);
        if (anchor === 'side') await visible(highlighted, viewport.width === 390 ? 'Opposition (OPP)' : 'Government (GOV)');
        if (anchor === 'room') {
          await visible(highlighted, 'Audit Hall');
          await visible(highlighted, 'Time Slot');
          assert.match(await highlighted.innerText(), /0?3:30\s*pm\s*-\s*0?3:50\s*pm\s*IST/i);
        }
        if (anchor === 'motion') await visible(highlighted, state.round.motion);
        if (anchor === 'check-in') {
          await visible(highlighted, 'Check-in Window');
          if (viewport.width === 390) await page.screenshot({path: 'audit-artifacts/site-tour-mobile.png'});
          await page.keyboard.press('Escape');
          await dialog.waitFor({state: 'hidden'});
          await page.reload();
          await page.getByRole('button', {name: 'Site Tour', exact: true}).click();
          await page.getByRole('button', {name: 'Resume tour'}).click();
          await dialog.getByRole('heading', {name: title, exact: true}).waitFor();
          await page.waitForURL(origin + roundPath);
          await visible(dialog, 'Check the opening and closing times in IST. Tap Check In Now while the window is open. You’re Checked In confirms the organizers know you’re here.');
          assert.deepEqual(writes, []);
          if (viewport.width === 390) {
            await page.getByRole('button', {name: 'Check In Now', exact: true}).click();
            await visible(dialog, 'You’re Checked In means the organizers have marked you as present for this round.');
          }
        }
        if (anchor === 'rounds' && viewport.width === 390) {
          let release;
          const delayedRound = new Promise(resolve => { release = resolve; });
          const isRoundApi = url => url.pathname === '/api/rounds/r1';
          await page.route(isRoundApi, async route => {
            await delayedRound;
            return route.fallback();
          });
          try {
            const roundRequest = page.waitForRequest(request => isRoundApi(new URL(request.url())));
            await next.click();
            await roundRequest;
            await dialog.getByRole('heading', {name: 'Check in before you debate'}).waitFor();
            await visible(dialog, 'Finding this part of the page…');
            assert.ok(await next.isDisabled());
            assert.equal(await dialog.locator('.site-tour-arrow').count(), 0);
          } finally {
            release();
          }
        } else if (index < steps.length - 1) await next.click();
      }
      await dialog.getByRole('button', {name: 'Finish'}).click();
      await dialog.waitFor({state: 'hidden'});
      assert.equal(state.checkedIn, viewport.width === 390);
      assert.equal(writes.length, viewport.width === 390 ? 1 : 0);
      await page.getByText('Checked In!', {exact: true}).waitFor({state: 'hidden', timeout: 6000});
      await page.getByRole('button', {name: 'Site Tour', exact: true}).click();
      await page.getByRole('button', {name: 'Restart tour'}).click();
      await dialog.getByRole('heading', {name: 'Start on your dashboard'}).waitFor();
    });
  }

  await run('site tour explains where details will appear before a round exists', {signedIn: true}, async (page, state) => {
    state.event.rounds = [];
    await page.setViewportSize({width: 360, height: 640});
    await page.goto(origin + '/dashboard');
    await page.getByRole('button', {name: 'Start tour'}).click();
    const dialog = page.getByRole('dialog');
    const next = dialog.getByRole('button', {name: 'Next', exact: true});
    for (let step = 0; step < 3; step++) await next.click();
    await visible(dialog, 'When the organizers add rounds, they’ll appear here with their check-in times.');
    await next.click();
    await visible(dialog, 'This example shows where check-in normally appears. Use the opening and closing times on your real card to know when you can check in.');
    await page.getByRole('region', {name: 'Site Tour example: Check-in Window'}).waitFor();
    await next.click();
    await visible(dialog, 'After organizers publish who debates whom, open the round and look for Your Position and Your Opponent.');
    await dialog.getByRole('button', {name: 'Back', exact: true}).click();
    await dialog.getByRole('heading', {name: 'Check in before you debate'}).waitFor();
    await dialog.getByRole('button', {name: 'Exit tour'}).click();
    assert.ok(await page.getByRole('button', {name: 'Site Tour', exact: true}).evaluate(el => el === document.activeElement));
  });

  await run('site tour explains unpublished round details without displaying them', {signedIn: true, assigned: true}, async (page, state) => {
    state.round.motion = 'Unpublished fixture motion';
    await page.addInitScript(() => localStorage.setItem('axiom.site-tour.v1.u1', 'side'));
    await page.setViewportSize({width: 390, height: 740});
    await page.goto(origin + '/dashboard/events/e1/rounds/r1');
    await page.getByRole('button', {name: 'Site Tour', exact: true}).click();
    await page.getByRole('button', {name: 'Resume tour'}).click();
    const tour = page.getByRole('dialog');
    const next = tour.getByRole('button', {name: 'Next', exact: true});
    await visible(tour, 'After organizers publish who debates whom, open the round and look for Your Position and Your Opponent.');
    await page.getByRole('region', {name: 'Site Tour example: Your Position'}).waitFor();
    await next.click();
    await visible(tour, 'After organizers assign your room and time, open the round and look for Room and Time Slot.');
    await page.getByRole('region', {name: 'Site Tour example: Room and Time Slot'}).waitFor();
    await next.click();
    await visible(tour, 'Once organizers release the topic, open the round and look for Motion near the top.');
    await page.getByRole('region', {name: 'Site Tour example: Motion'}).waitFor();
    assert.equal(await page.getByText('Audit Hall', {exact: true}).count(), 0);
    assert.equal(await page.getByText(state.round.motion, {exact: true}).count(), 0);
  });

  await run('site tour points to an inline check-in example for an eliminated debater', {signedIn: true, enrolled: true}, async (page, state) => {
    state.round.status = 'COMPLETED';
    await page.setViewportSize({width: 390, height: 740});
    await page.route('**/api/check-in/round/r1/me', route => route.fulfill({json: {success: true, isEliminated: true}}));
    await page.addInitScript(() => localStorage.setItem('axiom.site-tour.v1.u1', 'check-in'));
    await page.goto(origin + '/dashboard/events/e1/rounds/r1');
    const slot = page.locator('[data-tour-slot="check-in"]');
    await slot.waitFor({state: 'attached'});
    assert.equal(await page.locator('[data-tour-example]').count(), 0);
    await page.getByRole('button', {name: 'Site Tour', exact: true}).click();
    await page.getByRole('button', {name: 'Resume tour'}).click();
    const example = slot.getByRole('region', {name: 'Site Tour example: Check-in Window'});
    await visible(example, 'Site Tour example · Sample only');
    await visible(example, 'Check In Now');
    assert.equal(await example.getByRole('button').count(), 0);
    await visible(page.getByRole('dialog'), 'Check-in isn’t available for this round because your tournament run has ended. This example shows where the window and Check In Now appear when you’re eligible.');
    await page.waitForFunction(() => {
      const sample = document.querySelector('[data-tour-slot="check-in"] > [data-tour-example]')?.getBoundingClientRect();
      const spotlight = document.querySelector('[data-testid="tour-highlight"][data-visible="true"]')?.getBoundingClientRect();
      const arrow = document.querySelector('.site-tour-arrow')?.getBoundingClientRect();
      return sample && spotlight && arrow && Math.abs(sample.top - spotlight.top) < 4 &&
        Math.abs(sample.left - spotlight.left) < 4 && arrow.left >= sample.left && arrow.right <= sample.right;
    });
    await page.getByRole('button', {name: 'Exit tour'}).click();
    assert.equal(await example.count(), 0);
  });

  await run('site tour respects reduced motion when scrolling to a round control', {signedIn: true}, async page => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.addInitScript(() => {
      localStorage.setItem('axiom.site-tour.v1.u1', 'check-in');
      const scrollTo = Element.prototype.scrollTo;
      Element.prototype.scrollTo = function (...args) {
        if (this.hasAttribute('data-tour-scroll')) {
          window.tourScrollBehavior = args[0].behavior;
        }
        return scrollTo.apply(this, args);
      };
    });
    await page.goto(origin + '/dashboard/events/e1/rounds/r1');
    await page.getByRole('button', {name: 'Site Tour', exact: true}).click();
    await page.getByRole('button', {name: 'Resume tour'}).click();
    const tour = page.getByRole('dialog', {name: 'Check in before you debate'});
    await tour.getByRole('button', {name: 'Next', exact: true}).waitFor();
    await tour.locator('.site-tour-arrow').waitFor();
    assert.equal(await page.evaluate(() => window.tourScrollBehavior), 'instant');
    assert.equal(await tour.evaluate(el => getComputedStyle(el).transitionProperty), 'none');
    assert.equal(await tour.locator('.site-tour-arrow').evaluate(el => getComputedStyle(el).animationName), 'none');
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
    const saveRequest = page.waitForRequest((request) =>
      request.method() === 'POST' && new URL(request.url()).pathname === '/api/debates/d1/result'
    );
    await page.getByRole('button', {name: 'Save Result'}).click();
    assert.equal(new URL((await saveRequest).url()).searchParams.get('view'), 'summary');
    await page.getByRole('heading', {name: /Score Debate/}).waitFor({state: 'hidden'});
    assert.equal(state.debate.debater1Score, 92);
    assert.equal(state.debate.debater2Score, 78);
    assert.equal(state.debate.winnerId, 'u1');
  });

  await run('admin live round renders while roster, rooms and performers are pending', {signedIn: true, admin: true}, async page => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const supportPaths = ['/api/rooms', '/api/events/e1/participants', '/api/admin/rounds/r1/performers'];
    await page.route(url => supportPaths.includes(url.pathname), async route => {
      await held;
      return route.fallback();
    });
    const indexRequest = page.waitForRequest(request =>
      new URL(request.url()).pathname === '/api/rounds/event/e1'
    );
    try {
      await page.goto(origin + '/admin');
      assert.equal(new URL((await indexRequest).url()).searchParams.get('view'), 'summary');
      await page.getByRole('tab', {name: /Round 1/}).waitFor();
      await page.getByPlaceholder('Find debater or room').waitFor();
    } finally {
      release();
    }
  });

  for (const {recorded, legacy} of [{recorded: true}, {recorded: false}, {recorded: true, legacy: true}]) {
    const outcome = recorded ? 'was recorded' : 'did not reach the server';
    await run(`ballot recovery after a lost response when the save ${outcome}${legacy ? ' without modern AbortSignal methods' : ''}`, {
      signedIn: true, admin: true, assigned: true, published: true,
    }, async (page, state) => {
      if (legacy) await page.addInitScript(() => {
        delete AbortSignal.any;
        delete AbortSignal.timeout;
        delete AbortSignal.prototype.throwIfAborted;
      });
      Object.assign(state.debate, {status: 'SCHEDULED', winnerId: null, debater1Score: null, debater2Score: null});
      let posts = 0;
      await page.route(url => url.pathname === '/api/debates/d1/result', async route => {
        posts += 1;
        if (posts !== 1) return route.fallback();
        if (recorded) Object.assign(state.debate, route.request().postDataJSON(), {status: 'COMPLETED'});
        return route.abort('failed');
      });

      await page.goto(origin + '/admin/rounds/r1');
      await page.getByRole('button', {name: /Debates/}).click();
      await page.getByRole('button', {name: 'Enter Result'}).first().click();
      const score = page.locator('#score-debater-1-d1');
      await score.fill('92');
      await page.locator('#score-debater-2-d1').fill('78');
      const save = page.getByRole('button', {name: 'Save Result'});
      await save.click();
      await visible(page, 'Save not confirmed');
      assert.equal(await score.inputValue(), '92');
      assert.equal(await save.isDisabled(), true);
      const lookup = page.waitForRequest(request => new URL(request.url()).searchParams.get('view') === 'ballot');
      await page.getByRole('button', {name: 'Check saved result'}).click();
      await lookup;
      const sheet = page.getByRole('heading', {name: /Score Debate/});
      if (recorded) {
        await sheet.waitFor({state: 'hidden'});
        assert.equal(posts, 1);
      } else {
        await visible(page, 'The stored ballot does not match your entry');
        assert.equal(await score.inputValue(), '92');
        assert.equal(posts, 1);
        await save.click();
        await sheet.waitFor({state: 'hidden'});
        assert.equal(posts, 2);
      }
    });
  }

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
