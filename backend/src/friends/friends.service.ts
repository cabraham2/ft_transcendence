import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const friendUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  isOnline: true,
  lastSeenAt: true,
  elo: true,
  level: true,
} as const;

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async listFriends(userId: string) {
    const entries = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { recipientId: userId }],
      },
      include: {
        requester: { select: friendUserSelect },
        recipient: { select: friendUserSelect },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return entries.map((entry) => {
      const friend =
        entry.requesterId === userId ? entry.recipient : entry.requester;
      return {
        friendshipId: entry.id,
        friend,
      };
    });
  }

  incomingRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: {
        recipientId: userId,
        status: FriendshipStatus.PENDING,
      },
      include: {
        requester: { select: friendUserSelect },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async requestFriendship(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new ConflictException('You cannot add yourself as a friend.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException('Target user not found.');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, recipientId: targetUserId },
          { requesterId: targetUserId, recipientId: userId },
        ],
      },
    });

    if (existing?.status === FriendshipStatus.ACCEPTED) {
      return { message: 'Already friends.' };
    }

    if (existing?.status === FriendshipStatus.PENDING) {
      if (existing.recipientId === userId) {
        return this.prisma.friendship.update({
          where: { id: existing.id },
          data: { status: FriendshipStatus.ACCEPTED },
        });
      }
      throw new ConflictException('Friend request already sent.');
    }

    return this.prisma.friendship.create({
      data: {
        requesterId: userId,
        recipientId: targetUserId,
        status: FriendshipStatus.PENDING,
      },
    });
  }

  async acceptRequest(userId: string, requestId: string) {
    const request = await this.prisma.friendship.findUnique({
      where: { id: requestId },
    });
    if (!request || request.recipientId !== userId) {
      throw new NotFoundException('Friend request not found.');
    }

    if (request.status !== FriendshipStatus.PENDING) {
      throw new ConflictException('This request is no longer pending.');
    }

    return this.prisma.friendship.update({
      where: { id: requestId },
      data: { status: FriendshipStatus.ACCEPTED },
    });
  }

  async removeFriend(userId: string, friendUserId: string) {
    const result = await this.prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: userId, recipientId: friendUserId },
          { requesterId: friendUserId, recipientId: userId },
        ],
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Friendship not found.');
    }

    return { removed: true };
  }
}
