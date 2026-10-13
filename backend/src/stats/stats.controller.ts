import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { StatsService } from './stats.service';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('leaderboard')
  @ApiOperation({ summary: 'Leaderboard sorted by ELO' })
  leaderboard(@Query('limit') limit?: string) {
    return this.statsService.leaderboard(Number(limit ?? 25));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user stats and achievements' })
  me(@CurrentUser() user: JwtPayload) {
    return this.statsService.myStats(user.sub);
  }

  @Get('me/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user match history' })
  myHistory(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.statsService.history(user.sub, Number(limit ?? 20));
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get public stats for a user' })
  userStats(@Param('id') userId: string) {
    return this.statsService.userStats(userId);
  }

  @Get('users/:id/history')
  @ApiOperation({ summary: 'Get public match history for a user' })
  userHistory(@Param('id') userId: string, @Query('limit') limit?: string) {
    return this.statsService.history(userId, Number(limit ?? 20));
  }
}
