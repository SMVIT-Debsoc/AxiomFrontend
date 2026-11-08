// Test profiles for browser tests. Isolated fixtures only: no real Google, no real backend,
// no real accounts. Every /api/* call and the socket are answered by installProfile().
// Admin status is a fixture value here; real admin accounts are granted on the backend.

export const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const TEST_EMAIL_DOMAIN = 'example.invalid';

// Base profiles. Each one is a complete scenario; overrides are merged in installProfile().
export const PROFILES = {
  // No session at all. Protected routes must send the visitor back to `/`.
  signedOut: {
    signedIn: false,
    admin: false,
    enrolled: false,
    self: null,
  },
  // Google session exists but the profile has no college or mobile yet.
  newParticipant: {
    signedIn: true,
    admin: false,
    enrolled: false,
    autoEnrollOnComplete: true,
    self: {id: 'u-self', firstName: 'Asha', lastName: 'Rao', email: `asha.test@${TEST_EMAIL_DOMAIN}`, college: '', mobile: '', usn: '', gender: ''},
  },
  // Profile complete and enrolled in the test event.
  completeParticipant: {
    signedIn: true,
    admin: false,
    enrolled: true,
    self: {id: 'u-self', firstName: 'Test', lastName: 'Participant', email: `participant.test@${TEST_EMAIL_DOMAIN}`, college: 'Test College', mobile: '+919900000009', usn: 'TST22CS099', gender: ''},
  },
  // Organiser: /api/admin/me returns 200.
  admin: {
    signedIn: true,
    admin: true,
    enrolled: false,
    self: {id: 'u-organiser', firstName: 'Test', lastName: 'Organiser', email: `organiser.test@${TEST_EMAIL_DOMAIN}`, college: 'Test Organising Team', mobile: '+919900000000', usn: 'TST22CS000', gender: ''},
  },
  // Same as a participant, but tries to reach /admin. /api/admin/me returns 403.
  nonAdminTriesAdmin: {
    signedIn: true,
    admin: false,
    enrolled: true,
    self: {id: 'u-self', firstName: 'Test', lastName: 'Participant', email: `participant.test@${TEST_EMAIL_DOMAIN}`, college: 'Test College', mobile: '+919900000009', usn: 'TST22CS099', gender: ''},
  },
};

// Shared mock data. Built per install so timestamps stay recent.
export function buildData(now = Date.now()) {
  const iso = (offsetMs) => new Date(now + offsetMs).toISOString();
  const person = (id, firstName, lastName, college, mobile, usn, createdAgoMinutes) => ({
    id, firstName, lastName, email: `${firstName}.${lastName}`.toLowerCase() + `@${TEST_EMAIL_DOMAIN}`,
    college, mobile, usn, gender: '', createdAt: iso(-createdAgoMinutes * 60000),
  });
  const asha = person('u-asha', 'Asha', 'Rao', 'Test College A', '+919900000001', 'TST22CS001', 40);
  const kavya = person('u-kavya', 'Kavya', 'Nair', 'Test College B', '+919900000002', '', 35);
  const meera = person('u-meera', 'Meera', 'Shah', 'Test College C', '+919900000003', '', 120);
  const rohan = person('u-rohan', 'Rohan', 'Iyer', '', '', '', 15); // incomplete profile, not enrolled
  const roster = [asha, kavya, meera, rohan];

  const rounds = [
    {id: 'r1', eventId: 'e1', name: 'Round 1', roundNumber: 1, status: 'ONGOING', motion: 'This house would ban anonymous online speech.',
      pairingsPublished: true, resultsPublished: false,
      checkInStartTime: iso(-60 * 60000), checkInEndTime: iso(60 * 60000)},
    {id: 'r2', eventId: 'e1', name: 'Round 2', roundNumber: 2, status: 'UPCOMING', motion: '', pairingsPublished: false, resultsPublished: false,
      checkInStartTime: iso(3 * 3600000), checkInEndTime: iso(4 * 3600000)},
  ];
  const event = {id: 'e1', name: 'AXIOM 4.0 Test Tournament', description: 'Isolated test fixture', venue: 'Test Hall',
    status: 'ONGOING', startDate: iso(-86400000), endDate: iso(86400000 * 2), rounds, _count: {participants: 4, rounds: 2}};
  const rooms = [{id: 'rm1', name: 'Hall 1'}, {id: 'rm2', name: 'Hall 2'}, {id: 'rm3', name: 'Hall 3'}];
  const checkIns = [
    {id: 'ci1', roundId: 'r1', userId: 'u-asha', status: 'PRESENT', user: asha},
    {id: 'ci2', roundId: 'r1', userId: 'u-meera', status: 'PRESENT', user: meera},
  ];
  const debates = [
    {id: 'd1', roundId: 'r1', eventId: 'e1', debater1Id: 'u-asha', debater2Id: 'u-meera', debater1: asha, debater2: meera,
      room: rooms[0], judgeName: 'Judge Test A', status: 'SCHEDULED', winnerId: null, debater1Score: null, debater2Score: null, isPromoted: false},
    {id: 'd2', roundId: 'r1', eventId: 'e1', debater1Id: 'u-kavya', debater2Id: 'u-self', debater1: kavya, debater2: null,
      room: rooms[1], judgeName: 'Judge Test B', status: 'SCHEDULED', winnerId: null, debater1Score: null, debater2Score: null, isPromoted: false},
  ];
  return {roster, rounds, event, rooms, checkIns, debates};
}

