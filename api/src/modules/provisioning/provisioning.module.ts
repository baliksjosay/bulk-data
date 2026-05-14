import { Module } from '@nestjs/common';
import { PcrfProvisioningAdapter } from './adapters/pcrf-provisioning.adapter';
import { PROVISIONING_SYSTEM_ADAPTER } from './interfaces/provisioning-system-adapter.interface';
import { ProvisioningService } from './services/provisioning.service';

@Module({
  providers: [
    ProvisioningService,
    PcrfProvisioningAdapter,
    {
      provide: PROVISIONING_SYSTEM_ADAPTER,
      useExisting: PcrfProvisioningAdapter,
    },
  ],
  exports: [ProvisioningService, PROVISIONING_SYSTEM_ADAPTER],
})
export class ProvisioningModule {}
