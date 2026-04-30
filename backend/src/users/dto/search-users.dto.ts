import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SearchUsersDto {
  @ApiPropertyOptional({ example: 'pong' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ['username', 'elo', 'wins', 'createdAt'] })
  @IsOptional()
  @IsIn(['username', 'elo', 'wins', 'createdAt'])
  sortBy?: 'username' | 'elo' | 'wins' | 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;

  @ApiPropertyOptional({ example: 900 })
  @IsOptional()
  @IsInt()
  minElo?: number;

  @ApiPropertyOptional({ example: 1400 })
  @IsOptional()
  @IsInt()
  maxElo?: number;

  @ApiPropertyOptional({ example: 'true' })
  @IsOptional()
  @IsBooleanString()
  onlineOnly?: string;
}
