import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import type { MatchSettingsInput } from '../../game/game.types';

export class CreateTournamentDto {
  @ApiProperty({ example: 'Spring Cup' })
  @IsString()
  @Length(3, 60)
  name!: string;

  @ApiPropertyOptional({ example: 8, enum: [4, 8, 16] })
  @IsOptional()
  @IsNumber()
  @IsIn([4, 8, 16])
  maxPlayers?: number;

  @ApiPropertyOptional({
    type: Object,
    example: {
      theme: 'neon',
      map: 'arena',
      paddleSize: 120,
      ballSpeed: 6,
      powerUpsEnabled: false,
      winningScore: 11,
    },
  })
  @IsOptional()
  @IsObject()
  settings?: MatchSettingsInput;
}

export class TournamentMatchmakingFilterDto {
  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;
}
