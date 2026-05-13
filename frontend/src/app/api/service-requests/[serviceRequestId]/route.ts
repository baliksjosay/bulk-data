import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { serviceRequests, updateServiceRequest } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

const serviceRequestUpdateSchema = z.object({
  status: z.enum(["new", "contacted"]),
  note: z.string().trim().max(500).optional(),
});

type RouteContext = {
  params: Promise<{
    serviceRequestId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { serviceRequestId } = await context.params;
  const serviceRequest = serviceRequests.find((item) => item.id === serviceRequestId);

  if (!serviceRequest) {
    return fail("Service request not found", 404);
  }

  return ok(serviceRequest);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { serviceRequestId } = await context.params;
  const parsed = serviceRequestUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const serviceRequest = updateServiceRequest(serviceRequestId, parsed.data);

  if (!serviceRequest) {
    return fail("Service request not found or already converted", 404);
  }

  return ok(serviceRequest, "Service request updated successfully");
}
