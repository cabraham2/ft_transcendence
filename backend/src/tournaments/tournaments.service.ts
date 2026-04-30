import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TournamentMatchStatus,
  TournamentStatus,
} from '@prisma/client';
import { normalizeMatchSettings } from '../game/game.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  listTournaments() {
    return this.prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        champion: {
          select: {
            id: true,
            username: true,
          },
        },
        _count: {
          select: {
            participants: true,
            matches: true,
          },
        },
      },
    });
  }

  async getTournament(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        champion: {
          select: {
            id: true,
            username: true,
          },
        },
        participants: {
          orderBy: { seed: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                elo: true,
              },
            },
          },
        },
        matches: {
          orderBy: [{ round: 'asc' }, { position: 'asc' }],
          include: {
            playerOne: {
              select: { id: true, username: true },
            },
            playerTwo: {
              select: { id: true, username: true },
            },
            winner: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found.');
    }

    return tournament;
  }

  async createTournament(userId: string, dto: CreateTournamentDto) {
    const maxPlayers = dto.maxPlayers ?? 8;
    const settings = normalizeMatchSettings(dto.settings);

    return this.prisma.tournament.create({
      data: {
        name: dto.name.trim(),
        createdById: userId,
        maxPlayers,
        settingsJson: settings as unknown as Prisma.InputJsonValue,
      },
      include: {
        createdBy: {
          select: { id: true, username: true },
        },
      },
    });
  }

  async registerForTournament(userId: string, tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: true,
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found.');
    }

    if (tournament.status !== TournamentStatus.OPEN) {
      throw new BadRequestException(
        'Tournament registration is closed for this bracket.',
      );
    }

    if (tournament.participants.length >= tournament.maxPlayers) {
      throw new BadRequestException('Tournament is already full.');
    }

    const alreadyRegistered = tournament.participants.some(
      (participant) => participant.userId === userId,
    );

    if (alreadyRegistered) {
      return { alreadyRegistered: true };
    }

    const seed = tournament.participants.length + 1;

    return this.prisma.tournamentParticipant.create({
      data: {
        tournamentId,
        userId,
        seed,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            elo: true,
          },
        },
      },
    });
  }

  async startTournament(userId: string, tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: true,
        matches: {
          select: { id: true },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found.');
    }

    if (tournament.createdById !== userId) {
      throw new ForbiddenException('Only the tournament creator can start it.');
    }

    if (tournament.status !== TournamentStatus.OPEN) {
      throw new BadRequestException('Tournament already started.');
    }

    const participantCount = tournament.participants.length;
    if (participantCount < 2) {
      throw new BadRequestException(
        'At least two players are required to start the tournament.',
      );
    }

    if (!isPowerOfTwo(participantCount)) {
      throw new BadRequestException(
        'Participant count must be a power of two (2, 4, 8, 16).',
      );
    }

    if (tournament.matches.length > 0) {
      throw new BadRequestException(
        'Tournament bracket already exists for this tournament.',
      );
    }

    const shuffledParticipants = [...tournament.participants];
    shuffle(shuffledParticipants);

    const rounds = Math.log2(participantCount);
    const matchRows: Array<{
      tournamentId: string;
      round: number;
      position: number;
      playerOneId: string | null;
      playerTwoId: string | null;
      status: TournamentMatchStatus;
    }> = [];

    for (let round = 1; round <= rounds; round += 1) {
      const matchesInRound = participantCount / 2 ** round;
      for (let position = 1; position <= matchesInRound; position += 1) {
        if (round === 1) {
          const firstIndex = (position - 1) * 2;
          const playerOne = shuffledParticipants[firstIndex];
          const playerTwo = shuffledParticipants[firstIndex + 1];
          matchRows.push({
            tournamentId: tournament.id,
            round,
            position,
            playerOneId: playerOne.userId,
            playerTwoId: playerTwo.userId,
            status: TournamentMatchStatus.PENDING,
          });
        } else {
          matchRows.push({
            tournamentId: tournament.id,
            round,
            position,
            playerOneId: null,
            playerTwoId: null,
            status: TournamentMatchStatus.PENDING,
          });
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tournament.update({
        where: { id: tournament.id },
        data: {
          status: TournamentStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });

      await tx.tournamentMatch.createMany({
        data: matchRows,
      });
    });

    return this.getTournament(tournament.id);
  }

  async nextPendingMatchForUser(userId: string, tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found.');
    }

    const nextMatch = await this.prisma.tournamentMatch.findFirst({
      where: {
        tournamentId,
        status: TournamentMatchStatus.PENDING,
        OR: [{ playerOneId: userId }, { playerTwoId: userId }],
      },
      orderBy: [{ round: 'asc' }, { position: 'asc' }],
      include: {
        playerOne: {
          select: { id: true, username: true },
        },
        playerTwo: {
          select: { id: true, username: true },
        },
      },
    });

    if (!nextMatch) {
      return { available: false };
    }

    return {
      available: true,
      match: nextMatch,
    };
  }

  async markMatchLive(tournamentMatchId: string, linkedMatchId: string) {
    await this.prisma.tournamentMatch.update({
      where: { id: tournamentMatchId },
      data: {
        status: TournamentMatchStatus.LIVE,
        linkedMatchId,
        startedAt: new Date(),
      },
    });
  }

  async resolveMatchFromGame(
    tournamentMatchId: string,
    winnerId: string,
    linkedMatchId: string,
  ) {
    const tournamentMatch = await this.prisma.tournamentMatch.findUnique({
      where: { id: tournamentMatchId },
      include: {
        tournament: true,
      },
    });

    if (!tournamentMatch) {
      throw new NotFoundException('Tournament match not found.');
    }

    if (tournamentMatch.status === TournamentMatchStatus.FINISHED) {
      return this.getTournament(tournamentMatch.tournamentId);
    }

    if (
      tournamentMatch.playerOneId !== winnerId &&
      tournamentMatch.playerTwoId !== winnerId
    ) {
      throw new BadRequestException('Winner does not belong to this match.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tournamentMatch.update({
        where: { id: tournamentMatch.id },
        data: {
          winnerId,
          linkedMatchId,
          status: TournamentMatchStatus.FINISHED,
          finishedAt: new Date(),
        },
      });

      const nextMatch = await tx.tournamentMatch.findUnique({
        where: {
          tournamentId_round_position: {
            tournamentId: tournamentMatch.tournamentId,
            round: tournamentMatch.round + 1,
            position: Math.ceil(tournamentMatch.position / 2),
          },
        },
      });

      if (!nextMatch) {
        await tx.tournament.update({
          where: { id: tournamentMatch.tournamentId },
          data: {
            championId: winnerId,
            status: TournamentStatus.FINISHED,
            finishedAt: new Date(),
          },
        });
        return;
      }

      const isLeftSide = tournamentMatch.position % 2 === 1;
      const updateData = isLeftSide
        ? { playerOneId: winnerId }
        : { playerTwoId: winnerId };

      await tx.tournamentMatch.update({
        where: { id: nextMatch.id },
        data: updateData,
      });
    });

    return this.getTournament(tournamentMatch.tournamentId);
  }
}

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

function shuffle<T>(array: T[]) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
