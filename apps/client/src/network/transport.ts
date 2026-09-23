import { RSocket } from 'rsocket-browser';
import { WellKnownMimeType } from 'rsocket-frames-ts';
import { ROOM_EVENTS_ROUTE, ROOM_REQUEST_ROUTE, type RoomEvent, type RoomRequest, type RoomResponse } from '@shards/protocol';

export interface RoomConnection {
  request(request: RoomRequest): Promise<RoomResponse>;
  watch(onEvent: (event: RoomEvent) => void, onFailure: (error: unknown) => void): () => void;
  close(): void;
}
export type RoomConnector = (url: string, onDisconnect: () => void, signal?: AbortSignal) => Promise<RoomConnection>;
const route = (name: string) => WellKnownMimeType.MESSAGE_RSOCKET_ROUTING.toMetadata([name]);

/** A room belongs to one physical connection. A lost connection must never reconnect into an orphan room. */
export const connectRSocket: RoomConnector = async (url, onDisconnect, signal) => {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'ws:' && endpoint.protocol !== 'wss:') throw new Error('Укажите адрес сервера ws:// или wss://.');
  let closed = false;
  let transport: WebSocket | undefined;
  if (signal?.aborted) throw new Error('Подключение отменено.');
  const cancelConnect = () => { closed = true; transport?.close(); };
  signal?.addEventListener('abort', cancelConnect, { once: true });
  const socket = new RSocket(url, {
    reconnect: false,
    setup: {
      keepAlive: 10_000, lifetime: 30_000, fragmentSize: 64 * 1024,
      transport: (endpoint, protocols) => { transport = new WebSocket(endpoint, protocols); return transport; },
      mimetype: { data: WellKnownMimeType.APPLICATION_JSON, metadata: WellKnownMimeType.MESSAGE_RSOCKET_COMPOSITE_METADATA },
    },
    events: { disconnect: () => { if (!closed) onDisconnect(); }, closed: () => { if (!closed) onDisconnect(); } },
  });
  const connection = await socket.connect().timeout(10_000).block().catch(error => {
    cancelConnect();
    throw error;
  }).finally(() => signal?.removeEventListener('abort', cancelConnect));
  if (!connection) throw new Error('Не удалось подключиться к серверу.');
  return {
    async request(request) {
      const response = await connection.requestResponse(request, route(ROOM_REQUEST_ROUTE)).timeout(10_000).block();
      const value = response?.data;
      if (!value || typeof value !== 'object' || !('ok' in value) || typeof value.ok !== 'boolean') throw new Error('Сервер вернул некорректный ответ.');
      return value as RoomResponse;
    },
    watch(onEvent, onFailure) {
      let subscription: { request(n: number): void; cancel(): void } | undefined;
      let cancelled = false;
      let credits = 0;
      connection.requestStream({}, route(ROOM_EVENTS_ROUTE)).subscribe({
        onSubscribe(value) { subscription = value; credits = 16; value.request(credits); },
        onNext(payload) {
          if (cancelled || closed) return;
          try { onEvent(payload.data as RoomEvent); }
          catch (error) { onFailure(error); }
          // Replenish in groups instead of another control frame for every event.
          if (!cancelled && !closed && --credits <= 8) { const demand = 16 - credits; credits += demand; subscription?.request(demand); }
        },
        onError(error) { if (!cancelled && !closed) onFailure(error); },
        onComplete() { if (!cancelled && !closed) onFailure(new Error('Сервер закрыл комнату.')); },
      });
      return () => { cancelled = true; subscription?.cancel(); };
    },
    close() { if (!closed) { closed = true; connection.disconnect(); } },
  };
};
