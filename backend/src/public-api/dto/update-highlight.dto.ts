import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateHighlightDto {
  @ApiPropertyOptional({ example: 'Updated title' })
  @IsOptional()
  @IsString()
  @Length(3, 80)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description text.' })
  @IsOptional()
  @IsString()
  @Length(5, 500)
  description?: string;
}
