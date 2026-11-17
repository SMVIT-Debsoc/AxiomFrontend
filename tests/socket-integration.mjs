import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import test from 'node:test';
import {io} from 'socket.io-client';

// Run with the sibling backend built. Both clients connect over loopback and all
// database authorization calls used by this test are replaced with fixtures.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.ADMIN_SECRET_KEY = 'socket-integration-fixture-key';

const backend = new URL('../../backend/dist/', import.meta.url);
const {default: prisma} = await import(new URL('utils/prisma.js', backend));
const {initializeSocket, closeSocket, socketEmitters} = await import(new URL('utils/socket.js', backend));

test('room delivery requires enrollment, preserves publication rules and deduplicates overlapping rooms', async (context) => {
  let enrolled = false;
  const stub = (delegate, method, implementation) => {
    const original = delegate[method];
    delegate[method] = implementation;
    context.after(() => { delegate[method] = original; });
  };
  stub(prisma.admin, 'findFirst', async () => null);
  stub(prisma.user, 'findFirst', async () => ({id: 'participant-fixture'}));
  stub(prisma.event, 'findFirst', async () => enrolled ? {id: 'e1'} : null);
  stub(prisma.round, 'findFirst', async () => enrolled ? {id: 'r1'} : null);

  const http = createServer();
  initializeSocket(http);
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  const {port} = http.address();
  const makeClient = auth => io(`http://127.0.0.1:${port}`, {auth, autoConnect: false, transports: ['websocket']});
  const participant = makeClient({token: 'mock-token-participant'});
  const admin = makeClient({adminSecretKey: process.env.ADMIN_SECRET_KEY});
  context.after(async () => {
    participant.disconnect();
    admin.disconnect();
    await closeSocket();
  });

  const waitFor = (client, event) => new Promise((resolve, reject) => {
    const listener = (data) => { clearTimeout(timer); resolve(data); };
    const timer = setTimeout(() => { client.off(event, listener); reject(new Error(`Missing ${event}`)); }, 3000);
    client.once(event, listener);
  });
  const connect = async (client) => {
    const connected = waitFor(client, 'connect');
    client.connect();
    await connected;
  };
  const join = (client, event, id) => client.timeout(3000).emitWithAck(event, id);
  const joinBoth = async (client) => {
    assert.deepEqual(await join(client, 'join:event', 'e1'), {joined: true});
    assert.deepEqual(await join(client, 'join:round', 'r1'), {joined: true});
  };

  await Promise.all([connect(participant), connect(admin)]);
  assert.deepEqual(await join(participant, 'join:event', 'e1'), {joined: false});
  assert.deepEqual(await join(participant, 'join:round', 'r1'), {joined: false});
  enrolled = true;
  await Promise.all([joinBoth(participant), joinBoth(admin)]);

  const created = waitFor(participant, 'round:created');
  socketEmitters.roundCreated('r1', 'e1', {id: 'r1', motion: 'Unreleased motion', pairingsPublished: false});
  assert.equal((await created).round.motion, null);

  const updateForParticipant = waitFor(participant, 'round:updated');
  const updateForAdmin = waitFor(admin, 'round:updated');
  let participantUpdates = 0;
  let adminUpdates = 0;
  participant.on('round:updated', () => { participantUpdates += 1; });
  admin.on('round:updated', () => { adminUpdates += 1; });
  const barrier = Promise.all([waitFor(participant, 'round:checkinWindow'), waitFor(admin, 'round:checkinWindow')]);
  socketEmitters.roundUpdated('r1', 'e1', {id: 'r1', motion: 'Unreleased motion', pairingsPublished: false});
  socketEmitters.roundCheckInWindow('r1', 'e1', {checkInStartTime: null, checkInEndTime: null});
  assert.equal((await updateForParticipant).round.motion, null);
  assert.equal((await updateForAdmin).round.motion, 'Unreleased motion');
  await barrier;
  assert.equal(participantUpdates, 1);
  assert.equal(adminUpdates, 1);

  participant.disconnect();
  await connect(participant);
  await joinBoth(participant);
  const published = waitFor(participant, 'round:updated');
  socketEmitters.roundUpdated('r1', 'e1', {id: 'r1', motion: 'Published motion', pairingsPublished: true});
  assert.equal((await published).round.motion, 'Published motion');
});
