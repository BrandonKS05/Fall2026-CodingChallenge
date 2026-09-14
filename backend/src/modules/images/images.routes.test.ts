import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../../testing/testApp.js';

describe('GET /api/images/:id', () => {
  const app = buildTestApp();

  it('rejects malformed ids and reports unknown images', async () => {
    expect((await request(app).get('/api/images/not-a-uuid')).status).toBe(400);
    const missing = await request(app).get('/api/images/00000000-0000-0000-0000-000000000000');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });
});
