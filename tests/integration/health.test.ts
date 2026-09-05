import { describe, it, expect } from 'vitest';
import { healthSchema } from '@pixoo/core';
import { createApp } from '../../apps/server/src/app.js';

describe('foundation health', () => {
  it('reports ready separately from device connectivity without private paths', async () => {
    const app = createApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/health' });
      expect(response.statusCode).toBe(200);
      expect(healthSchema.parse(response.json())).toEqual({
        status: 'ready', mode: 'simulator', device: { connected: false }, canvas: { width: 64, height: 64 },
      });
      expect(response.body).not.toMatch(/dataDirectory|dataDir|deviceIp/);
    } finally { await app.close(); }
  });
});
