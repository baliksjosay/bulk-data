import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';

import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

import { WebauthnRegistrationService } from '../services/webauthn/webauthn-registration.service';
import { WebauthnAuthenticationService } from '../services/webauthn/webauthn-authentication.service';
import { AuthService } from '../services/core/auth.service';

import { BeginWebauthnAuthenticationDto } from '../dto/webauthn/begin-webauthn-authentication.dto';
import { FinishWebauthnRegistrationDto } from '../dto/webauthn/finish-webauthn-registration.dto';
import { FinishWebauthnAuthenticationDto } from '../dto/webauthn/finish-webauthn-authentication.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';

/**
 * WebAuthn endpoints for:
 * - registration of passkeys/security keys
 * - direct passwordless WebAuthn login
 */
@ApiTags('Authentication - WebAuthn')
@Controller('auth/webauthn')
export class WebauthnController {
  constructor(
    private readonly webauthnRegistrationService: WebauthnRegistrationService,
    private readonly webauthnAuthenticationService: WebauthnAuthenticationService,
    private readonly authService: AuthService,
  ) {}

  @Post('registration/options')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Begin WebAuthn registration',
    description:
      'Generates registration options for the authenticated user to enroll passkeys or security keys.',
  })
  @ApiOkResponse({
    description: 'Registration options created successfully.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required.',
  })
  async beginRegistration(@CurrentUser('id') userId: string) {
    return this.webauthnRegistrationService.beginRegistration(userId);
  }

  @Post('registration/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Finish WebAuthn registration',
    description:
      'Verifies the browser attestation response and stores a WebAuthn credential for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'WebAuthn credential registered successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid registration attestation payload.',
  })
  async finishRegistration(
    @CurrentUser('id') userId: string,
    @Body() dto: FinishWebauthnRegistrationDto,
  ) {
    return this.webauthnRegistrationService.finishRegistration(
      userId,
      dto.attestation,
    );
  }

  @Get('credentials')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List WebAuthn credentials',
    description:
      'Lists passkeys and security keys registered to the authenticated user.',
  })
  @ApiOkResponse({
    description: 'WebAuthn credentials fetched successfully.',
  })
  async listCredentials(@CurrentUser('id') userId: string) {
    return this.webauthnRegistrationService.listCredentials(userId);
  }

  @Delete('credentials/:credentialId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke WebAuthn credential',
    description:
      'Revokes a passkey or security key registered to the authenticated user.',
  })
  @ApiOkResponse({
    description: 'WebAuthn credential revoked successfully.',
  })
  async revokeCredential(
    @CurrentUser('id') userId: string,
    @Param('credentialId') credentialId: string,
  ) {
    return this.webauthnRegistrationService.revokeCredential(
      userId,
      credentialId,
    );
  }

  @Public()
  @Post('authentication/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Begin WebAuthn authentication',
    description:
      'Generates authentication options for passwordless or direct WebAuthn login.',
  })
  @ApiOkResponse({
    description: 'Authentication options created successfully.',
  })
  @ApiBadRequestResponse({
    description: 'A valid email or userId is required.',
  })
  async beginAuthentication(@Body() dto: BeginWebauthnAuthenticationDto) {
    return this.webauthnAuthenticationService.beginAuthentication(dto);
  }

  @Public()
  @Post('authentication/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Finish WebAuthn authentication',
    description:
      'Verifies a browser assertion and, on success, creates an authenticated session and issues tokens.',
  })
  @ApiOkResponse({
    description: 'WebAuthn login completed successfully.',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid or malformed assertion payload.',
  })
  @ApiUnauthorizedResponse({
    description: 'WebAuthn verification failed or user cannot authenticate.',
  })
  async finishAuthentication(
    @Body() dto: FinishWebauthnAuthenticationDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthResponseDto> {
    return this.authService.loginWithWebauthn({
      assertion: dto.assertion,
      context: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      },
    });
  }
}
