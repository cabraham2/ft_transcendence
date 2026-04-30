import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpdateGameSettingsDto } from './dto/update-game-settings.dto';
import { GameService } from './game.service';

@ApiTags('game')
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get('settings/default')
  @ApiOperation({ summary: 'Get default game customization settings' })
  defaults() {
    return this.gameService.defaultSettings();
  }

  @Get('settings/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user game settings' })
  mine(@CurrentUser() user: JwtPayload) {
    return this.gameService.getUserSettings(user.sub);
  }

  @Put('settings/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user game settings' })
  updateMine(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateGameSettingsDto,
  ) {
    return this.gameService.updateUserSettings(user.sub, dto);
  }
}
