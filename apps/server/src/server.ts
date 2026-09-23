import { createServer } from 'node:http';
import { characters } from '@shards/game-data';
import { MAX_REQUEST_BYTES, ROOM_EVENTS_ROUTE, ROOM_REQUEST_ROUTE, type RoomEvent, type RoomResponse } from '@shards/protocol';
import { Flux } from 'reactor-core-ts';
import {
  RequestResponseController, RequestStreamController, RSocketServer,
  type RSocketRequestContext, type RSocketServerConnection,
} from 'rsocket-server-ts';
import { WebSocket, WebSocketServer } from 'ws';
import { RoomRelay } from './relay';

class RoomRequests extends RequestResponseController<unknown, RoomResponse> {
  protected readonly route = ROOM_REQUEST_ROUTE;
  constructor(private readonly relay: RoomRelay) { super(); }
  handle(input: unknown, context: RSocketRequestContext): RoomResponse {
    return this.relay.request(context.connection, input);
  }
}

class RoomEvents extends RequestStreamController<unknown, RoomEvent> {
  protected readonly route = ROOM_EVENTS_ROUTE;
  constructor(private readonly relay: RoomRelay) { super(); }
  handle(_input: unknown, context: RSocketRequestContext): Flux<RoomEvent> {
    return new Flux(signal => {
      const events = this.relay.events(context.connection);
      signal.addEventListener('abort', () => { void events.return?.(); }, { once: true });
      if (signal.aborted) void events.return?.();
      return events;
    });
  }
}

export interface RelayServerOptions {
  host?: string;
  port?: number;
  maxConnections?: number;
  maxRooms?: number;
  /** Optional exact browser Origin allowlist for a public deployment. */
  allowedOrigins?: readonly string[];
}

/** Starts an HTTP health endpoint and the RSocket WebSocket relay; no database or game simulation. */
export async function startRelayServer(options: RelayServerOptions = {}) {
  const host = options.host ?? '0.0.0.0';
  const port = options.port ?? 8787;
  const maxConnections = options.maxConnections ?? 400;
  const relay = new RoomRelay({ heroIds: characters.map(character => character.id), maxRooms: options.maxRooms });
  const sockets = new Map<RSocketServerConnection, WebSocket>();
  const rsocket = new RSocketServer({
    controllers: [new RoomRequests(relay), new RoomEvents(relay)],
    maxFrameLength: 64 * 1024,
    handshakeTimeoutMs: 10_000,
    accept: setup => setup.dataMimeType.mimeType === 'application/json'
      && (setup.metadataMimeType.mimeType === 'message/x.rsocket.composite-metadata.v0'
        || setup.metadataMimeType.mimeType === 'message/x.rsocket.routing.v0')
      && !setup.resumeToken && setup.keepAliveMs >= 1000 && setup.keepAliveMs <= 30_000
      && setup.lifetimeMs >= setup.keepAliveMs && setup.lifetimeMs <= 90_000,
    activityListener: ({ connection, direction }) => {
      if (direction === 'send') {
        const socket = sockets.get(connection);
        if (socket && socket.bufferedAmount > MAX_REQUEST_BYTES) socket.terminate();
      }
    },
  });
  const http = createServer((request, response) => {
    if (request.url === '/health' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end('{"status":"ok"}');
    } else {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('RSocket endpoint: /rsocket');
    }
  });
  const webSockets = new WebSocketServer({
    server: http, path: '/rsocket', maxPayload: MAX_REQUEST_BYTES, perMessageDeflate: false,
    verifyClient: (info: { origin: string }) => webSockets.clients.size < maxConnections
      && (!options.allowedOrigins?.length || options.allowedOrigins.includes(info.origin)),
  });
  webSockets.on('connection', socket => {
    let connection: RSocketServerConnection | undefined;
    socket.on('error', () => { /* Protocol/session cleanup runs through the close handler. */ });
    socket.once('close', () => {
      if (connection) {
        sockets.delete(connection);
        relay.disconnect(connection);
      }
    });
    rsocket.acceptWebSocket(socket).subscribe(accepted => {
      connection = accepted;
      if (socket.readyState !== WebSocket.OPEN) relay.disconnect(accepted);
      else sockets.set(accepted, socket);
    }, () => { socket.terminate(); });
  });
  const maintenance = setInterval(() => {
    relay.sweep();
    for (const socket of webSockets.clients) {
      if (socket.bufferedAmount > MAX_REQUEST_BYTES) socket.terminate();
    }
  }, 1000);
  maintenance.unref();
  try {
    await new Promise<void>((resolve, reject) => {
      http.once('error', reject);
      http.listen(port, host, () => { http.off('error', reject); resolve(); });
    });
  } catch (error) {
    clearInterval(maintenance);
    webSockets.close();
    await rsocket.close().block();
    throw error;
  }
  const address = http.address();
  if (!address || typeof address === 'string') throw new Error('Relay did not bind a TCP port.');
  let closing: Promise<void> | undefined;
  return {
    port: address.port,
    host,
    relay,
    close(): Promise<void> {
      closing ??= (async () => {
        clearInterval(maintenance);
        relay.close();
        await rsocket.close().block();
        for (const socket of webSockets.clients) socket.terminate();
        await new Promise<void>(resolve => webSockets.close(() => resolve()));
        await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
      })();
      return closing;
    },
  };
}
