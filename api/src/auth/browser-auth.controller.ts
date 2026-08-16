import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { assertBrowserCsrf } from '../common/auth/browser-cookie';
import { AuthService } from './auth.service';
import { BrowserSessionService } from './browser-session.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * Browser-only auth facade. It deliberately never serialises tokens: access and
 * refresh credentials are returned solely as HttpOnly cookies. Native clients
 * continue to use the bearer-token endpoints on AuthController.
 */
@Controller('auth/browser')
@UseGuards(ThrottlerGuard)
@SkipThrottle({ chat: true })
export class BrowserAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: BrowserSessionService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(dto);
    this.sessions.establish(response, result.tokens);
    return { user: result.user, emailDelivery: result.emailDelivery };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(dto);
    this.sessions.establish(response, result.tokens);
    return { user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    assertBrowserCsrf(request);
    const refreshToken = this.sessions.refreshToken(request);
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');
    const tokens = await this.auth.refresh({ refreshToken });
    this.sessions.establish(response, tokens);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    assertBrowserCsrf(request);
    const refreshToken = this.sessions.refreshToken(request);
    try {
      if (refreshToken) await this.auth.logout({ refreshToken });
    } finally {
      this.sessions.clear(response);
    }
  }
}
