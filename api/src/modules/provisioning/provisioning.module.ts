import { Module } from '@nestjs/common';
import { PcrfProvisioningAdapter } from './adapters/pcrf-provisioning.adapter';
import { ProvisioningController } from './controllers/provisioning.controller';
import { PROVISIONING_SYSTEM_ADAPTER } from './interfaces/provisioning-system-adapter.interface';
import { ProvisioningService } from './services/provisioning.service';

@Module({
  controllers: [ProvisioningController],
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
