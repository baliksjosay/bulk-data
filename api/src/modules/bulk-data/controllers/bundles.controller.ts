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
  BundlePackageDto,
  BundlePackageUpdateDto,
  ListQueryDto,
} from '../dto/bulk-data.dto';
import { BulkDataService } from '../services/bulk-data.service';

@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(RolesGuard)
@ApiTags('Packages')
@Controller('bundles')
export class BundlesController {
  constructor(private readonly bulkDataService: BulkDataService) {}

  @Get()
  @Public()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'List packages' })
  listBundles(@Query() query: ListQueryDto) {
    return this.bulkDataService.listBundles(query);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create package' })
  createBundle(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: BundlePackageDto,
  ) {
    return this.bulkDataService.createBundle(actor, dto);
  }

  @Get(':bundleId')
  @Public()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Get package' })
  getBundle(@Param('bundleId') bundleId: string) {
    return this.bulkDataService.getBundle(bundleId);
  }

  @Patch(':bundleId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update package' })
  updateBundle(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('bundleId') bundleId: string,
    @Body() dto: BundlePackageUpdateDto,
  ) {
    return this.bulkDataService.updateBundle(actor, bundleId, dto);
  }
}
