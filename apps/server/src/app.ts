import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { healthSchema } from '@pixoo/core';
import { canvasSize } from '@pixoo/media';
import {registerApi,type ApiRuntimeOptions,type RuntimeStatus} from './api.js';
import {security,type Authenticate} from './security.js';
export interface AppOptions extends ApiRuntimeOptions {webRoot?:string;dataDir?:string;authenticate?:Authenticate}
export function createApp(options:AppOptions={}) {
  if(options.mcpEnabled&&!options.dataDir)throw new Error('MCP requires private runtime storage');
  if(options.controllerEnabled&&!options.dataDir)throw new Error('Controller requires private runtime storage');
  const mode=options.runtime?.mode??options.mode??'simulator';
  if(mode==='device'&&!options.dataDir)throw new Error('Device mode requires a private runtime directory');
  const app = Fastify({ logger: false, bodyLimit:64*1024, requestTimeout:30000 });
  security(app,options.authenticate,options.mcpEnabled,options.controllerEnabled);
  let observed=():RuntimeStatus=>({mode,connected:mode==='simulator'?false:null});
  app.get('/api/health',()=>{const state=observed();return healthSchema.parse({
    status:'ready',mode:state.mode,device:{connected:state.connected},canvas:canvasSize,
  });});
  if(options.dataDir)app.register(async scope=>{observed=await registerApi(scope,options.dataDir!,options);});
  if (options.webRoot) app.register(fastifyStatic, { root: options.webRoot, index: 'index.html', list: false });
  return app;
}