// Overrides are shallow, except `self`, which is merged field by field.
function resolveProfile(name, overrides) {
  const base = PROFILES[name];
  if (!base) throw new Error(`Unknown test profile "${name}"`);
  return {...base, ...overrides, self: base.self || overrides.self ? {...base.self, ...overrides.self} : null};
}

const sessionUser = (self) => ({
  id: self.id, email: self.email, emailVerified: true, name: `${self.firstName} ${self.lastName}`.trim(), image: null,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

// Route table: [method, path pattern, handler(store, params, body) => [status, json]]
export const ROUTES = [
  ['GET', '/auth/get-session', (s) => (s.signedIn && s.self ? [200, {session: {id: 'test-session', token: 'test-token', userId: s.self.id, expiresAt: new Date(Date.now() + 86400000).toISOString()}, user: sessionUser(s.self)}] : [200, null])],
  ['POST', '/auth/sign-in/social', (s, _p, body) => {
    // The Google round trip: Better Auth returns the callback URL and the session exists on return.
    s.googleSignIns.push(body);
    s.signedIn = true;
    return [200, {url: body.callbackURL, redirect: true}];
  }],
  ['POST', '/auth/sign-out', (s) => { s.signedIn = false; return [200, {success: true}]; }],
  ['POST', '/auth/update-user', (s, _p, body) => {
    const [firstName = '', ...rest] = String(body.name || '').trim().split(/\s+/);
    if (s.self) Object.assign(s.self, {firstName, lastName: rest.join(' ')});
    return [200, {status: true, user: s.self ? sessionUser(s.self) : null}];
  }],
  ['GET', '/admin/me', (s) => (s.admin ? [200, {success: true, admin: {id: 'test-admin'}}] : [403, {error: 'Forbidden'}])],
  ['GET', '/users/me', (s) => [200, {success: true, user: s.self}]],
  ['PUT', '/users/profile', (s, _p, body) => {
    Object.assign(s.self, body);
    let autoEnrollment = null;
    const complete = Boolean(s.self.college && s.self.mobile);
    if (complete && s.autoEnrollOnComplete && !s.enrolled) {
      s.enrolled = true;
      autoEnrollment = {id: 'e1', name: s.event.name};
    }
    return [200, {success: true, user: s.self, autoEnrollment}];
  }],
  ['GET', '/users', (s) => [200, {success: true, users: s.self ? [...s.roster, s.self] : s.roster}]],
  ['GET', '/events', (s) => [200, {success: true, events: [s.event]}]],
  ['GET', '/events/:id', (s) => [200, {success: true, event: s.event}]],
  ['GET', '/events/:id/participants', (s) => [200, {success: true, participants: s.enrolled && s.self ? [...s.roster.filter((u) => u.id !== 'u-rohan'), s.self] : s.roster.filter((u) => u.id !== 'u-rohan')}]],
  ['GET', '/events/:id/enrollment-status', (s) => [200, {success: true, isEnrolled: s.enrolled}]],
  ['POST', '/events/:id/enroll', (s) => { s.enrolled = true; return [200, {success: true}]; }],
  ['POST', '/events/:id/enroll-manual', () => [200, {success: true}]],
  ['GET', '/rounds/event/:id', (s) => [200, {success: true, rounds: s.event.rounds}]],
  ['GET', '/rounds/:id', (s, p) => {
    const round = s.event.rounds.find((r) => r.id === p.id);
    if (!round) return [404, {error: 'Round not found'}];
    return [200, {success: true, round: {...round, checkIns: s.checkIns, debates: s.debates}}];
  }],
  ['GET', '/rooms', (s) => [200, {success: true, rooms: s.rooms}]],
  ['GET', '/admin/rounds/:id/performers', () => [200, {success: true, resultsPublished: false, performers: []}]],
  ['PUT', '/check-in/round/:id/user/:uid', () => [200, {success: true}]],
  ['GET', '/check-in/round/:id/me', () => [200, {success: true, isCheckedIn: false, checkIn: null}]],
  ['GET', '/debates/my-debates', (s) => [200, {success: true, debates: s.debates.filter((d) => s.self && (d.debater1Id === s.self.id || d.debater2Id === s.self.id)).map((d) => ({...d, round: s.event.rounds.find((r) => r.id === d.roundId)}))}]],
  ['GET', '/debates/round/:id', (s) => [200, {success: true, debates: s.debates}]],
  ['GET', '/stats/my-stats', () => [200, {success: true, stats: {totalDebates: 0, wins: 0, losses: 0}}]],
  ['GET', '/stats/leaderboard', () => [200, {success: true, leaderboard: []}]],
  ['GET', '/stats/event/:id', () => [200, {success: true, stats: []}]],
];

export function matchRoute(method, path) {
  for (const [routeMethod, pattern, handler] of ROUTES) {
    if (routeMethod !== method) continue;
    const names = [];
    const source = pattern.replace(/:([a-zA-Z]+)/g, (_m, name) => { names.push(name); return '([^/]+)'; });
    const match = new RegExp(`^${source}$`).exec(path);
    if (match) return {handler, params: Object.fromEntries(names.map((name, i) => [name, decodeURIComponent(match[i + 1])]))};
  }
  return null;
}

// Expected console errors caused by the fixture's denial responses (non-admin probes of /admin/me).
// Only applies to non-admin profiles; anything else is still a failure.
export function isExpectedConsoleError(message, state) {
  if (state.admin) return false;
  const text = message.text();
  const url = message.location()?.url || '';
  if (/Failed to load resource: the server responded with a status of 403/.test(text) && url.endsWith('/api/admin/me')) return true;
  return text.startsWith('API Error (/admin/me)') || text.startsWith('Admin verification failed');
}

/**
 * Install a test profile on a page.
 * - Mocks every /api/* call the app makes (unmocked calls are recorded and answered 404).
 * - Answers the socket.io handshake with a quiet polling session.
 * - Aborts nothing: external requests get an empty 204 so the console stays clean.
 * Returns a store object the tests can assert on (requests, googleSignIns, unmocked).
 */
export async function installProfile(page, profileName, overrides = {}) {
  const profile = resolveProfile(profileName, overrides);
  const data = buildData();
  const store = {
    name: profileName,
    admin: profile.admin,
    signedIn: profile.signedIn,
    enrolled: profile.enrolled,
    autoEnrollOnComplete: Boolean(profile.autoEnrollOnComplete),
    self: profile.self ? {...profile.self} : null,
    roster: data.roster,
    event: data.event,
    rounds: data.rounds,
    rooms: data.rooms,
    checkIns: data.checkIns,
    debates: data.debates,
    requests: [],
    googleSignIns: [],
    unmocked: [],
    socketOpened: false,
  };
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname.startsWith('/socket.io')) {
      if (method === 'POST') return route.fulfill({status: 200, contentType: 'text/plain', body: 'ok'});
      if (!url.searchParams.get('sid')) {
        const handshake = {sid: 'test-socket', upgrades: [], pingInterval: 25000, pingTimeout: 20000, maxPayloadSize: 1000000};
        return route.fulfill({status: 200, contentType: 'text/plain', body: `0${JSON.stringify(handshake)}`});
      }
      if (!store.socketOpened) {
        store.socketOpened = true;
        return route.fulfill({status: 200, contentType: 'text/plain', body: '40{"sid":"test-socket"}'});
      }
      await delay(1000);
      return route.fulfill({status: 200, contentType: 'text/plain', body: '6'});
    }

    if (url.pathname.startsWith('/_vercel/')) return route.fulfill({status: 204, body: ''});

    if (url.pathname.startsWith('/api/')) {
      const path = url.pathname.slice('/api'.length);
      let body = null;
      try { body = request.postDataJSON(); } catch { body = null; }
      store.requests.push({method, path, body});
      const matched = matchRoute(method, path);
      let status = 404;
      let payload = {error: `Unmocked fixture route: ${method} ${path}`};
      if (matched) {
        [status, payload] = matched.handler(store, matched.params, body || {});
      } else {
        store.unmocked.push(`${method} ${path}`);
      }
      return route.fulfill({status, contentType: 'application/json', body: JSON.stringify(payload)});
    }

    // Everything else from the app origin is served; other origins get an empty 204 (no fonts or CDNs in tests).
    const frameUrl = request.frame()?.url() || '';
    const appOrigin = /^https?:/.test(frameUrl) ? new URL(frameUrl).origin : null;
    if (appOrigin && url.origin !== appOrigin) return route.fulfill({status: 204, body: ''});
    return route.continue();
  });
  return store;
}
