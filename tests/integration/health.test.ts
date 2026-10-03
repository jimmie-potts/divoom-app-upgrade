import { describe, it, expect } from 'vitest';
import { healthSchema } from '@pixoo/core';
import { createApp } from '../../apps/server/src/app.js';

describe('foundation health', () => {
  it('reports ready separately from device connectivity without private paths', async () => {
    const app = createApp({buildFile:new URL('./missing-build-fixture.json',import.meta.url)});
    try {
      const response = await app.inject({ method: 'GET', url: '/api/health' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('build.sourceRevision', 'unknown');
      expect(healthSchema.parse(response.json())).toEqual({
        status: 'ready', mode: 'simulator', device: { connected: false }, canvas: { width: 64, height: 64 },
        build: {sourceRevision:'unknown',version:'0.0.0'},
      });
      expect(response.body).not.toMatch(/dataDirectory|dataDir|deviceIp/);
    } finally { await app.close(); }
  });
});
