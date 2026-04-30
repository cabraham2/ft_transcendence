import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { assertStrongPassword } from '../common/utils/password-policy';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  preferredLanguage: true,
  isOnline: true,
  lastSeenAt: true,
  wins: true,
  losses: true,
  elo: true,
  xp: true,
  level: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedUsername = dto.username.trim().toLowerCase();

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { username: normalizedUsername }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Email or username is already in use.');
    }

    assertStrongPassword(dto.password);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        passwordHash,
        preferredLanguage: dto.preferredLanguage ?? 'en',
        gameSettings: {
          create: {},
        },
      },
      select: publicUserSelect,
    });

    return {
      accessToken: this.signToken(user.id, user.email, user.username),
      user,
    };
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordIsValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordIsValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const publicUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: publicUserSelect,
    });

    if (!publicUser) {
      throw new UnauthorizedException('Unable to load user profile.');
    }

    return {
      accessToken: this.signToken(
        publicUser.id,
        publicUser.email,
        publicUser.username,
      ),
      user: publicUser,
    };
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...publicUserSelect,
        gameSettings: true,
      },
    });
  }

  private signToken(userId: string, email: string, username: string): string {
    return this.jwtService.sign({
      sub: userId,
      email,
      username,
    });
  }
}
