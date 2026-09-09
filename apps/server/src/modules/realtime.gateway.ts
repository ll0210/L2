import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { ChallengeSolvedEvent, LabStatusEvent, LeaderboardUpdatedEvent, RealtimeReadyEvent } from '@cyberquest/shared';
import type { Server, Socket } from 'socket.io';

const jwt = require('jsonwebtoken') as { verify: (token: string, secret: string) => unknown };

type AccessClaims = { sub?: string };

/**
 * A notification-only gateway. Clients can never invoke learning actions over
 * Socket.IO; all mutations stay on the validated REST surface.
 */
@WebSocketGateway({ namespace: '/events', cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly tokenSecret = process.env.JWT_ACCESS_SECRET || 'cyberquest-local-development-secret';

  handleConnection(client: Socket) {
    if (!this.isAllowedOrigin(client) || !this.authenticate(client)) {
      client.disconnect(true);
      return;
    }
    const payload: RealtimeReadyEvent = { connectedAt: new Date().toISOString() };
    client.emit('session.ready', payload);
  }

  emitChallengeSolved(event: Omit<ChallengeSolvedEvent, 'occurredAt'>) {
    const occurredAt = new Date().toISOString();
    this.server.emit('challenge.solved', { ...event, occurredAt } satisfies ChallengeSolvedEvent);
    this.server.emit('leaderboard.updated', { occurredAt } satisfies LeaderboardUpdatedEvent);
  }

  emitLabStatus(userId: string, event: Omit<LabStatusEvent, 'occurredAt'>) {
    this.server.to(this.userRoom(userId)).emit('lab.status', { ...event, occurredAt: new Date().toISOString() } satisfies LabStatusEvent);
  }

  private authenticate(client: Socket) {
    const supplied = client.handshake.auth?.token ?? client.handshake.headers.authorization;
    const token = typeof supplied === 'string' ? supplied.replace(/^Bearer\s+/i, '') : '';
    if (!token || token.length > 4_096) return false;
    try {
      const claims = jwt.verify(token, this.tokenSecret) as AccessClaims;
      if (!claims.sub) return false;
      client.data.userId = claims.sub;
      client.join(this.userRoom(claims.sub));
      return true;
    } catch {
      return false;
    }
  }

  private isAllowedOrigin(client: Socket) {
    if (process.env.NODE_ENV !== 'production') return true;
    const origin = client.handshake.headers.origin;
    const allowed = (process.env.CORS_ORIGIN ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    return Boolean(origin && allowed.includes(origin));
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }
}
