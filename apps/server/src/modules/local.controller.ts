import { Body, Controller, Get, Headers, Inject, Param, Post, Req } from '@nestjs/common';
import { LEARNING_REPOSITORY, LearningRepository } from './learning.repository';
import { AiChatDto, LoginDto, RegisterDto, StartLabDto, SubmitFlagDto } from './request.dto';

type ClientRequest = { ip?: string; socket?: { remoteAddress?: string } };

@Controller()
export class LocalController {
  constructor(@Inject(LEARNING_REPOSITORY) private readonly store: LearningRepository) {}

  private user(authorization?: string) { return this.store.requireUser(authorization); }
  private optionalUser(authorization?: string) { return this.store.userFromAuthorization(authorization); }
  private clientKey(request?: ClientRequest) { return request?.ip || request?.socket?.remoteAddress || 'local'; }

  @Post('auth/login')
  async login(@Body() body: LoginDto, @Req() request: ClientRequest) {
    this.store.assertRateLimit('login', `${this.clientKey(request)}:${body.email.toLowerCase()}`, 8, 60_000);
    return this.store.login(body.email, body.password);
  }

  @Post('auth/register')
  async register(@Body() body: RegisterDto, @Req() request: ClientRequest) {
    this.store.assertRateLimit('register', this.clientKey(request), 5, 60_000);
    return this.store.register(body);
  }

  @Post('auth/logout') logout() { return { success: true }; }
  @Get('users/me') me(@Headers('authorization') authorization?: string) { return this.store.me(this.user(authorization)); }
  @Get('users/me/skills') userSkills(@Headers('authorization') authorization?: string) { return this.store.userSkills(this.user(authorization)); }
  @Get('challenges') challenges(@Headers('authorization') authorization?: string) { return this.store.listChallenges(this.optionalUser(authorization)); }
  @Get('challenges/:id') challenge(@Param('id') id: string, @Headers('authorization') authorization?: string) { return this.store.challengeDetail(id, this.optionalUser(authorization)); }
  @Get('challenges/:id/workspace') workspace(@Param('id') id: string, @Headers('authorization') authorization?: string) { return this.store.workspace(id, this.user(authorization)); }

  @Post('challenges/:id/submit')
  submit(@Param('id') id: string, @Body() body: SubmitFlagDto, @Headers('authorization') authorization?: string, @Req() request?: ClientRequest) {
    const user = this.user(authorization);
    this.store.assertRateLimit('flag', `${this.clientKey(request)}:${user.id}`, 12, 60_000);
    return this.store.submit(id, user, body.flag);
  }

  @Post('challenges/:id/hints/:hintId/unlock')
  unlockHint(@Param('id') id: string, @Param('hintId') hintId: string, @Headers('authorization') authorization?: string) { return this.store.unlockHint(id, hintId, this.user(authorization)); }

  @Post('labs/start') startLab(@Body() body: StartLabDto, @Headers('authorization') authorization?: string) { return this.store.startLab(this.user(authorization), body.challengeId); }
  @Get('labs/:id/status') labStatus(@Param('id') id: string, @Headers('authorization') authorization?: string) { return this.store.labStatus(id, this.user(authorization)); }
  @Post('labs/:id/refresh') refreshLab(@Param('id') id: string, @Headers('authorization') authorization?: string) { return this.store.refreshLab(id, this.user(authorization)); }
  @Post('labs/:id/stop') stopLab(@Param('id') id: string, @Headers('authorization') authorization?: string) { return this.store.stopLab(id, this.user(authorization)); }

  @Get('range/overview') range(@Headers('authorization') authorization?: string) { return this.store.rangeOverview(this.optionalUser(authorization)); }
  @Get('dashboard/stats') stats(@Headers('authorization') authorization?: string) { return this.store.dashboardStats(this.optionalUser(authorization)); }
  @Get('dashboard/events') events() { return this.store.dashboardEvents(); }
  @Get('leaderboard') leaderboard() { return this.store.leaderboard(); }
  @Get('skills') skills() { return this.store.skillGraph(); }
  @Get('learning/overview') learning(@Headers('authorization') authorization?: string) { return this.store.learningOverview(this.optionalUser(authorization)); }
  @Get('attack/scenario') attack() { return this.store.attackScenario(); }
  @Get('catalog/sources') catalogSources() { return this.store.catalogSources(); }

  @Post('ai/chat')
  ai(@Body() body: AiChatDto, @Headers('authorization') authorization?: string, @Req() request?: ClientRequest) {
    const user = this.user(authorization);
    this.store.assertRateLimit('ai', `${this.clientKey(request)}:${user.id}`, 20, 60_000);
    return this.store.aiChat(user, body.message, body.challengeId, body.hintLevel ?? 1);
  }
}
