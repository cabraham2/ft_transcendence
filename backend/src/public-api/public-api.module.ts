import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { PublicApiRateLimitGuard } from '../common/guards/public-api-rate-limit.guard';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';

@Module({
  imports: [PrismaModule],
  controllers: [PublicApiController],
  providers: [PublicApiService, ApiKeyGuard, PublicApiRateLimitGuard],
})
export class PublicApiModule {}
