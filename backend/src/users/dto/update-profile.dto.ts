import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'pong_player' })
  @IsOptional()
  @IsString()
  @Length(3, 24)
  @Matches(/^[a-z0-9_]+$/)
  username?: string;

  @ApiPropertyOptional({ example: 'Pong Master' })
  @IsOptional()
  @IsString()
  @Length(2, 40)
  displayName?: string;

  @ApiPropertyOptional({ example: 'Loves real-time duels and tournaments.' })
  @IsOptional()
  @IsString()
  @Length(0, 300)
  bio?: string;

  @ApiPropertyOptional({ enum: ['en', 'fr', 'es'] })
  @IsOptional()
  @IsIn(['en', 'fr', 'es'])
  preferredLanguage?: string;
}
