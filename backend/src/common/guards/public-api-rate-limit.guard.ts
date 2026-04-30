import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type CounterState = {
  count: number;
  resetAt: number;
};

@Injectable()
export class PublicApiRateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, CounterState>();

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      ip?: string;
      socket?: { remoteAddress?: string };
    }>();

    const limit = Number(this.configService.get('PUBLIC_API_RATE_LIMIT') ?? 60);
    const windowMs = Number(
      this.configService.get('PUBLIC_API_RATE_WINDOW_MS') ?? 60000,
    );

    const apiKey = request.headers['x-api-key'] ?? 'unknown-key';
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown-ip';
    const identity = `${apiKey}:${ip}`;
    const now = Date.now();

    const previous = this.counters.get(identity);
    if (!previous || previous.resetAt <= now) {
      this.counters.set(identity, { count: 1, resetAt: now + windowMs });
      this.cleanupExpired(now);
      return true;
    }

    if (previous.count >= limit) {
      throw new HttpException(
        'Public API rate limit exceeded. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    previous.count += 1;
    this.counters.set(identity, previous);
    this.cleanupExpired(now);

    return true;
  }

  private cleanupExpired(now: number): void {
    if (this.counters.size < 1000) {
      return;
    }

    for (const [identity, state] of this.counters.entries()) {
      if (state.resetAt <= now) {
        this.counters.delete(identity);
      }
    }
  }
}
