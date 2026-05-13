import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';

import { AuthService } from '../services/core/auth.service';
import { LoginDto } from '../dto/login.dto';
import { OtpLoginDto } from '../dto/otp-login.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { SocialLoginDto } from '../dto/social-login.dto';
import { GoogleTokenVerifierService } from '../services/social/google-token-verifier.service';
import { MicrosoftTokenVerifierService } from '../services/social/microsoft-token-verifier.service';
import {
  ForgotPasswordDto,
  ForgotPasswordResponseDto,
} from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ActivateAccountDto } from '../dto/activate-account.dto';
import { CreatePasswordDto } from '../dto/create-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { VerifyPhoneOtpDto } from '../dto/verify-phone-otp.dto';
import { PasswordResetService } from '../services/core/password-reset.service';
import { ActivationService } from '../services/core/activation.service';
import { EmailVerificationService } from '../services/core/email-verification.service';
import { PhoneVerificationService } from '../services/core/phone-verification.service';
import { Public } from 'src/common/decorators/public.decorator';
import { RefreshTokenGuard } from 'src/common/guards/refresh-token.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { GenericAuthMessageDto } from '../dto/generic-authmessage.dto';
import { CompleteMfaLoginDto } from '../dto/complete-mfa-login.dto';
import { StartMfaLoginChallengeDto } from '../dto/start-mfa-login-challenge.dto';
import { WebauthnAuthenticationService } from '../services/webauthn/webauthn-authentication.service';

