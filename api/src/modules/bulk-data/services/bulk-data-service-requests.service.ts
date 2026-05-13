import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import {
  ListQueryDto,
  ServiceRequestConversionDto,
  ServiceRequestDto,
  ServiceRequestStatus,
  ServiceRequestUpdateDto,
} from '../dto/bulk-data.dto';
import {
  BulkBundlesRepository,
  BulkServiceRequestsRepository,
} from '../repositories';
import { BulkDataAccessService } from './bulk-data-access.service';
import { BulkDataCustomersService } from './bulk-data-customers.service';
import {
  matchesSearch,
  ok,
  okPaginated,
  paginate,
  sequenceId,
  withinDateRange,
} from './bulk-data-query';
import { serializeServiceRequest } from './bulk-data-serializers';
import { MsisdnValidationResult } from './bulk-data.types';

@Injectable()
export class BulkDataServiceRequestsService {
  constructor(
    private readonly access: BulkDataAccessService,
    private readonly customersService: BulkDataCustomersService,
    private readonly serviceRequests: BulkServiceRequestsRepository,
    private readonly bundles: BulkBundlesRepository,
  ) {}

  async submitServiceRequest(dto: ServiceRequestDto) {
    await this.access.ensureSeedData();
    const bundle = dto.preferredPackageId
      ? await this.bundles.findById(dto.preferredPackageId)
      : null;
    const serviceRequest = await this.serviceRequests.save(
      this.serviceRequests.create({
        id: sequenceId('srv'),
        ...dto,
        preferredPackageName: bundle?.name,
        status: ServiceRequestStatus.NEW,
      }),
    );
    await this.access.audit(
      'customer',
      'Public service request submitted',
      dto.businessName,
      'success',
    );
    return ok(
      serializeServiceRequest(serviceRequest),
      'Service request submitted successfully',
    );
  }

  async listServiceRequests(query: ListQueryDto) {
    await this.access.ensureSeedData();
    const rows = (await this.serviceRequests.findCreatedDesc())
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => withinDateRange(row.createdAt, query))
      .filter((row) =>
        matchesSearch(
          [
            row.businessName,
            row.contactPerson,
            row.contactEmail,
            row.contactPhone,
            row.status,
          ],
          query.search,
        ),
      );
    const page = paginate(rows, query);
    return okPaginated(
      page.data.map((row) => serializeServiceRequest(row)),
      page.meta,
      'Service requests fetched successfully',
    );
  }

  async getServiceRequest(serviceRequestId: string) {
    const serviceRequest =
      await this.access.requireServiceRequest(serviceRequestId);
    return ok(
      serializeServiceRequest(serviceRequest),
      'Service request fetched successfully',
    );
  }

  async updateServiceRequest(
    actor: AuthenticatedUser,
    serviceRequestId: string,
    dto: ServiceRequestUpdateDto,
  ) {
    this.access.assertPrivileged(actor, [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.SUPPORT,
    ]);
    const serviceRequest =
      await this.access.requireServiceRequest(serviceRequestId);

    if (serviceRequest.status === ServiceRequestStatus.CONVERTED) {
      throw new UnprocessableEntityException(
        'Converted service requests cannot be updated',
      );
    }

    serviceRequest.status = dto.status;
    const saved = await this.serviceRequests.save(serviceRequest);
    await this.access.audit(
      'customer',
      `Service request marked ${dto.status}`,
      actor.email,
      'success',
    );
    return ok(
      serializeServiceRequest(saved),
      'Service request updated successfully',
    );
  }

  async convertServiceRequest(
    actor: AuthenticatedUser,
    serviceRequestId: string,
    dto: ServiceRequestConversionDto,
  ) {
    this.access.assertPrivileged(actor, [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
    const serviceRequest =
      await this.access.requireServiceRequest(serviceRequestId);

    if (serviceRequest.status === ServiceRequestStatus.CONVERTED) {
      throw new UnprocessableEntityException(
        'Service request is already converted',
      );
    }

    const registered = await this.customersService.registerCustomer(actor, dto);
    serviceRequest.status = ServiceRequestStatus.CONVERTED;
    const savedRequest = await this.serviceRequests.save(serviceRequest);
    const data = registered.data as {
      customer: Record<string, unknown>;
      validation: MsisdnValidationResult;
    };

    return ok(
      {
        serviceRequest: serializeServiceRequest(savedRequest),
        customer: data.customer,
        validation: data.validation,
      },
      'Service request converted successfully',
    );
  }
}
