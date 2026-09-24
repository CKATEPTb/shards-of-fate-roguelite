import { parseArgs } from 'node:util';
import { startRelayServer } from './server';

const { values } = parseArgs({
  options: { host: { type: 'string' }, port: { type: 'string' } },
  strict: true,
  allowPositionals: false,
});
const host = (values.host ?? process.env.HOST ?? '0.0.0.0').trim();
const port = Number(values.port ?? process.env.PORT ?? 8787);
if (!host) throw new Error('--host / HOST must not be empty.');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port / PORT must be an integer from 1 to 65535.');
const server = await startRelayServer({
  port,
  host,
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean),
});
const displayHost = server.host.includes(':') ? `[${server.host}]` : server.host;
console.log(`Shards relay listening on ws://${displayHost}:${server.port}/rsocket`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void server.close().then(() => { process.exitCode = 0; }, error => {
      console.error(error);
      process.exitCode = 1;
    });
  });
}
