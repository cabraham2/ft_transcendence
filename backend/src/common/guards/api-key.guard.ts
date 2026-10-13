import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const incomingKey = request.headers['x-api-key'];
    const expectedKey = this.configService.get<string>('PUBLIC_API_KEY');

    if (!incomingKey || !expectedKey || incomingKey !== expectedKey) {
      throw new UnauthorizedException('Valid API key is required.');
    }

    return true;
  }
}
