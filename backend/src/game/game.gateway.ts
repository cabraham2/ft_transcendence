import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { GameService } from './game.service';
import { MatchSettingsInput } from './game.types';

type AuthenticatedSocket = Socket & {
  data: {
    user?: JwtPayload;
  };
};

@WebSocketGateway({
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
  },
})
@Injectable()
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly gameService: GameService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server): void {
    this.gameService.attachServer(server);
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'dev_jwt_secret'),
      });

      const socketData = client.data as Record<string, unknown>;
      socketData.user = payload;
      await this.gameService.registerSocket(payload.sub, client.id);
      this.logger.log(
        `Socket connected: user=${payload.sub} socket=${client.id}`,
      );
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    await this.gameService.unregisterSocket(client.id);
  }

  @SubscribeMessage('matchmaking:join')
  joinMatchmaking(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body?: { settings?: MatchSettingsInput },
  ) {
    const user = this.requireUser(client);
    return this.gameService.joinQueue(user.sub, client.id, body?.settings);
  }

  @SubscribeMessage('matchmaking:leave')
  leaveMatchmaking(@ConnectedSocket() client: AuthenticatedSocket) {
    const user = this.requireUser(client);
    return this.gameService.leaveQueue(user.sub);
  }

  @SubscribeMessage('tournament:queue')
  joinTournamentMatch(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: { tournamentMatchId?: string; settings?: MatchSettingsInput },
  ) {
    const user = this.requireUser(client);
    if (!body?.tournamentMatchId) {
      throw new BadRequestException('tournamentMatchId is required.');
    }

    return this.gameService.joinTournamentQueue(
      user.sub,
      client.id,
      body.tournamentMatchId,
      body.settings,
    );
  }

  @SubscribeMessage('tournament:leave')
  leaveTournamentMatch(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { tournamentMatchId?: string },
  ) {
    const user = this.requireUser(client);
    if (!body?.tournamentMatchId) {
      throw new BadRequestException('tournamentMatchId is required.');
    }

    return this.gameService.leaveTournamentQueue(
      user.sub,
      body.tournamentMatchId,
    );
  }

  @SubscribeMessage('game:input')
  gameInput(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { matchId?: string; direction?: number },
  ) {
    const user = this.requireUser(client);
    if (!body?.matchId || typeof body.direction !== 'number') {
      throw new BadRequestException('matchId and direction are required.');
    }

    return this.gameService.handleInput(user.sub, body.matchId, body.direction);
  }

  @SubscribeMessage('game:reconnect')
  reconnect(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { matchId?: string },
  ) {
    const user = this.requireUser(client);
    if (!body?.matchId) {
      throw new BadRequestException('matchId is required.');
    }

    return this.gameService.reconnectToMatch(user.sub, client.id, body.matchId);
  }

  @SubscribeMessage('game:active')
  activeMatch(@ConnectedSocket() client: AuthenticatedSocket) {
    const user = this.requireUser(client);
    return this.gameService.activeMatchForUser(user.sub);
  }

  private requireUser(client: AuthenticatedSocket): JwtPayload {
    const socketData = client.data as Record<string, unknown>;
    const payload = socketData.user;
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Socket is not authenticated.');
    }

    const castedPayload = payload as Partial<JwtPayload>;
    if (
      typeof castedPayload.sub !== 'string' ||
      typeof castedPayload.email !== 'string' ||
      typeof castedPayload.username !== 'string'
    ) {
      throw new BadRequestException('Socket token payload is invalid.');
    }

    return {
      sub: castedPayload.sub,
      email: castedPayload.email,
      username: castedPayload.username,
    };
  }

  private extractToken(client: AuthenticatedSocket): string | undefined {
    const authToken = (client.handshake.auth as { token?: unknown } | undefined)
      ?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const authorizationHeader = client.handshake.headers.authorization;
    if (!authorizationHeader) {
      return undefined;
    }

    const [scheme, token] = authorizationHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return undefined;
    }

    return token;
  }
}
