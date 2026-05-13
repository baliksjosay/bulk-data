import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import { ListQueryDto, ReportTransactionQueryDto } from '../dto/bulk-data.dto';
import { BulkDataService } from '../services/bulk-data.service';

@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(RolesGuard)
@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly bulkDataService: BulkDataService) {}

  @Get('admin')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get admin report' })
  getAdminReport() {
    return this.bulkDataService.getAdminReport();
  }

  @Get('transactions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get transaction report' })
  getTransactionReport(@Query() query: ReportTransactionQueryDto) {
    return this.bulkDataService.getTransactionReport(query);
  }

  @Get('customer')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Get customer report' })
  getCustomerReport(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListQueryDto,
  ) {
    return this.bulkDataService.getCustomerReport(actor, query);
  }
}
