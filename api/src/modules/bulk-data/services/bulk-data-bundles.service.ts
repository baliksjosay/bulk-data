import { ConflictException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { WebsocketGateway } from 'src/modules/notifications/services/notification-websocket.service';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import {
  BundlePackageDto,
  BundlePackageUpdateDto,
  ListQueryDto,
} from '../dto/bulk-data.dto';
import { BulkBundlesRepository } from '../repositories';
import { BulkDataAccessService } from './bulk-data-access.service';
import {
  matchesSearch,
  ok,
  okPaginated,
  paginate,
  slugId,
  withinDateRange,
} from './bulk-data-query';
import { serializeBundle } from './bulk-data-serializers';

@Injectable()
export class BulkDataBundlesService {
  constructor(
    private readonly access: BulkDataAccessService,
    private readonly bundles: BulkBundlesRepository,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  async listBundles(query: ListQueryDto) {
    await this.access.ensureSeedData();
    const rows = (await this.bundles.findByPriceAsc())
      .filter((bundle) => !query.status || bundle.status === query.status)
      .filter(
        (bundle) =>
          query.visible === undefined || bundle.visible === query.visible,
      )
      .filter((bundle) => withinDateRange(bundle.createdAt, query))
      .filter((bundle) =>
        matchesSearch(
          [bundle.name, bundle.serviceCode, bundle.status],
          query.search,
        ),
      );
    const page = paginate(rows, query);

    return okPaginated(
      page.data.map((bundle) => serializeBundle(bundle)),
      page.meta,
      'Packages fetched successfully',
    );
  }

  async createBundle(actor: AuthenticatedUser, dto: BundlePackageDto) {
    this.access.assertPrivileged(actor, [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
    const serviceCode = dto.serviceCode.trim().toUpperCase();
    const existing = await this.bundles.findByServiceCode(serviceCode);

    if (existing) {
      throw new ConflictException('Bundle service code already exists');
    }

    const bundle = await this.bundles.save(
      this.bundles.create({
        id: slugId('bundle', serviceCode),
        ...dto,
        serviceCode,
      }),
    );
    await this.access.audit(
      'bundle',
      'Bundle package created',
      actor.email,
      'success',
    );
    this.websocketGateway.emitDomainEvent({
      entity: 'bundle',
      action: 'created',
      entityId: bundle.id,
      status: bundle.status,
      message: 'Package created',
      metadata: { visible: bundle.visible },
    });
    return ok(serializeBundle(bundle), 'Package created successfully');
  }

  async getBundle(bundleId: string) {
    const bundle = await this.access.requireBundle(bundleId);
    return ok(serializeBundle(bundle), 'Package fetched successfully');
  }

  async updateBundle(
    actor: AuthenticatedUser,
    bundleId: string,
    dto: BundlePackageUpdateDto,
  ) {
    this.access.assertPrivileged(actor, [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
    const bundle = await this.access.requireBundle(bundleId);
    const nextServiceCode =
      dto.serviceCode?.trim().toUpperCase() ?? bundle.serviceCode;

    if (nextServiceCode !== bundle.serviceCode) {
      const existing = await this.bundles.findByServiceCode(nextServiceCode);

      if (existing) {
        throw new ConflictException('Bundle service code already exists');
      }
    }

    Object.assign(bundle, {
      serviceCode: nextServiceCode,
      name: dto.name ?? bundle.name,
      volumeTb: dto.volumeTb ?? bundle.volumeTb,
      priceUgx: dto.priceUgx ?? bundle.priceUgx,
      validityDays: dto.validityDays ?? bundle.validityDays,
      status: dto.status ?? bundle.status,
      visible: dto.visible ?? bundle.visible,
    });
    const saved = await this.bundles.save(bundle);
    await this.access.audit(
      'bundle',
      'Bundle package updated',
      actor.email,
      'success',
    );
    this.websocketGateway.emitDomainEvent({
      entity: 'bundle',
      action: 'updated',
      entityId: saved.id,
      status: saved.status,
      message: 'Package updated',
      metadata: { visible: saved.visible },
    });
    return ok(serializeBundle(saved), 'Package updated successfully');
  }
}
