import {
  Body,
  Controller,
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
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import {
  ListQueryDto,
  ServiceRequestConversionDto,
  ServiceRequestDto,
  ServiceRequestUpdateDto,
} from '../dto/bulk-data.dto';
import { BulkDataService } from '../services/bulk-data.service';

@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(RolesGuard)
@ApiTags('Service Requests')
@Controller('service-requests')
export class ServiceRequestsController {
  constructor(private readonly bulkDataService: BulkDataService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'List service requests' })
  listServiceRequests(@Query() query: ListQueryDto) {
    return this.bulkDataService.listServiceRequests(query);
  }

  @Public()
  @Post()
  @ApiOperation({ summary: 'Submit public service request' })
  submitServiceRequest(@Body() dto: ServiceRequestDto) {
    return this.bulkDataService.submitServiceRequest(dto);
  }

  @Get(':serviceRequestId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get service request' })
  getServiceRequest(@Param('serviceRequestId') serviceRequestId: string) {
    return this.bulkDataService.getServiceRequest(serviceRequestId);
  }

  @Patch(':serviceRequestId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Update service request' })
  updateServiceRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('serviceRequestId') serviceRequestId: string,
    @Body() dto: ServiceRequestUpdateDto,
  ) {
    return this.bulkDataService.updateServiceRequest(
      actor,
      serviceRequestId,
      dto,
    );
  }

  @Post(':serviceRequestId/convert')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Convert service request to customer' })
  convertServiceRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('serviceRequestId') serviceRequestId: string,
    @Body() dto: ServiceRequestConversionDto,
  ) {
    return this.bulkDataService.convertServiceRequest(
      actor,
      serviceRequestId,
      dto,
    );
  }
}
