import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateHighlightDto {
  @ApiProperty({ example: 'Spring Tournament Finals' })
  @IsString()
  @Length(3, 80)
  title!: string;

  @ApiProperty({ example: 'A dramatic 11-9 comeback in the final set.' })
  @IsString()
  @Length(5, 500)
  description!: string;

  @ApiPropertyOptional({ example: 'cmabc123...' })
  @IsOptional()
  @IsString()
  createdById?: string;
}
