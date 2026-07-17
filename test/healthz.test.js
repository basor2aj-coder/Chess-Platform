const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app } = require('../server.js');

test('GET /healthz responds 200', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const status = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/healthz`, (res) => resolve(res.statusCode)).on('error', reject);
    });
    assert.equal(status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
