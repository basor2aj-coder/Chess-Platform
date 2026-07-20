const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app, rooms } = require('../server.js');

function getStatus(port) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/status`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, json: JSON.parse(body) }));
    }).on('error', reject);
  });
}

test('GET /status', async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  t.afterEach(() => rooms.clear());
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  await t.test('reports zero active rooms when none exist', async () => {
    const { statusCode, json } = await getStatus(port);
    assert.equal(statusCode, 200);
    assert.deepEqual(json, { activeRooms: 0 });
  });

  await t.test('counts a room with a seated white player as active', async () => {
    rooms.set('ABCDEF', { white: {}, black: null });
    const { json } = await getStatus(port);
    assert.deepEqual(json, { activeRooms: 1 });
  });

  await t.test('does not count a room with no seated players', async () => {
    rooms.set('ABCDEF', { white: null, black: null });
    const { json } = await getStatus(port);
    assert.deepEqual(json, { activeRooms: 0 });
  });
});
