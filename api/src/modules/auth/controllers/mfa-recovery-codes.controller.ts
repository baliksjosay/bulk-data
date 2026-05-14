import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { GenericAuthMessageDto } from '../dto/generic-authmessage.dto';
import { MfaRecoveryCodeService } from '../services/mfa/mfa-recovery-codes.service';
import {
  AcknowledgeRecoveryCodesDto,
  MfaRecoveryCodesResponseDto,
  MfaRecoveryStatusDto,
} from '../dto/mfa/mfa-recovery-codes.dto';

@ApiTags('Authentication - MFA Recovery')
@ApiBearerAuth()
@Controller('auth/mfa/recovery-codes')
export class MfaRecoveryCodeController {
  constructor(private readonly recoveryCodeService: MfaRecoveryCodeService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate MFA recovery codes',
    description:
      'Generates a new active batch of MFA recovery codes and revokes any prior active batch.',
  })
  @ApiOkResponse({
    type: MfaRecoveryCodesResponseDto,
  })
  async generate(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') email?: string,
  ): Promise<MfaRecoveryCodesResponseDto> {
    return this.recoveryCodeService.generateForUser(userId, email);
  }

  @Post('generate-txt')
  @HttpCode(HttpStatus.OK)
  async generateTxt(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') email: string,
  ): Promise<StreamableFile> {
    const generated = await this.recoveryCodeService.generateForUser(
      userId,
      email,
    );

    const content = [
      'MFA Recovery Codes',
      '',
      'Store these codes securely. Each code can be used once.',
      '',
      ...generated.codes,
      '',
    ].join('\n');

    const buffer = Buffer.from(content, 'utf-8');
    return new StreamableFile(buffer, {
      disposition: 'attachment; filename="mfa-recovery-codes.txt"',
      type: 'text/plain',
    });
  }

  @Post('acknowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Acknowledge saved recovery codes',
    description:
      'Marks the currently displayed recovery-code batch as acknowledged by the user.',
  })
  @ApiOkResponse({
    type: GenericAuthMessageDto,
  })
  async acknowledge(
    @CurrentUser('id') userId: string,
    @Body() dto: AcknowledgeRecoveryCodesDto,
  ): Promise<GenericAuthMessageDto> {
    await this.recoveryCodeService.acknowledgeBatch(userId, dto.batchId);
    return { message: 'Recovery codes acknowledged successfully.' };
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @CurrentUser('id') userId: string,
  ): Promise<GenericAuthMessageDto> {
    await this.recoveryCodeService.revokeActiveBatch(
      userId,
      'user_requested_revocation',
    );

    return { message: 'Recovery code batch revoked successfully.' };
  }

  @Get('status')
  @ApiOperation({
    summary: 'Get recovery code status',
    description:
      'Returns summary information about the active recovery-code batch.',
  })
  @ApiOkResponse({
    type: MfaRecoveryStatusDto,
  })
  async status(
    @CurrentUser('id') userId: string,
  ): Promise<MfaRecoveryStatusDto> {
    return this.recoveryCodeService.getStatus(userId);
  }
}
