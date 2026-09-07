import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { healthSchema } from '@pixoo/core';
import { simulatorDevice } from '@pixoo/device';
import { canvasSize } from '@pixoo/media';
import {registerApi} from './api.js';
import {security,type Authenticate} from './security.js';

export function createApp(options: { webRoot?: string; dataDir?:string; authenticate?:Authenticate } = {}) {
  const app = Fastify({ logger: false, bodyLimit:64*1024, requestTimeout:30000 });
  security(app,options.authenticate);
  app.get('/api/health', () => healthSchema.parse({
    status: 'ready', mode: 'simulator', device: simulatorDevice, canvas: canvasSize,
  }));
  if(options.dataDir)app.register(async scope=>registerApi(scope,options.dataDir!));
  if (options.webRoot) app.register(fastifyStatic, { root: options.webRoot, index: 'index.html', list: false });
  return app;
}
