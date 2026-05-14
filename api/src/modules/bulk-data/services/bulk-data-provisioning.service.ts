import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { normalizeProvisioningMsisdn } from 'src/modules/provisioning/utils/provisioning-msisdn.util';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import { ProvisioningService } from 'src/modules/provisioning/services/provisioning.service';
import { BulkBundleEntity, BulkTransactionEntity } from '../entities';

@Injectable()
export class BulkDataProvisioningService {
  constructor(private readonly provisioningService: ProvisioningService) {}

  provisionConfirmedPurchase(
    transaction: BulkTransactionEntity,
    bundle: BulkBundleEntity,
  ) {
    const startAt = new Date();
    const endAt = new Date(
      startAt.getTime() + bundle.validityDays * 24 * 60 * 60 * 1000,
    );
    const primaryMsisdn = normalizeProvisioningMsisdn(
      transaction.primaryMsisdn,
    );

    return this.provisioningService.subscribeService(this.systemActor(), {
      msisdn: primaryMsisdn,
      serviceCode: bundle.serviceCode,
      startDateTime: formatPcrfDateTime(startAt),
      endDateTime: formatPcrfDateTime(endAt),
      transactionId: buildProvisioningTransactionId(transaction),
    });
  }

  removeSecondaryGroupMember(
    actor: AuthenticatedUser,
    secondaryMsisdn: string,
  ) {
    return this.provisioningService.deleteGroupMember(actor, {
      secondaryMsisdn: normalizeProvisioningMsisdn(secondaryMsisdn),
    });
  }

  private systemActor(): AuthenticatedUser {
    return {
      id: 'bulk-data-payment-provisioning',
      sub: 'bulk-data-payment-provisioning',
      email: 'system@bulk-data.local',
      roles: [UserRole.SUPER_ADMIN],
    };
  }
}

function buildProvisioningTransactionId(transaction: BulkTransactionEntity) {
  const numericId = transaction.id.replace(/\D/g, '') || Date.now().toString();
  return numericId;
}

function formatPcrfDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}
