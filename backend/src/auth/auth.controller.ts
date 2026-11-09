import { Body, Controller, HttpCode, Inject, Injectable, Post } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, Length } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.ts';
import { ID_TOKEN_VERIFIER, type IdTokenVerifier } from './google-verifier.ts';
import { TokensService } from './tokens.service.ts';
import { authLimit } from './rate-limit.ts';

export class GoogleSignInDto {
  @ApiProperty({ description: 'Google ID token from One Tap / Credential Manager' })
  @IsString()
  @Length(20, 4096)
  idToken!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  refreshToken!: string;
}

export class TokenPairDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ description: 'Seconds until the access token expires' }) expiresIn!: number;
}

export class SignInResultDto extends TokenPairDto {
  @ApiProperty() userId!: string;
  @ApiProperty({ description: 'True when this sign-in created the account' }) created!: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(ID_TOKEN_VERIFIER) private readonly verifier: IdTokenVerifier,
    private readonly db: PrismaService,
    private readonly tokens: TokensService,
  ) {}

  async signInWithGoogle(idToken: string): Promise<SignInResultDto> {
    const who = await this.verifier.verify(idToken);
    const existing = await this.db.user.findUnique({ where: { googleSub: who.sub } });
    const user = existing
      ? await this.db.user.update({ where: { id: existing.id }, data: { email: who.email } })
      : await this.db.user.create({ data: { googleSub: who.sub, email: who.email } });
    const pair = await this.tokens.issue(user.id);
    return { ...pair, userId: user.id, created: !existing };
  }
}

@ApiTags('auth')
@Controller('auth')
@Throttle(authLimit())
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
  ) {}

  @Post('google')
  @HttpCode(200)
  @ApiOkResponse({ type: SignInResultDto })
  signIn(@Body() body: GoogleSignInDto) {
    return this.auth.signInWithGoogle(body.idToken);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: TokenPairDto })
  refresh(@Body() body: RefreshDto) {
    return this.tokens.rotate(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() body: RefreshDto) {
    await this.tokens.revoke(body.refreshToken);
  }
}
