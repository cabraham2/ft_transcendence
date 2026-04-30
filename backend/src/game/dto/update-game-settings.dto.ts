import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { MatchSettingsInput } from '../game.types';

export class UpdateGameSettingsDto implements MatchSettingsInput {
  @ApiPropertyOptional({ enum: ['classic', 'neon', 'sunset'] })
  @IsOptional()
  @IsIn(['classic', 'neon', 'sunset'])
  theme?: string;

  @ApiPropertyOptional({ enum: ['arena', 'space', 'grid'] })
  @IsOptional()
  @IsIn(['arena', 'space', 'grid'])
  map?: string;

  @ApiPropertyOptional({ minimum: 80, maximum: 180 })
  @IsOptional()
  @IsNumber()
  @Min(80)
  @Max(180)
  paddleSize?: number;

  @ApiPropertyOptional({ minimum: 4, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(4)
  @Max(10)
  ballSpeed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  powerUpsEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 5, maximum: 21 })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(21)
  winningScore?: number;
}
