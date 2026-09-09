import { reactive } from 'vue';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { RealtimeEventMap } from '@cyberquest/shared';

const eventNames = ['session.ready', 'challenge.solved', 'leaderboard.updated', 'lab.status'] as const;
let socket: Socket | undefined;
let socketToken = '';
type RealtimeEnvelope = { [K in keyof RealtimeEventMap]: { event: K; payload: RealtimeEventMap[K] } }[keyof RealtimeEventMap];

export const realtimeState = reactive({ connected: false, latestEvent: '', latestEventAt: '' });

function endpoint() {
  return (import.meta.env.VITE_WS_URL || `http://${window.location.hostname}:3000`).replace(/\/$/, '');
}

function publish<K extends keyof RealtimeEventMap>(event: K, payload: RealtimeEventMap[K]) {
  realtimeState.latestEvent = event;
  realtimeState.latestEventAt = new Date().toISOString();
  window.dispatchEvent(new CustomEvent<RealtimeEnvelope>('cyberquest:realtime', { detail: { event, payload } as RealtimeEnvelope }));
}

export function connectRealtime(token: string) {
  if (!token) return;
  if (socket?.connected && socketToken === token) return;
  disconnectRealtime();
  socketToken = token;
  socket = io(`${endpoint()}/events`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 3,
    reconnectionDelay: 1_000,
    timeout: 5_000,
  });
  socket.on('connect', () => { realtimeState.connected = true; });
  socket.on('disconnect', () => { realtimeState.connected = false; });
  socket.on('connect_error', () => { realtimeState.connected = false; });
  for (const event of eventNames) socket.on(event, (payload: RealtimeEventMap[typeof event]) => publish(event, payload));
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = undefined;
  socketToken = '';
  realtimeState.connected = false;
}

export function onRealtime(listener: (event: keyof RealtimeEventMap) => void) {
  const handler = (raw: Event) => listener((raw as CustomEvent<{ event: keyof RealtimeEventMap }>).detail.event);
  window.addEventListener('cyberquest:realtime', handler);
  return () => window.removeEventListener('cyberquest:realtime', handler);
}
