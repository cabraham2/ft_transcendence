import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'player@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Secur3P@ss!' })
  @IsString()
  @Length(8, 72)
  password!: string;
}
