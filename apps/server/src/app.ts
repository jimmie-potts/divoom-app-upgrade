import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { healthSchema } from '@pixoo/core';
import { simulatorDevice } from '@pixoo/device';
import { canvasSize } from '@pixoo/media';

export function createApp(options: { webRoot?: string } = {}) {
  const app = Fastify({ logger: false });
  app.get('/api/health', () => healthSchema.parse({
    status: 'ready', mode: 'simulator', device: simulatorDevice, canvas: canvasSize,
  }));
  if (options.webRoot) app.register(fastifyStatic, { root: options.webRoot, index: 'index.html', list: false });
  return app;
}
