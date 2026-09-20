import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

export const webRoot = fileURLToPath(new URL('../../web/dist/', import.meta.url));

export async function startServer(env: NodeJS.ProcessEnv = process.env) {
  // Missing build output must not produce a misleading ready listener.
  await access(join(webRoot, 'index.html'));
  const config = await loadConfig(env);
  const app = createApp({ webRoot, dataDir:config.dataDir, runtime:config,mcpEnabled:config.mcpEnabled??false,monitorEnabled:config.monitorEnabled??false,controllerEnabled:config.controllerEnabled??false,...(config.controllerIdentity?{controllerIdentity:config.controllerIdentity}:{}) });
  try {
    const address = await app.listen({ host: config.host, port: config.port });
    return { app, address };
  } catch (error) {
    await app.close();
    throw error;
  }
}
