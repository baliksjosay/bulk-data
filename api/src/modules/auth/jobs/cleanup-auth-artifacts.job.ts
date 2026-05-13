import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PasswordResetService } from '../services/core/password-reset.service';
import { EmailVerificationService } from '../services/core/email-verification.service';
import { PhoneVerificationService } from '../services/core/phone-verification.service';
import { ActivationService } from '../services/core/activation.service';

/**
 * Periodically cleans up expired and used authentication artifacts.
 */
@Injectable()
export class CleanupAuthArtifactsJob {
  private readonly logger = new Logger(CleanupAuthArtifactsJob.name);

  constructor(
    private readonly passwordResetService: PasswordResetService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly phoneVerificationService: PhoneVerificationService,
    private readonly activationService: ActivationService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handle(): Promise<void> {
    const [resetCount, emailCount, phoneCount, activationCount] =
      await Promise.all([
        this.passwordResetService.cleanupExpiredTokens(),
        this.emailVerificationService.cleanupExpiredTokens(),
        this.phoneVerificationService.cleanupExpiredOtps(),
        this.activationService.cleanupExpiredActivationChallenges(),
      ]);

    this.logger.log(
      `Auth cleanup completed: reset=${resetCount}, email=${emailCount}, phone=${phoneCount}, activation=${activationCount}`,
    );
  }
}
