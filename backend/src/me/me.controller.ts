import { Body, Controller, Delete, Get, HttpCode, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard, UserId } from '../auth/auth.guard.ts';
import {
  BatchResultDto,
  ConsentBatchDto,
  FocusSessionBatchDto,
  GymAttemptBatchDto,
  GymWorkoutBatchDto,
  PageQueryDto,
  PutSettingsDto,
  SettingsDto,
} from './dto.ts';
import { MeService } from './me.service.ts';

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  profile(@UserId() userId: string) {
    return this.me.profile(userId);
  }

  @Delete()
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'The account and everything stored for it are deleted.' })
  async remove(@UserId() userId: string) {
    await this.me.deleteAccount(userId);
  }

  @Get('export')
  export(@UserId() userId: string) {
    return this.me.export(userId);
  }

  @Get('settings')
  @ApiOkResponse({ type: SettingsDto })
  getSettings(@UserId() userId: string) {
    return this.me.getSettings(userId);
  }

  @Put('settings')
  @ApiConflictResponse({ description: 'Stale baseVersion; the current version is in error.details' })
  putSettings(@UserId() userId: string, @Body() body: PutSettingsDto) {
    return this.me.putSettings(userId, body.data, body.baseVersion);
  }

  @Get('consents')
  listConsents(@UserId() userId: string) {
    return this.me.listConsents(userId);
  }

  @Post('consents')
  @HttpCode(200)
  @ApiOkResponse({ type: BatchResultDto })
  addConsents(@UserId() userId: string, @Body() body: ConsentBatchDto) {
    return this.me.addConsents(userId, body.items);
  }

  @Get('focus-sessions')
  listFocus(@UserId() userId: string, @Query() q: PageQueryDto) {
    return this.me.listFocus(userId, q);
  }

  @Post('focus-sessions')
  @HttpCode(200)
  @ApiOkResponse({ type: BatchResultDto })
  upsertFocus(@UserId() userId: string, @Body() body: FocusSessionBatchDto) {
    return this.me.upsertFocus(userId, body.items);
  }

  @Get('gym/attempts')
  listAttempts(@UserId() userId: string, @Query() q: PageQueryDto) {
    return this.me.listAttempts(userId, q);
  }

  @Post('gym/attempts')
  @HttpCode(200)
  @ApiOkResponse({ type: BatchResultDto })
  addAttempts(@UserId() userId: string, @Body() body: GymAttemptBatchDto) {
    return this.me.addAttempts(userId, body.items);
  }

  @Get('gym/workouts')
  listWorkouts(@UserId() userId: string) {
    return this.me.listWorkouts(userId);
  }

  @Post('gym/workouts')
  @HttpCode(200)
  @ApiOkResponse({ type: BatchResultDto })
  upsertWorkouts(@UserId() userId: string, @Body() body: GymWorkoutBatchDto) {
    return this.me.upsertWorkouts(userId, body.items);
  }
}