/**
 * Exposes authentication, recovery, activation, and verification endpoints.
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleTokenVerifierService: GoogleTokenVerifierService,
    private readonly microsoftTokenVerifierService: MicrosoftTokenVerifierService,
    private readonly passwordResetService: PasswordResetService,
    private readonly activationService: ActivationService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly phoneVerificationService: PhoneVerificationService,
    private readonly webauthnAuthenticationService: WebauthnAuthenticationService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate with email and password',
    description:
      'Authenticates an existing local account using email and password. On success, returns access token, refresh token, session identifier, and user payload.',
  })
  @ApiOkResponse({
    description: 'Authentication successful.',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials, locked account, or inactive account.',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthResponseDto> {
    return this.authService.loginWithPassword(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
      deviceId: dto.deviceId ?? undefined,
    });
  }

  @Post('login/otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate with OTP',
    description:
      'Authenticates an existing customer account using a one-time password issued to a known phone, email, or TIN identifier.',
  })
  @ApiOkResponse({
    description: 'Authentication successful.',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid identifier, OTP, or inactive account.',
  })
  async loginWithOtp(
    @Body() dto: OtpLoginDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthResponseDto> {
    return this.authService.loginWithOtp(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
      deviceId: dto.deviceId ?? undefined,
    });
  }

  @Post('refresh')
  @Public()
  @UseGuards(RefreshTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access and refresh tokens',
    description:
      'Validates the refresh token, rotates the session refresh token, and returns a fresh access token and refresh token.',
  })
  @ApiOkResponse({
    description: 'Tokens refreshed successfully.',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired refresh token.',
  })
  async refresh(
    @CurrentUser('id') userId: string,
    @Body() dto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    return this.authService.refresh(userId, dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout current session',
    description: 'Revokes the current authenticated session only.',
  })
  @ApiOkResponse({
    description: 'Current session revoked successfully.',
    type: GenericAuthMessageDto,
  })
  async logout(
    @CurrentUser('id') userId: string,
    @CurrentUser('sessionId') sessionId: string,
  ): Promise<GenericAuthMessageDto> {
    await this.authService.logout(sessionId, userId);
    return { message: 'Logged out successfully.' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout all sessions',
    description: 'Revokes all active sessions for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'All active sessions revoked successfully.',
    type: GenericAuthMessageDto,
  })
  async logoutAll(
    @CurrentUser('id') userId: string,
  ): Promise<GenericAuthMessageDto> {
    await this.authService.logoutAll(userId);
    return { message: 'All sessions revoked successfully.' };
  }

  @Post('login/google')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate with Google',
    description:
      'Authenticates with a verified Google identity token. Only pre-existing approved users are allowed.',
  })
  @ApiOkResponse({
    description: 'Authentication successful.',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'User does not exist, token invalid, or identity mismatch.',
  })
  async loginWithGoogle(
    @Body() dto: SocialLoginDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthResponseDto> {
    const verifiedProfile = await this.googleTokenVerifierService.verify(
      dto.idToken,
    );

    return this.authService.loginWithGoogleOrMicrosoft(
      dto.provider,
      verifiedProfile,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
        deviceId: dto.deviceId,
      },
    );
  }

  @Post('login/microsoft')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate with Microsoft',
    description:
      'Authenticates with a verified Microsoft identity token. Only pre-existing approved users are allowed.',
  })
  @ApiOkResponse({
    description: 'Authentication successful.',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'User does not exist, token invalid, or identity mismatch.',
  })
  async loginWithMicrosoft(
    @Body() dto: SocialLoginDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthResponseDto> {
    const verifiedProfile = await this.microsoftTokenVerifierService.verify(
      dto.idToken,
    );

    return this.authService.loginWithGoogleOrMicrosoft(
      dto.provider,
      verifiedProfile,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
        deviceId: dto.deviceId,
      },
    );
  }

  @Post('mfa/complete-login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete MFA-gated login',
    description:
      'Completes authentication after the initial login required MFA verification.',
  })
  @ApiOkResponse({
    description: 'MFA verified and final session tokens issued.',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid MFA challenge token or MFA verification failure.',
  })
  @ApiBadRequestResponse({
    description: 'Malformed MFA completion request.',
  })
  async completeMfaLogin(
    @Body() dto: CompleteMfaLoginDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthResponseDto> {
    return this.authService.completeMfaLogin(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
      deviceId: dto.deviceId ?? undefined,
    });
  }

  @Post('mfa/start-login-challenge')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start selected MFA login challenge',
    description:
      'Creates the MFA challenge only after the user selects an available factor.',
  })
  @ApiOkResponse({
    description: 'MFA challenge created for the selected factor.',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid MFA selection token or unavailable factor.',
  })
  async startMfaLoginChallenge(
    @Body() dto: StartMfaLoginChallengeDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthResponseDto> {
    return this.authService.startMfaLoginChallenge(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
      deviceId: dto.deviceId ?? undefined,
    });
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Accepts an email address and issues password reset instructions if the account exists. The response is intentionally generic.',
  })
  @ApiOkResponse({
    description: 'Password reset request accepted.',
    type: ForgotPasswordResponseDto,
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponseDto> {
    const result = await this.passwordResetService.requestReset(dto.email);

    /**
     * Deliver the token using your notifications/email pipeline here.
     * For now, the service has generated the token and expiry.
     */
    void result;

    return {
      message:
        'If the account exists, password reset instructions have been issued.',
    };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password',
    description:
      'Resets the password using a valid password reset token and revokes all active sessions.',
  })
  @ApiOkResponse({
    description: 'Password reset completed successfully.',
    type: GenericAuthMessageDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired password reset token.',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<GenericAuthMessageDto> {
    await this.passwordResetService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password reset completed successfully.' };
  }

  @Post('activate-account')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate account',
    description:
      'Activates a pending or invited account using a valid activation token.',
  })
  @ApiOkResponse({
    description: 'Account activated successfully.',
    type: GenericAuthMessageDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired activation token.',
  })
  async activateAccount(
    @Body() dto: ActivateAccountDto,
  ): Promise<GenericAuthMessageDto> {
    await this.activationService.activateAccount(dto.token);
    return { message: 'Account activated successfully.' };
  }

  @Post('create-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create password for invited account',
    description:
      'Creates the first password for an invited account and activates the account.',
  })
  @ApiOkResponse({
    description: 'Password created successfully.',
    type: GenericAuthMessageDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired activation token.',
  })
  async createPassword(
    @Body() dto: CreatePasswordDto,
  ): Promise<GenericAuthMessageDto> {
    await this.activationService.createPassword(dto.token, dto.password);
    return { message: 'Password created successfully.' };
  }

  @Post('send-email-verification')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send email verification',
    description:
      'Generates an email verification token for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Email verification issued successfully.',
    type: GenericAuthMessageDto,
  })
  async sendEmailVerification(
    @CurrentUser('id') userId: string,
  ): Promise<GenericAuthMessageDto> {
    await this.emailVerificationService.createVerificationToken(userId);

    /**
     * Deliver the verification token using your notifications/email pipeline here.
     */

    return { message: 'Email verification instructions issued successfully.' };
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email',
    description:
      'Marks the user email as verified using a valid email verification token.',
  })
  @ApiOkResponse({
    description: 'Email verified successfully.',
    type: GenericAuthMessageDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired email verification token.',
  })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
  ): Promise<GenericAuthMessageDto> {
    await this.emailVerificationService.verifyEmail(dto.token);
    return { message: 'Email verified successfully.' };
  }

  @Post('send-phone-otp')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send phone verification OTP',
    description: 'Issues a phone verification OTP for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Phone verification OTP issued successfully.',
    type: GenericAuthMessageDto,
  })
  async sendPhoneOtp(
    @CurrentUser('id') userId: string,
  ): Promise<GenericAuthMessageDto> {
    await this.phoneVerificationService.createOtp(userId);

    return { message: 'Phone verification OTP issued successfully.' };
  }

  @Post('verify-phone')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify phone number',
    description:
      'Validates a phone verification OTP for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Phone number verified successfully.',
    type: GenericAuthMessageDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired OTP.',
  })
  async verifyPhone(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyPhoneOtpDto,
  ): Promise<GenericAuthMessageDto> {
    await this.phoneVerificationService.verifyOtp(userId, dto.otp);
    return { message: 'Phone number verified successfully.' };
  }
}
