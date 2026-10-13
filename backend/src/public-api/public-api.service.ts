import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHighlightDto } from './dto/create-highlight.dto';
import { UpdateHighlightDto } from './dto/update-highlight.dto';

@Injectable()
export class PublicApiService {
  constructor(private readonly prisma: PrismaService) {}

  listHighlights() {
    return this.prisma.publicHighlight.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  getHighlight(highlightId: string) {
    return this.prisma.publicHighlight.findUnique({
      where: { id: highlightId },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  createHighlight(dto: CreateHighlightDto) {
    return this.prisma.publicHighlight.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        createdById: dto.createdById,
      },
    });
  }

  async updateHighlight(highlightId: string, dto: UpdateHighlightDto) {
    const existing = await this.prisma.publicHighlight.findUnique({
      where: { id: highlightId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Highlight not found.');
    }

    return this.prisma.publicHighlight.update({
      where: { id: highlightId },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
      },
    });
  }

  async deleteHighlight(highlightId: string) {
    const deleted = await this.prisma.publicHighlight.deleteMany({
      where: { id: highlightId },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Highlight not found.');
    }

    return { deleted: true };
  }
}
