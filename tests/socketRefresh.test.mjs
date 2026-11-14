import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const apiSource = (await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8'))
  .replaceAll('import.meta.env', '({VITE_API_URL: "https://fixture.invalid/api/"})')
  .replace('const isBrowser = typeof window !== "undefined";', 'const isBrowser = true;')
  .replace(/const isLocalhost =\s*isBrowser && \["localhost", "127\.0\.0\.1"\]\.includes\(window\.location\.hostname\);/, 'const isLocalhost = false;')
  .replaceAll('sessionStorage.getItem("isAdminSession")', 'null')
  .replaceAll('sessionStorage.getItem("adminSecretKey")', 'null');
const api = await import(`data:text/javascript;base64,${Buffer.from(apiSource).toString('base64')}`);

const originalFetch = globalThis.fetch;
let fetchCount = 0;

beforeEach(() => {
  fetchCount = 0;
  api.clearApiCache();
  globalThis.fetch = async (url) => {
    fetchCount += 1;
    return new Response(JSON.stringify({success: true, url}), {
      status: 200,
      headers: {'content-type': 'application/json'}
    });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('selective realtime cache invalidation clears realtime routes while keeping profile cache', async () => {
  await api.EventApi.list();
  await api.UserApi.getProfile();
  assert.equal(fetchCount, 2);

  // Both should be served from cache
  await api.EventApi.list();
  await api.UserApi.getProfile();
  assert.equal(fetchCount, 2);

  // Invalidate only realtime prefixes (matching invalidateRealtimeCache)
  ['/events', '/rounds', '/debates', '/check-in', '/stats', '/admin'].forEach((prefix) => {
    api.clearApiCache(prefix);
  });

  // /users/me remains cached; /events re-fetches
  await api.UserApi.getProfile();
  assert.equal(fetchCount, 2);
  await api.EventApi.list();
  assert.equal(fetchCount, 3);
});

test('SocketService re-attaches tracked listeners after disconnect and reconnect, and refreshAuth re-handshakes', async () => {
  const socketRaw = (await readFile(new URL('../src/services/socket.js', import.meta.url), 'utf8'))
    .replace('import {io, Socket} from "socket.io-client";', `
      const createdSockets = [];
      const io = (url, opts) => {
        const handlers = new Map();
        const sock = {
          url,
          opts,
          connected: false,
          disconnectCount: 0,
          connectCount: 0,
          on(event, fn) {
            if (!handlers.has(event)) handlers.set(event, new Set());
            handlers.get(event).add(fn);
          },
          off(event, fn) {
            handlers.get(event)?.delete(fn);
          },
          emit() {},
          connect() {
            this.connectCount += 1;
            this.connected = true;
            return this;
          },
          disconnect() {
            this.disconnectCount += 1;
            this.connected = false;
            return this;
          },
          _hasListener(event, fn) {
            return Boolean(handlers.get(event)?.has(fn));
          }
        };
        createdSockets.push(sock);
        return sock;
      };
      const Socket = function () {};
      export {createdSockets};
    `)
    .replaceAll('import.meta.env', '({VITE_SOCKET_URL: "https://fixture.invalid"})');

  const socketModule = await import(`data:text/javascript;base64,${Buffer.from(socketRaw).toString('base64')}`);
  const socketService = socketModule.default;

  let calls = 0;
  const handler = () => { calls += 1; };
  const unsub = socketService.on('round:status', handler);

  const firstSock = socketService.connect();
  assert.equal(firstSock._hasListener('round:status', handler), true);

  // refreshAuth should disconnect and reconnect the active socket
  socketService.refreshAuth();
  assert.equal(firstSock.disconnectCount, 1);
  assert.equal(firstSock.connectCount, 2);

  // Full disconnect clears socket instance, and next connect must re-attach tracked listeners
  socketService.disconnect();
  const secondSock = socketService.connect();
  assert.notEqual(secondSock, firstSock);
  assert.equal(secondSock._hasListener('round:status', handler), true);

  unsub();
  assert.equal(secondSock._hasListener('round:status', handler), false);
  assert.equal(calls, 0);
});
