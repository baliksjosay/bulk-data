import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { MfaService } from '../services/mfa/mfa.service';
import { MfaMethod } from '../enums/mfa-method.enum';
import { SecurityAuditService } from '../services/security/security-audit.service';
import { SecurityEventType } from '../enums/security-event-type.enum';
import { TotpSetupService } from '../services/mfa/totp-setup.service';
import { GenerateTotpSetupDto } from '../dto/mfa/generate-totp-setup.dto';
import { VerifyTotpSetupDto } from '../dto/mfa/verify-totp-setup.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { VerifyMfaChallengeDto } from '../dto/mfa/verify-mfa-challenge.dto';
import { MfaFactorSelectorService } from '../services/mfa/mfa-factor-selector.service';

@ApiTags('Authentication - MFA')
@ApiBearerAuth()
@Controller('auth/mfa')
export class MfaController {
  constructor(
    private readonly mfaService: MfaService,
    private readonly securityAuditService: SecurityAuditService,
    private readonly totpSetupService: TotpSetupService,
    private readonly mfaFactorSelectorService: MfaFactorSelectorService,
  ) {}

  @Post('totp/setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Begin TOTP setup',
  })
  @ApiOkResponse({
    description: 'TOTP setup initialized successfully.',
  })
  async beginTotpSetup(
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateTotpSetupDto,
  ) {
    return this.totpSetupService.beginSetup(userId, dto.label);
  }

  @Post('totp/setup/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify TOTP setup',
  })
  @ApiOkResponse({
    description: 'TOTP setup verified and enabled successfully.',
  })
  async verifyTotpSetup(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyTotpSetupDto,
  ) {
    await this.totpSetupService.verifySetup(userId, dto.challengeId, dto.code);

    return { message: 'TOTP MFA enabled successfully' };
  }

  @Delete('totp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disable TOTP MFA',
  })
  @ApiOkResponse({
    description: 'TOTP MFA disabled successfully.',
  })
  async disableTotp(@CurrentUser('id') userId: string) {
    await this.totpSetupService.disableTotp(userId);
    return { message: 'TOTP MFA disabled successfully' };
  }

  @Post('challenge/totp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create TOTP MFA challenge',
  })
  @ApiOkResponse({
    description: 'MFA challenge created successfully.',
  })
  async createTotpChallenge(@CurrentUser('id') userId: string) {
    const result = await this.mfaService.createChallenge(
      MfaMethod.TOTP,
      userId,
    );

    await this.securityAuditService.log({
      eventType: SecurityEventType.MFA_CHALLENGE_STARTED,
      userId,
      success: true,
      authMethod: 'MFA',
      metadata: { method: MfaMethod.TOTP, challengeId: result.challengeId },
    });

    return result;
  }

  @Post('verify/totp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify TOTP MFA challenge',
  })
  @ApiOkResponse({
    description: 'MFA challenge verified.',
  })
  async verifyTotpChallenge(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyMfaChallengeDto,
  ) {
    const result = await this.mfaService.verifyChallenge(
      MfaMethod.TOTP,
      userId,
      dto.challengeId,
      dto.response,
    );

    await this.securityAuditService.log({
      eventType: result.success
        ? SecurityEventType.MFA_CHALLENGE_PASSED
        : SecurityEventType.MFA_CHALLENGE_FAILED,
      userId,
      success: result.success,
      reason: result.reason,
      authMethod: 'MFA',
      metadata: { method: MfaMethod.TOTP, challengeId: dto.challengeId },
    });

    return result;
  }

  @Get('methods')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List enabled MFA methods for current user',
  })
  @ApiOkResponse({
    description: 'Enabled MFA methods retrieved successfully.',
  })
  async getEnabledMethods(@CurrentUser('id') userId: string) {
    const methods =
      await this.mfaFactorSelectorService.getEnabledMethods(userId);
    return { methods };
  }
}
