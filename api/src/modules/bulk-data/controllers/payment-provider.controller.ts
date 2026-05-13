import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { PaymentProviderCallbackDto } from '../dto/bulk-data.dto';
import { BulkDataService } from '../services/bulk-data.service';

@ApiTags('Payment Provider')
@Controller('payments')
export class PaymentProviderController {
  constructor(private readonly bulkDataService: BulkDataService) {}

  @Public()
  @Post('callback')
  @ApiOperation({ summary: 'Receive payment provider callback' })
  handlePaymentCallback(@Body() dto: PaymentProviderCallbackDto) {
    return this.bulkDataService.handlePaymentProviderCallback(dto);
  }

  @Public()
  @Get('provider-checkout/:sessionId')
  @Header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'",
  )
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary: 'Mock external provider checkout page for local card testing',
  })
  getProviderCheckout(@Param('sessionId') sessionId: string) {
    return this.bulkDataService.renderMockProviderCheckout(sessionId);
  }
}
