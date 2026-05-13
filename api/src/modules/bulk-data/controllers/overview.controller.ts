import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OverviewQueryDto } from '../dto/bulk-data.dto';
import { BulkDataService } from '../services/bulk-data.service';

@ApiBearerAuth()
@ApiCookieAuth()
@ApiTags('Overview')
@Controller('overview')
export class OverviewController {
  constructor(private readonly bulkDataService: BulkDataService) {}

  @Get()
  @ApiOperation({
    summary: 'Get dashboard overview',
    description:
      'Returns dashboard metrics and analytics according to the frontend OpenAPI contract.',
  })
  getOverview(@Query() query: OverviewQueryDto) {
    return this.bulkDataService.getOverview(query);
  }
}
