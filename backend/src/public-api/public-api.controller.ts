import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { PublicApiRateLimitGuard } from '../common/guards/public-api-rate-limit.guard';
import { CreateHighlightDto } from './dto/create-highlight.dto';
import { UpdateHighlightDto } from './dto/update-highlight.dto';
import { PublicApiService } from './public-api.service';

@ApiTags('public-api')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard, PublicApiRateLimitGuard)
@Controller('public/highlights')
export class PublicApiController {
  constructor(private readonly publicApiService: PublicApiService) {}

  @Get()
  @ApiOperation({ summary: 'List public highlights' })
  list() {
    return this.publicApiService.listHighlights();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one public highlight' })
  get(@Param('id') id: string) {
    return this.publicApiService.getHighlight(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a highlight' })
  create(@Body() dto: CreateHighlightDto) {
    return this.publicApiService.createHighlight(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a highlight' })
  update(@Param('id') id: string, @Body() dto: UpdateHighlightDto) {
    return this.publicApiService.updateHighlight(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a highlight' })
  remove(@Param('id') id: string) {
    return this.publicApiService.deleteHighlight(id);
  }
}
