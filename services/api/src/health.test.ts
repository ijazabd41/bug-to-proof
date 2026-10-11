import request from 'supertest';
import app from './index';
import { describe, it, expect } from 'vitest';

describe('Health Check API', () => {
  it('GET /api/health should return ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });
});
