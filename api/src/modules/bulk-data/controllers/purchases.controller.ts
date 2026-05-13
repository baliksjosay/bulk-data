import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import {
  PurchaseConfirmationDto,
  PurchaseDto,
  PurchaseRetryDto,
} from '../dto/bulk-data.dto';
import { BulkDataService } from '../services/bulk-data.service';

@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(RolesGuard)
@ApiTags('Purchases')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly bulkDataService: BulkDataService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Initiate package purchase' })
  createPurchase(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: PurchaseDto,
  ) {
    return this.bulkDataService.createPurchase(actor, dto);
  }

  @Post(':transactionId/retry')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Retry failed purchase' })
  retryPurchase(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('transactionId') transactionId: string,
    @Body() dto: PurchaseRetryDto,
  ) {
    return this.bulkDataService.retryPurchase(actor, transactionId, dto);
  }

  @Post(':transactionId/confirmation')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Confirm payment and provisioning state' })
  confirmPurchase(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('transactionId') transactionId: string,
    @Body() dto: PurchaseConfirmationDto,
  ) {
    return this.bulkDataService.confirmPurchase(actor, transactionId, dto);
  }
}
