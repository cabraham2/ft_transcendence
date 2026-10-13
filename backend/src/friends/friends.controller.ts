import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { FriendsService } from './friends.service';

@ApiTags('friends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  @ApiOperation({ summary: 'List accepted friends with online status' })
  list(@CurrentUser() user: JwtPayload) {
    return this.friendsService.listFriends(user.sub);
  }

  @Get('requests/incoming')
  @ApiOperation({ summary: 'List incoming friend requests' })
  incoming(@CurrentUser() user: JwtPayload) {
    return this.friendsService.incomingRequests(user.sub);
  }

  @Post(':targetUserId/request')
  @ApiOperation({ summary: 'Send friend request to another user' })
  request(
    @CurrentUser() user: JwtPayload,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.friendsService.requestFriendship(user.sub, targetUserId);
  }

  @Post('requests/:requestId/accept')
  @ApiOperation({ summary: 'Accept a pending friend request' })
  accept(
    @CurrentUser() user: JwtPayload,
    @Param('requestId') requestId: string,
  ) {
    return this.friendsService.acceptRequest(user.sub, requestId);
  }

  @Delete(':friendUserId')
  @ApiOperation({ summary: 'Remove a friendship' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('friendUserId') friendUserId: string,
  ) {
    return this.friendsService.removeFriend(user.sub, friendUserId);
  }
}
