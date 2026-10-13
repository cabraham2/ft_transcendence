import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'player@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'pong_master' })
  @IsString()
  @Length(3, 24)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'Username must use lowercase letters, numbers, and underscores only.',
  })
  username!: string;

  @ApiProperty({ example: 'Secur3P@ss!' })
  @IsString()
  @Length(8, 72)
  password!: string;

  @ApiPropertyOptional({ enum: ['en', 'fr', 'es'], example: 'fr' })
  @IsString()
  @IsIn(['en', 'fr', 'es'])
  preferredLanguage?: string;
}
