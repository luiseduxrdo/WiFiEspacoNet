import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePrintPayload, newToken, tokenHash } from '../lib/temporary-links.mjs';
import { renderPrintPage } from '../lib/print-page.mjs';

export const payload = {
  dataUrls: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6X8AAAAASUVORK5CYII='],
  pw: '9.2cm', ph: '12cm', rotated: true, copies: 2,
};

test('only accepts bounded print settings and PNGs, rejecting injected content', () => {
  assert.equal(validatePrintPayload(payload), true);
  for (const change of [
    { pw: '1cm; color:red' }, { ph: '99cm' }, { copies: 11 }, { copies: 0 },
    { copies: 1.5 }, { rotated: 'false' }, { dataUrls: [] },
    { dataUrls: Array(5).fill(payload.dataUrls[0]) },
    { dataUrls: ['data:image/svg+xml,<svg onload=alert(1)>'] },
    { dataUrls: ['data:image/png;base64,YWJj'] },
    { dataUrls: ['data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024)] },
  ]) assert.equal(validatePrintPayload({ ...payload, ...change }), false, JSON.stringify(change).slice(0, 100));
});

test('unguessable tokens are stored as hashes', () => {
  const a = newToken();
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, newToken());
  assert.notEqual(tokenHash(a), a);
  assert.equal(tokenHash(a), tokenHash(a));
});

test('shared print page preserves every card, dimensions, copies and orientation', () => {
  const html = renderPrintPage({ ...payload, dataUrls: Array(4).fill(payload.dataUrls[0]) }, { temporary: true });
  assert.equal((html.match(/<img /g) || []).length, 8);
  assert.match(html, /width: 12cm; height: 9.2cm/);
  assert.match(html, /rotate\(90deg\)/);
  assert.match(html, /id="print"/);
  assert.match(html, /@media print \{ .toolbar \{ display: none/);
  assert.doesNotMatch(renderPrintPage(payload), /id="print"/);
});

test('database lifecycle: six hours, reusable read, expired access denied and physical deletion', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { neon } = await import('@neondatabase/serverless');
  const { default: create } = await import('../api/temporary-links.js');
  const { default: read } = await import('../api/temporary-links/[token].js');
  const sql = neon(process.env.DATABASE_URL);
  const response = () => ({
    headers: {}, setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.code = n; return this; },
    json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; },
  });
  const created = response();
  const invalid = response();
  await create({ method: 'POST', body: { ...payload, pw: '</style><script>alert(1)</script>' } }, invalid);
  assert.equal(invalid.code, 400);
  const wrongMethod = response();
  await create({ method: 'GET' }, wrongMethod);
  assert.equal(wrongMethod.code, 405);
  const malformed = response();
  await read({ method: 'GET', query: { token: 'invalid' } }, malformed);
  assert.equal(malformed.code, 404);
  await create({ method: 'POST', body: payload }, created);
  assert.equal(created.code, 201);
  const token = created.body.path.split('/').pop();
  const hash = tokenHash(token);
  try {
    const [row] = await sql`SELECT EXTRACT(EPOCH FROM (expires_at - created_at)) AS lifetime FROM wifi_print_links WHERE token_hash = ${hash}`;
    assert.equal(Number(row.lifetime), 21600);
    for (let i = 0; i < 2; i++) {
      const result = response();
      await read({ method: 'GET', query: { token } }, result);
      assert.equal(result.code, 200);
      assert.match(result.body, /id="print"/);
      assert.match(result.headers['Cache-Control'], /no-store/);
    }
    await sql`UPDATE wifi_print_links SET created_at = NOW() - INTERVAL '7 hours', expires_at = NOW() - INTERVAL '1 hour' WHERE token_hash = ${hash}`;
    const expired = response();
    await read({ method: 'GET', query: { token } }, expired);
    assert.equal(expired.code, 404);
    await import('../scripts/cleanup-print-links.mjs');
    assert.equal((await sql`SELECT token_hash FROM wifi_print_links WHERE token_hash = ${hash}`).length, 0);
  } finally {
    await sql`DELETE FROM wifi_print_links WHERE token_hash = ${hash}`;
  }
});
