import { startServer } from './server.js';

try {
  const { app, address, mode } = await startServer();
  console.log(`Pixoo ${mode} listening on ${address}`);
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    void app.close().catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : 'Shutdown failed');
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Startup failed');
  process.exitCode = 1;
}
