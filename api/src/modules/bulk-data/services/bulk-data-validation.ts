import { BadRequestException } from '@nestjs/common';
import { PaymentMethod } from '../dto/bulk-data.dto';

export function assertPaymentOptions(
  method: PaymentMethod,
  options: { prnProvider?: string; payingMsisdn?: string },
) {
  if (method === PaymentMethod.MOBILE_MONEY && !options.payingMsisdn) {
    throw new BadRequestException(
      'payingMsisdn is required for mobile money payments',
    );
  }

  if (method === PaymentMethod.PRN && !options.prnProvider) {
    throw new BadRequestException('prnProvider is required for PRN payments');
  }
}
