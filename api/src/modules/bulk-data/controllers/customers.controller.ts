import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
  CustomerRegistrationDto,
  CustomerStatusChangeDto,
  CustomerUpdateDto,
  ListQueryDto,
  PrimaryMsisdnDto,
  SecondaryBulkDto,
  SecondaryNumberDto,
} from '../dto/bulk-data.dto';
import { BulkDataService } from '../services/bulk-data.service';

@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(RolesGuard)
@ApiTags('Customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly bulkDataService: BulkDataService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'List customers' })
  listCustomers(@Query() query: ListQueryDto) {
    return this.bulkDataService.listCustomers(query);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Register customer' })
  registerCustomer(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CustomerRegistrationDto,
  ) {
    return this.bulkDataService.registerCustomer(actor, dto);
  }

  @Get(':customerId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Get customer account' })
  getCustomer(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('customerId') customerId: string,
  ) {
    return this.bulkDataService.getCustomer(actor, customerId);
  }

  @Patch(':customerId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update customer account' })
  updateCustomer(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body() dto: CustomerUpdateDto,
  ) {
    return this.bulkDataService.updateCustomer(actor, customerId, dto);
  }

  @Post(':customerId/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate or reactivate customer' })
  changeCustomerStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body() dto: CustomerStatusChangeDto,
  ) {
    return this.bulkDataService.changeCustomerStatus(actor, customerId, dto);
  }

  @Post(':customerId/primary-msisdns')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Add primary MSISDN' })
  addPrimaryMsisdn(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body() dto: PrimaryMsisdnDto,
  ) {
    return this.bulkDataService.addPrimaryMsisdn(actor, customerId, dto);
  }

  @Get(':customerId/primary-msisdns/:primaryMsisdn/balance')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Check bundle balance' })
  getBalance(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Param('primaryMsisdn') primaryMsisdn: string,
  ) {
    return this.bulkDataService.getBalance(actor, customerId, primaryMsisdn);
  }

  @Get(':customerId/primary-msisdns/:primaryMsisdn/secondary-numbers')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'List secondary numbers' })
  listSecondaryNumbers(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Param('primaryMsisdn') primaryMsisdn: string,
    @Query() query: ListQueryDto,
  ) {
    return this.bulkDataService.listSecondaryNumbers(
      actor,
      customerId,
      primaryMsisdn,
      query,
    );
  }

  @Post(':customerId/primary-msisdns/:primaryMsisdn/secondary-numbers')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Add secondary number' })
  addSecondaryNumber(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Param('primaryMsisdn') primaryMsisdn: string,
    @Body() dto: SecondaryNumberDto,
  ) {
    return this.bulkDataService.addSecondaryNumber(
      actor,
      customerId,
      primaryMsisdn,
      dto,
    );
  }

  @Post(':customerId/primary-msisdns/:primaryMsisdn/secondary-numbers/bulk')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Bulk upload secondary numbers' })
  addSecondaryNumbersBulk(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Param('primaryMsisdn') primaryMsisdn: string,
    @Body() dto: SecondaryBulkDto,
  ) {
    return this.bulkDataService.addSecondaryNumbersBulk(
      actor,
      customerId,
      primaryMsisdn,
      dto,
    );
  }

  @Delete(
    ':customerId/primary-msisdns/:primaryMsisdn/secondary-numbers/:secondaryMsisdn',
  )
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Remove secondary number' })
  removeSecondaryNumber(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Param('primaryMsisdn') primaryMsisdn: string,
    @Param('secondaryMsisdn') secondaryMsisdn: string,
  ) {
    return this.bulkDataService.removeSecondaryNumber(
      actor,
      customerId,
      primaryMsisdn,
      secondaryMsisdn,
    );
  }

  @Get(
    ':customerId/primary-msisdns/:primaryMsisdn/secondary-numbers/:secondaryMsisdn/usage',
  )
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Check secondary number usage' })
  getSecondaryUsage(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Param('primaryMsisdn') primaryMsisdn: string,
    @Param('secondaryMsisdn') secondaryMsisdn: string,
  ) {
    return this.bulkDataService.getSecondaryUsage(
      actor,
      customerId,
      primaryMsisdn,
      secondaryMsisdn,
    );
  }
}
