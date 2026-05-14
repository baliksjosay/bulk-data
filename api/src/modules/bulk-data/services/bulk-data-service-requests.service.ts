import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { WebsocketGateway } from 'src/modules/notifications/services/notification-websocket.service';
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
    private readonly websocketGateway: WebsocketGateway,
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
    this.websocketGateway.emitDomainEvent({
      entity: 'service_request',
      action: 'created',
      entityId: serviceRequest.id,
      status: serviceRequest.status,
      message: 'Service request submitted',
    });
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
    this.websocketGateway.emitDomainEvent({
      entity: 'service_request',
      action: 'status_changed',
      entityId: saved.id,
      status: saved.status,
      message: `Service request marked ${saved.status}`,
    });
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
      validation?: MsisdnValidationResult;
      activation?: Record<string, unknown>;
      portalUserId?: string;
    };
    this.websocketGateway.emitDomainEvent({
      entity: 'service_request',
      action: 'converted',
      entityId: savedRequest.id,
      status: savedRequest.status,
      message: 'Service request converted',
    });

    return ok(
      {
        serviceRequest: serializeServiceRequest(savedRequest),
        customer: data.customer,
        validation: data.validation,
        activation: data.activation,
        portalUserId: data.portalUserId,
      },
      'Service request converted successfully',
    );
  }
}
