import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MatchStatus, Prisma } from '@prisma/client';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { UsersService } from '../users/users.service';
import {
  DEFAULT_MATCH_SETTINGS,
  MatchSettingsInput,
  PlayerInput,
  QueueEntry,
  RuntimeMatch,
  RuntimePlayer,
  normalizeMatchSettings,
} from './game.types';

@Injectable()
export class GameService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameService.name);
  private readonly arenaWidth = 900;
  private readonly arenaHeight = 500;
  private readonly paddleWidth = 14;
  private readonly ballRadius = 10;
  private readonly paddleSpeed = 560;
  private readonly baseBallSpeed = 430;
  private readonly disconnectGraceMs: number;

  private server?: Server;
  private tickHandle?: NodeJS.Timeout;
  private lastTickAt = Date.now();

  private readonly queue: QueueEntry[] = [];
  private readonly tournamentQueues = new Map<string, QueueEntry[]>();
  private readonly matches = new Map<string, RuntimeMatch>();
  private readonly socketToUser = new Map<string, string>();
  private readonly userToSocket = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly tournamentsService: TournamentsService,
  ) {
    this.disconnectGraceMs = Number(
      this.configService.get('MATCH_DISCONNECT_GRACE_MS') ?? 30000,
    );
  }

  onModuleInit(): void {
    this.tickHandle = setInterval(() => this.tick(), 1000 / 30);
  }

  onModuleDestroy(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
    }
  }

  attachServer(server: Server): void {
    this.server = server;
  }

  defaultSettings() {
    return DEFAULT_MATCH_SETTINGS;
  }

  async getUserSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gameSettings: true },
    });

    return normalizeMatchSettings(user?.gameSettings ?? undefined);
  }

  async updateUserSettings(userId: string, input: MatchSettingsInput) {
    const normalized = normalizeMatchSettings(input);

    await this.prisma.userGameSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...normalized,
      },
      update: {
        ...normalized,
      },
    });

    return this.getUserSettings(userId);
  }

  async registerSocket(userId: string, socketId: string) {
    const previousSocket = this.userToSocket.get(userId);
    if (previousSocket && previousSocket !== socketId) {
      this.socketToUser.delete(previousSocket);
      this.server?.sockets.sockets.get(previousSocket)?.disconnect(true);
    }

    this.userToSocket.set(userId, socketId);
    this.socketToUser.set(socketId, userId);

    await this.usersService.setOnlineStatus(userId, true);

    const runtimeMatch = this.findRuntimeMatchByUserId(userId);
    if (runtimeMatch) {
      this.reconnectPlayer(runtimeMatch, userId, socketId);
    }

    this.server?.emit('presence:update', {
      userId,
      isOnline: true,
    });
  }

  async unregisterSocket(socketId: string) {
    const userId = this.socketToUser.get(socketId);
    if (!userId) {
      return;
    }

    this.socketToUser.delete(socketId);
    if (this.userToSocket.get(userId) === socketId) {
      this.userToSocket.delete(userId);
      await this.usersService.setOnlineStatus(userId, false);
      this.server?.emit('presence:update', {
        userId,
        isOnline: false,
      });
    }

    this.leaveQueue(userId);
    this.leaveAllTournamentQueues(userId);

    const runtimeMatch = this.findRuntimeMatchByUserId(userId);
    if (runtimeMatch) {
      this.markPlayerDisconnected(runtimeMatch, userId);
    }
  }

  async joinQueue(
    userId: string,
    socketId: string,
    settingsInput?: MatchSettingsInput,
  ) {
    if (this.findRuntimeMatchByUserId(userId)) {
      throw new BadRequestException('You are already in an active match.');
    }

    const alreadyQueued = this.queue.find((entry) => entry.userId === userId);
    if (alreadyQueued) {
      return {
        queued: true,
        queueSize: this.queue.length,
      };
    }

    this.queue.push({
      userId,
      socketId,
      settings: settingsInput ?? {},
      queuedAt: Date.now(),
    });

    await this.tryMatchmaking();

    return {
      queued: true,
      queueSize: this.queue.length,
    };
  }

  leaveQueue(userId: string) {
    const initialSize = this.queue.length;
    const nextQueue = this.queue.filter((entry) => entry.userId !== userId);
    this.queue.length = 0;
    this.queue.push(...nextQueue);

    return {
      removed: initialSize !== nextQueue.length,
      queueSize: this.queue.length,
    };
  }

  async joinTournamentQueue(
    userId: string,
    socketId: string,
    tournamentMatchId: string,
    settingsInput?: MatchSettingsInput,
  ) {
    const tournamentMatch = await this.prisma.tournamentMatch.findUnique({
      where: { id: tournamentMatchId },
      include: { tournament: true },
    });

    if (!tournamentMatch) {
      throw new NotFoundException('Tournament match not found.');
    }

    if (
      tournamentMatch.playerOneId !== userId &&
      tournamentMatch.playerTwoId !== userId
    ) {
      throw new BadRequestException(
        'You are not a participant in this tournament match.',
      );
    }

    if (tournamentMatch.status === 'FINISHED') {
      throw new BadRequestException('Tournament match is already finished.');
    }

    const queue = this.tournamentQueues.get(tournamentMatchId) ?? [];
    if (!queue.some((entry) => entry.userId === userId)) {
      queue.push({
        userId,
        socketId,
        settings:
          settingsInput ??
          (tournamentMatch.tournament.settingsJson as MatchSettingsInput),
        queuedAt: Date.now(),
      });
      this.tournamentQueues.set(tournamentMatchId, queue);
    }

    if (!tournamentMatch.playerOneId || !tournamentMatch.playerTwoId) {
      return {
        queued: true,
        waiting: true,
      };
    }

    const playerOneEntry = queue.find(
      (entry) => entry.userId === tournamentMatch.playerOneId,
    );
    const playerTwoEntry = queue.find(
      (entry) => entry.userId === tournamentMatch.playerTwoId,
    );

    if (playerOneEntry && playerTwoEntry) {
      this.tournamentQueues.delete(tournamentMatchId);
      await this.createRuntimeMatch(
        playerOneEntry,
        playerTwoEntry,
        tournamentMatchId,
      );
    }

    return {
      queued: true,
      waiting: !(playerOneEntry && playerTwoEntry),
    };
  }

  leaveTournamentQueue(userId: string, tournamentMatchId: string) {
    const queue = this.tournamentQueues.get(tournamentMatchId);
    if (!queue) {
      return { removed: false };
    }

    const filtered = queue.filter((entry) => entry.userId !== userId);
    if (filtered.length === 0) {
      this.tournamentQueues.delete(tournamentMatchId);
    } else {
      this.tournamentQueues.set(tournamentMatchId, filtered);
    }

    return {
      removed: filtered.length !== queue.length,
    };
  }

  handleInput(userId: string, matchId: string, rawDirection: number) {
    const runtimeMatch = this.matches.get(matchId);
    if (!runtimeMatch || runtimeMatch.status !== 'live') {
      throw new NotFoundException('Match not found.');
    }

    const direction: PlayerInput =
      rawDirection > 0 ? 1 : rawDirection < 0 ? -1 : 0;

    if (runtimeMatch.playerOne.userId === userId) {
      runtimeMatch.playerOne.input = direction;
      return { ok: true };
    }

    if (runtimeMatch.playerTwo.userId === userId) {
      runtimeMatch.playerTwo.input = direction;
      return { ok: true };
    }

    throw new BadRequestException('You are not a player in this match.');
  }

  reconnectToMatch(userId: string, socketId: string, matchId: string) {
    const runtimeMatch = this.matches.get(matchId);
    if (!runtimeMatch) {
      throw new NotFoundException('Match not found.');
    }

    this.reconnectPlayer(runtimeMatch, userId, socketId);

    return {
      ok: true,
      match: this.publicMatchState(runtimeMatch),
    };
  }

  activeMatchForUser(userId: string) {
    const runtimeMatch = this.findRuntimeMatchByUserId(userId);
    if (!runtimeMatch) {
      return { active: false };
    }

    return {
      active: true,
      match: this.publicMatchState(runtimeMatch),
    };
  }

  private async tryMatchmaking() {
    while (this.queue.length >= 2) {
      const playerOne = this.queue.shift();
      const playerTwo = this.queue.shift();

      if (!playerOne || !playerTwo) {
        break;
      }

      await this.createRuntimeMatch(playerOne, playerTwo);
    }
  }

  private async createRuntimeMatch(
    playerOneEntry: QueueEntry,
    playerTwoEntry: QueueEntry,
    tournamentMatchId?: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: [playerOneEntry.userId, playerTwoEntry.userId],
        },
      },
      select: {
        id: true,
        username: true,
      },
    });

    const firstUser = users.find((user) => user.id === playerOneEntry.userId);
    const secondUser = users.find((user) => user.id === playerTwoEntry.userId);
    if (!firstUser || !secondUser) {
      throw new NotFoundException('Could not resolve players.');
    }

    const normalizedSettings = normalizeMatchSettings(playerOneEntry.settings);

    const dbMatch = await this.prisma.match.create({
      data: {
        playerOneId: playerOneEntry.userId,
        playerTwoId: playerTwoEntry.userId,
        settingsJson: normalizedSettings as unknown as Prisma.InputJsonValue,
        status: MatchStatus.LIVE,
      },
    });

    const runtimeMatch: RuntimeMatch = {
      id: dbMatch.id,
      roomId: `match:${dbMatch.id}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: normalizedSettings,
      playerOne: {
        userId: firstUser.id,
        username: firstUser.username,
        socketId: playerOneEntry.socketId,
        paddleY: this.arenaHeight / 2 - normalizedSettings.paddleSize / 2,
        input: 0,
        connected: true,
      },
      playerTwo: {
        userId: secondUser.id,
        username: secondUser.username,
        socketId: playerTwoEntry.socketId,
        paddleY: this.arenaHeight / 2 - normalizedSettings.paddleSize / 2,
        input: 0,
        connected: true,
      },
      scoreOne: 0,
      scoreTwo: 0,
      status: 'live',
      tournamentMatchId,
      lastPowerUpAt: Date.now(),
      ball: {
        x: this.arenaWidth / 2,
        y: this.arenaHeight / 2,
        vx: 0,
        vy: 0,
      },
    };

    this.resetBall(runtimeMatch, Math.random() > 0.5 ? 1 : -1);

    this.matches.set(runtimeMatch.id, runtimeMatch);
    this.joinSocketToRoom(runtimeMatch.playerOne.socketId, runtimeMatch.roomId);
    this.joinSocketToRoom(runtimeMatch.playerTwo.socketId, runtimeMatch.roomId);

    if (tournamentMatchId) {
      await this.tournamentsService.markMatchLive(
        tournamentMatchId,
        runtimeMatch.id,
      );
    }

    this.server?.to(runtimeMatch.roomId).emit('game:started', {
      match: this.publicMatchState(runtimeMatch),
    });

    this.server?.to(runtimeMatch.playerOne.socketId ?? '').emit('game:role', {
      matchId: runtimeMatch.id,
      side: 'left',
    });

    this.server?.to(runtimeMatch.playerTwo.socketId ?? '').emit('game:role', {
      matchId: runtimeMatch.id,
      side: 'right',
    });

    this.logger.log(
      `Match ${runtimeMatch.id} started between ${firstUser.username} and ${secondUser.username}`,
    );
  }

  private joinSocketToRoom(socketId: string | null, roomId: string) {
    if (!socketId || !this.server) {
      return;
    }

    const socket = this.server.sockets.sockets.get(socketId);
    void socket?.join(roomId);
  }

  private tick() {
    const now = Date.now();
    const deltaSeconds = Math.max(0.001, (now - this.lastTickAt) / 1000);
    this.lastTickAt = now;

    for (const runtimeMatch of this.matches.values()) {
      if (runtimeMatch.status !== 'live') {
        continue;
      }

      this.resolveDisconnects(runtimeMatch, now);
      if (runtimeMatch.status !== 'live') {
        continue;
      }

      this.updatePlayer(
        runtimeMatch.playerOne,
        runtimeMatch.settings,
        deltaSeconds,
      );
      this.updatePlayer(
        runtimeMatch.playerTwo,
        runtimeMatch.settings,
        deltaSeconds,
      );
      this.updateBall(runtimeMatch, deltaSeconds, now);
      this.emitMatchState(runtimeMatch);
    }
  }

  private updatePlayer(
    player: RuntimePlayer,
    settings: RuntimeMatch['settings'],
    deltaSeconds: number,
  ) {
    const delta = player.input * this.paddleSpeed * deltaSeconds;
    player.paddleY = clamp(
      player.paddleY + delta,
      0,
      this.arenaHeight - settings.paddleSize,
    );
  }

  private updateBall(
    runtimeMatch: RuntimeMatch,
    deltaSeconds: number,
    now: number,
  ) {
    runtimeMatch.ball.x += runtimeMatch.ball.vx * deltaSeconds;
    runtimeMatch.ball.y += runtimeMatch.ball.vy * deltaSeconds;

    if (
      runtimeMatch.ball.y - this.ballRadius <= 0 &&
      runtimeMatch.ball.vy < 0
    ) {
      runtimeMatch.ball.y = this.ballRadius;
      runtimeMatch.ball.vy *= -1;
    }

    if (
      runtimeMatch.ball.y + this.ballRadius >= this.arenaHeight &&
      runtimeMatch.ball.vy > 0
    ) {
      runtimeMatch.ball.y = this.arenaHeight - this.ballRadius;
      runtimeMatch.ball.vy *= -1;
    }

    this.handlePaddleCollision(runtimeMatch, 'left');
    this.handlePaddleCollision(runtimeMatch, 'right');
    this.handlePowerUp(runtimeMatch, now);

    if (runtimeMatch.ball.x + this.ballRadius < 0) {
      this.scorePoint(runtimeMatch, 'right');
      return;
    }

    if (runtimeMatch.ball.x - this.ballRadius > this.arenaWidth) {
      this.scorePoint(runtimeMatch, 'left');
    }
  }

  private handlePaddleCollision(
    runtimeMatch: RuntimeMatch,
    side: 'left' | 'right',
  ) {
    const paddleY =
      side === 'left'
        ? runtimeMatch.playerOne.paddleY
        : runtimeMatch.playerTwo.paddleY;
    const paddleX =
      side === 'left' ? 20 : this.arenaWidth - 20 - this.paddleWidth;

    const ballMovingTowardPaddle =
      side === 'left' ? runtimeMatch.ball.vx < 0 : runtimeMatch.ball.vx > 0;

    if (!ballMovingTowardPaddle) {
      return;
    }

    const ballLeft = runtimeMatch.ball.x - this.ballRadius;
    const ballRight = runtimeMatch.ball.x + this.ballRadius;
    const intersectsX =
      side === 'left'
        ? ballLeft <= paddleX + this.paddleWidth
        : ballRight >= paddleX;

    if (!intersectsX) {
      return;
    }

    const paddleTop = paddleY;
    const paddleBottom = paddleY + runtimeMatch.settings.paddleSize;
    const intersectsY =
      runtimeMatch.ball.y >= paddleTop && runtimeMatch.ball.y <= paddleBottom;

    if (!intersectsY) {
      return;
    }

    const impact =
      (runtimeMatch.ball.y - (paddleY + runtimeMatch.settings.paddleSize / 2)) /
      (runtimeMatch.settings.paddleSize / 2);
    const maxBounce = Math.PI / 3;
    const bounceAngle = impact * maxBounce;

    const currentSpeed = Math.sqrt(
      runtimeMatch.ball.vx ** 2 + runtimeMatch.ball.vy ** 2,
    );
    const boostedSpeed = Math.min(
      currentSpeed * 1.04,
      this.baseBallSpeed * 2.2,
    );

    const direction = side === 'left' ? 1 : -1;
    runtimeMatch.ball.vx = Math.cos(bounceAngle) * boostedSpeed * direction;
    runtimeMatch.ball.vy = Math.sin(bounceAngle) * boostedSpeed;

    runtimeMatch.ball.x =
      side === 'left'
        ? paddleX + this.paddleWidth + this.ballRadius
        : paddleX - this.ballRadius;
  }

  private handlePowerUp(runtimeMatch: RuntimeMatch, now: number) {
    if (!runtimeMatch.settings.powerUpsEnabled) {
      runtimeMatch.powerUp = undefined;
      return;
    }

    if (!runtimeMatch.powerUp && now - runtimeMatch.lastPowerUpAt >= 12000) {
      runtimeMatch.powerUp = {
        x: randomInRange(this.arenaWidth * 0.3, this.arenaWidth * 0.7),
        y: randomInRange(60, this.arenaHeight - 60),
      };
      runtimeMatch.lastPowerUpAt = now;
      return;
    }

    if (!runtimeMatch.powerUp) {
      return;
    }

    const distance = Math.hypot(
      runtimeMatch.ball.x - runtimeMatch.powerUp.x,
      runtimeMatch.ball.y - runtimeMatch.powerUp.y,
    );

    if (distance <= this.ballRadius + 14) {
      runtimeMatch.ball.vx *= 1.18;
      runtimeMatch.ball.vy *= 1.18;
      runtimeMatch.powerUp = undefined;
      runtimeMatch.lastPowerUpAt = now;
    }
  }

  private scorePoint(runtimeMatch: RuntimeMatch, side: 'left' | 'right') {
    if (side === 'left') {
      runtimeMatch.scoreOne += 1;
    } else {
      runtimeMatch.scoreTwo += 1;
    }

    const scoreDiff = Math.abs(runtimeMatch.scoreOne - runtimeMatch.scoreTwo);
    const highestScore = Math.max(runtimeMatch.scoreOne, runtimeMatch.scoreTwo);

    if (highestScore >= runtimeMatch.settings.winningScore && scoreDiff >= 2) {
      const winnerId =
        runtimeMatch.scoreOne > runtimeMatch.scoreTwo
          ? runtimeMatch.playerOne.userId
          : runtimeMatch.playerTwo.userId;
      void this.finishMatch(runtimeMatch, winnerId, false);
      return;
    }

    this.resetBall(runtimeMatch, side === 'left' ? 1 : -1);
  }

  private resetBall(runtimeMatch: RuntimeMatch, direction: 1 | -1) {
    const angle = randomInRange(-Math.PI / 6, Math.PI / 6);
    const speed = this.baseBallSpeed * (runtimeMatch.settings.ballSpeed / 6);

    runtimeMatch.ball = {
      x: this.arenaWidth / 2,
      y: this.arenaHeight / 2,
      vx: Math.cos(angle) * speed * direction,
      vy: Math.sin(angle) * speed,
    };
  }

  private resolveDisconnects(runtimeMatch: RuntimeMatch, now: number) {
    const playerOneTimedOut =
      !runtimeMatch.playerOne.connected &&
      runtimeMatch.playerOne.disconnectedAt !== undefined &&
      now - runtimeMatch.playerOne.disconnectedAt >= this.disconnectGraceMs;

    const playerTwoTimedOut =
      !runtimeMatch.playerTwo.connected &&
      runtimeMatch.playerTwo.disconnectedAt !== undefined &&
      now - runtimeMatch.playerTwo.disconnectedAt >= this.disconnectGraceMs;

    if (!playerOneTimedOut && !playerTwoTimedOut) {
      return;
    }

    if (playerOneTimedOut && !playerTwoTimedOut) {
      void this.finishMatch(runtimeMatch, runtimeMatch.playerTwo.userId, true);
      return;
    }

    if (playerTwoTimedOut && !playerOneTimedOut) {
      void this.finishMatch(runtimeMatch, runtimeMatch.playerOne.userId, true);
      return;
    }

    if (runtimeMatch.scoreOne > runtimeMatch.scoreTwo) {
      void this.finishMatch(runtimeMatch, runtimeMatch.playerOne.userId, true);
      return;
    }

    if (runtimeMatch.scoreTwo > runtimeMatch.scoreOne) {
      void this.finishMatch(runtimeMatch, runtimeMatch.playerTwo.userId, true);
      return;
    }

    void this.finishMatch(runtimeMatch, undefined, true);
  }

  private markPlayerDisconnected(runtimeMatch: RuntimeMatch, userId: string) {
    const player =
      runtimeMatch.playerOne.userId === userId
        ? runtimeMatch.playerOne
        : runtimeMatch.playerTwo.userId === userId
          ? runtimeMatch.playerTwo
          : undefined;

    if (!player || !player.connected) {
      return;
    }

    player.connected = false;
    player.disconnectedAt = Date.now();
    player.socketId = null;

    this.server?.to(runtimeMatch.roomId).emit('game:player-disconnected', {
      userId,
      reconnectBefore: player.disconnectedAt + this.disconnectGraceMs,
    });
  }

  private reconnectPlayer(
    runtimeMatch: RuntimeMatch,
    userId: string,
    socketId: string,
  ) {
    const player =
      runtimeMatch.playerOne.userId === userId
        ? runtimeMatch.playerOne
        : runtimeMatch.playerTwo.userId === userId
          ? runtimeMatch.playerTwo
          : undefined;

    if (!player) {
      throw new BadRequestException('You are not part of this match.');
    }

    player.connected = true;
    player.disconnectedAt = undefined;
    player.socketId = socketId;

    this.joinSocketToRoom(socketId, runtimeMatch.roomId);
    this.server?.to(runtimeMatch.roomId).emit('game:player-reconnected', {
      userId,
    });
    this.emitMatchState(runtimeMatch);
  }

  private emitMatchState(runtimeMatch: RuntimeMatch) {
    runtimeMatch.updatedAt = Date.now();
    this.server?.to(runtimeMatch.roomId).emit('game:state', {
      match: this.publicMatchState(runtimeMatch),
    });
  }

  private async finishMatch(
    runtimeMatch: RuntimeMatch,
    winnerId?: string,
    byForfeit = false,
  ) {
    if (runtimeMatch.status === 'finished') {
      return;
    }

    runtimeMatch.status = 'finished';
    runtimeMatch.winnerId = winnerId;

    const finishedAt = new Date();
    const loserId = winnerId
      ? winnerId === runtimeMatch.playerOne.userId
        ? runtimeMatch.playerTwo.userId
        : runtimeMatch.playerOne.userId
      : undefined;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.match.update({
          where: { id: runtimeMatch.id },
          data: {
            status: winnerId ? MatchStatus.FINISHED : MatchStatus.CANCELED,
            winnerId,
            scoreOne: runtimeMatch.scoreOne,
            scoreTwo: runtimeMatch.scoreTwo,
            finishedAt,
          },
        });

        if (!winnerId || !loserId) {
          return;
        }

        const [winnerUser, loserUser] = await Promise.all([
          tx.user.findUnique({ where: { id: winnerId } }),
          tx.user.findUnique({ where: { id: loserId } }),
        ]);

        if (!winnerUser || !loserUser) {
          return;
        }

        const updatedRatings = calculateElo(winnerUser.elo, loserUser.elo);
        const winnerXp = winnerUser.xp + 120;
        const loserXp = loserUser.xp + 40;

        await tx.user.update({
          where: { id: winnerId },
          data: {
            wins: { increment: 1 },
            elo: updatedRatings.winner,
            xp: winnerXp,
            level: levelFromXp(winnerXp),
          },
        });

        await tx.user.update({
          where: { id: loserId },
          data: {
            losses: { increment: 1 },
            elo: updatedRatings.loser,
            xp: loserXp,
            level: levelFromXp(loserXp),
          },
        });

        await unlockAchievements(tx, winnerId);
        await unlockAchievements(tx, loserId);
      });

      if (runtimeMatch.tournamentMatchId && winnerId) {
        await this.tournamentsService.resolveMatchFromGame(
          runtimeMatch.tournamentMatchId,
          winnerId,
          runtimeMatch.id,
        );
      }
    } catch (error) {
      // Persisting must never leave players stuck on a finished match.
      this.logger.error(`Failed to persist match ${runtimeMatch.id}`, error);
    }

    this.server?.to(runtimeMatch.roomId).emit('game:finished', {
      match: this.publicMatchState(runtimeMatch),
      winnerId,
      byForfeit,
    });

    setTimeout(() => {
      this.matches.delete(runtimeMatch.id);
    }, 30000);
  }

  private leaveAllTournamentQueues(userId: string) {
    for (const [matchId, queue] of this.tournamentQueues.entries()) {
      const filtered = queue.filter((entry) => entry.userId !== userId);
      if (filtered.length === 0) {
        this.tournamentQueues.delete(matchId);
      } else {
        this.tournamentQueues.set(matchId, filtered);
      }
    }
  }

  private findRuntimeMatchByUserId(userId: string) {
    for (const runtimeMatch of this.matches.values()) {
      if (
        runtimeMatch.playerOne.userId === userId ||
        runtimeMatch.playerTwo.userId === userId
      ) {
        return runtimeMatch;
      }
    }

    return undefined;
  }

  private publicMatchState(runtimeMatch: RuntimeMatch) {
    return {
      id: runtimeMatch.id,
      roomId: runtimeMatch.roomId,
      status: runtimeMatch.status,
      winnerId: runtimeMatch.winnerId,
      tournamentMatchId: runtimeMatch.tournamentMatchId,
      settings: runtimeMatch.settings,
      dimensions: {
        width: this.arenaWidth,
        height: this.arenaHeight,
        paddleWidth: this.paddleWidth,
        ballRadius: this.ballRadius,
      },
      players: {
        left: {
          userId: runtimeMatch.playerOne.userId,
          username: runtimeMatch.playerOne.username,
          connected: runtimeMatch.playerOne.connected,
          paddleY: runtimeMatch.playerOne.paddleY,
        },
        right: {
          userId: runtimeMatch.playerTwo.userId,
          username: runtimeMatch.playerTwo.username,
          connected: runtimeMatch.playerTwo.connected,
          paddleY: runtimeMatch.playerTwo.paddleY,
        },
      },
      score: {
        left: runtimeMatch.scoreOne,
        right: runtimeMatch.scoreTwo,
      },
      ball: runtimeMatch.ball,
      powerUp: runtimeMatch.powerUp,
      disconnectGraceMs: this.disconnectGraceMs,
      updatedAt: runtimeMatch.updatedAt,
    };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function calculateElo(winnerElo: number, loserElo: number) {
  const kFactor = 32;
  const expectedWinner = 1 / (1 + 10 ** ((loserElo - winnerElo) / 400));
  const winner = Math.round(winnerElo + kFactor * (1 - expectedWinner));
  const loser = Math.round(loserElo + kFactor * (0 - (1 - expectedWinner)));

  return {
    winner,
    loser,
  };
}

function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / 500) + 1);
}

async function unlockAchievements(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      wins: true,
      losses: true,
      elo: true,
    },
  });

  if (!user) {
    return;
  }

  const totalMatches = user.wins + user.losses;
  const candidates: Array<{ key: string; shouldUnlock: boolean }> = [
    { key: 'first_win', shouldUnlock: user.wins >= 1 },
    { key: 'five_wins', shouldUnlock: user.wins >= 5 },
    { key: 'ten_matches', shouldUnlock: totalMatches >= 10 },
    { key: 'elo_1200', shouldUnlock: user.elo >= 1200 },
  ];

  for (const candidate of candidates) {
    if (!candidate.shouldUnlock) {
      continue;
    }

    await tx.achievement.upsert({
      where: {
        userId_key: {
          userId,
          key: candidate.key,
        },
      },
      create: {
        userId,
        key: candidate.key,
      },
      update: {},
    });
  }
}
