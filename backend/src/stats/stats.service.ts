import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async myStats(userId: string) {
    return this.userStats(userId);
  }

  async userStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        wins: true,
        losses: true,
        elo: true,
        xp: true,
        level: true,
        achievements: {
          orderBy: { unlockedAt: 'desc' },
          select: {
            key: true,
            unlockedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return {
      ...user,
      matchesPlayed: user.wins + user.losses,
      winRate:
        user.wins + user.losses === 0
          ? 0
          : Math.round((user.wins / (user.wins + user.losses)) * 10000) / 100,
    };
  }

  async leaderboard(limit = 25) {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    return this.prisma.user.findMany({
      take: safeLimit,
      orderBy: [{ elo: 'desc' }, { wins: 'desc' }],
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        wins: true,
        losses: true,
        elo: true,
        level: true,
      },
    });
  }

  async history(userId: string, limit = 20) {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const matches = await this.prisma.match.findMany({
      where: {
        OR: [{ playerOneId: userId }, { playerTwoId: userId }],
      },
      take: safeLimit,
      orderBy: { startedAt: 'desc' },
      include: {
        playerOne: {
          select: { id: true, username: true, avatarUrl: true },
        },
        playerTwo: {
          select: { id: true, username: true, avatarUrl: true },
        },
        winner: {
          select: { id: true, username: true },
        },
        tournamentLink: {
          select: { id: true },
        },
      },
    });

    return matches.map((match) => {
      const isPlayerOne = match.playerOneId === userId;
      const opponent = isPlayerOne ? match.playerTwo : match.playerOne;
      const userScore = isPlayerOne ? match.scoreOne : match.scoreTwo;
      const opponentScore = isPlayerOne ? match.scoreTwo : match.scoreOne;

      return {
        id: match.id,
        startedAt: match.startedAt,
        finishedAt: match.finishedAt,
        status: match.status,
        opponent,
        userScore,
        opponentScore,
        didWin: match.winnerId === userId,
        winner: match.winner,
        settings: match.settingsJson,
        tournamentMatchId: match.tournamentLink?.id,
      };
    });
  }
}
