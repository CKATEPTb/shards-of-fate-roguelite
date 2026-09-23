import { startRelayServer } from './server';

const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
const server = await startRelayServer({
  port,
  host: process.env.HOST ?? '0.0.0.0',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean),
});
console.log(`Shards relay listening on ws://${server.host}:${server.port}/rsocket`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void server.close().then(() => { process.exitCode = 0; }, error => {
      console.error(error);
      process.exitCode = 1;
    });
  });
}
