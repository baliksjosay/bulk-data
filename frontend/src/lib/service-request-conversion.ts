import type {
  CustomerRegistrationRequest,
  ServiceRequest,
} from "@/types/domain";

export function createServiceRequestConversionForm(
  serviceRequest: ServiceRequest,
): CustomerRegistrationRequest {
  return {
    businessName: serviceRequest.businessName,
    registrationNumber: "",
    tin: "",
    businessEmail: serviceRequest.contactEmail,
    businessPhone: serviceRequest.contactPhone,
    contactPerson: serviceRequest.contactPerson,
    contactEmail: serviceRequest.contactEmail,
    contactPhone: serviceRequest.contactPhone,
    apnName: "",
    apnId: "",
    primaryMsisdn: "",
  };
}
