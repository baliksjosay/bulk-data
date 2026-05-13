import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import { ListQueryDto } from '../dto/bulk-data.dto';
import { BulkDataService } from '../services/bulk-data.service';

@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(RolesGuard)
@ApiTags('Audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly bulkDataService: BulkDataService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'List audit events' })
  listAuditEvents(@Query() query: ListQueryDto) {
    return this.bulkDataService.listAuditEvents(query);
  }
}
