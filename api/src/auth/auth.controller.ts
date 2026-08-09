import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthResponse, TokenPair } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto, Disable2faDto } from './dto/delete-account.dto';
import { Enable2faDto } from './dto/enable-2fa.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { SessionInfo } from './refresh-token.store';

/**
 * §10: rate limiting is mandatory here, not optional — Stage A publishes this
 * API to the open internet through Tailscale Funnel, so /auth/login is the
 * first thing a scanner will find. Limits come from env (AUTH_THROTTLE_*).
 */
@Controller('auth')
@UseGuards(ThrottlerGuard)
// Only the 'auth' throttler applies here — 'chat' is chat's cost guard.
@SkipThrottle({ chat: true })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto): Promise<TokenPair> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.authService.logout(dto);
  }

  /**
   * Always 200 with the same body, registered address or not — see the service.
   * The class-level throttle is what keeps this from being a mailbox oracle by
   * volume and from being a way to grind a six-digit code.
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(current.userId, dto.currentPassword, dto.newPassword);
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  async get2faStatus(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ enabled: boolean }> {
    return this.authService.get2faStatus(current.userId);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async enable2fa(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ secret: string; qrCodeUri: string }> {
    return this.authService.enable2fa(current.userId);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verify2fa(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: Enable2faDto,
  ): Promise<{ recoveryCodes: string[] }> {
    return this.authService.verifyAndActivate2fa(current.userId, dto.token);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disable2fa(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: Disable2faDto,
  ): Promise<{ message: string }> {
    return this.authService.disable2fa(current.userId, dto.password);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async listSessions(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<SessionInfo[]> {
    return this.authService.listSessions(current.userId);
  }

  @Post('sessions/revoke/:jti')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @CurrentUser() current: AuthenticatedUser,
    @Param('jti') jti: string,
  ): Promise<{ message: string }> {
    return this.authService.revokeSession(current.userId, jti);
  }

  @Post('sessions/revoke-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ count: number }> {
    return this.authService.revokeAllSessions(current.userId);
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
  ): Promise<{ message: string }> {
    return this.authService.deleteAccount(current.userId, dto.password);
  }

  @Post('verify-email')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    return this.authService.verifyEmail(current.userId, dto.token);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.authService.resendVerification(current.userId);
  }
}
