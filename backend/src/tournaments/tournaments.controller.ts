import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { TournamentsService } from './tournaments.service';

@ApiTags('tournaments')
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  @ApiOperation({ summary: 'List tournaments' })
  list() {
    return this.tournamentsService.listTournaments();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tournament details and bracket' })
  getOne(@Param('id') id: string) {
    return this.tournamentsService.getTournament(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a tournament' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTournamentDto) {
    return this.tournamentsService.createTournament(user.sub, dto);
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register current user in a tournament' })
  register(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tournamentsService.registerForTournament(user.sub, id);
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start tournament and generate bracket' })
  start(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tournamentsService.startTournament(user.sub, id);
  }

  @Get(':id/next-match')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Find next pending match for current user' })
  nextMatch(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tournamentsService.nextPendingMatchForUser(user.sub, id);
  }
}
