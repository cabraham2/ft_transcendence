import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const userSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  preferredLanguage: true,
  isOnline: true,
  lastSeenAt: true,
  wins: true,
  losses: true,
  elo: true,
  xp: true,
  level: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  getCurrentUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...userSelect,
        gameSettings: true,
      },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...userSelect,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Record<string, string | null> = {};

    if (dto.username) {
      const normalized = dto.username.trim().toLowerCase();
      const existing = await this.prisma.user.findFirst({
        where: {
          username: normalized,
          NOT: { id: userId },
        },
      });

      if (existing) {
        throw new ConflictException('Username is already taken.');
      }

      data.username = normalized;
    }

    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName.trim();
    }

    if (dto.bio !== undefined) {
      data.bio = dto.bio.trim();
    }

    if (dto.preferredLanguage) {
      data.preferredLanguage = dto.preferredLanguage;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        ...userSelect,
        gameSettings: true,
      },
    });
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        ...userSelect,
        gameSettings: true,
      },
    });
  }

  async setOnlineStatus(userId: string, isOnline: boolean) {
    await this.prisma.user
      .update({
        where: { id: userId },
        data: {
          isOnline,
          lastSeenAt: isOnline ? undefined : new Date(),
        },
      })
      .catch(() => undefined);
  }

  async searchUsers(dto: SearchUsersDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const sortBy = dto.sortBy ?? 'elo';
    const order = dto.order ?? 'desc';
    const query = dto.q?.trim();

    const where: Prisma.UserWhereInput = {
      AND: [
        query
          ? {
              OR: [
                { username: { contains: query, mode: 'insensitive' } },
                {
                  displayName: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {},
        dto.minElo !== undefined ? { elo: { gte: dto.minElo } } : {},
        dto.maxElo !== undefined ? { elo: { lte: dto.maxElo } } : {},
        dto.onlineOnly === 'true' ? { isOnline: true } : {},
      ],
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          [sortBy]: order,
        },
        select: userSelect,
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      filters: {
        q: query ?? null,
        sortBy,
        order,
        minElo: dto.minElo ?? null,
        maxElo: dto.maxElo ?? null,
        onlineOnly: dto.onlineOnly === 'true',
      },
    };
  }
}
