import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { bundles, updateBundlePackage } from "@/lib/fake-db";
import type { BundleStatus } from "@/types/domain";

export const dynamic = "force-dynamic";

const bundleStatuses = ["active", "paused", "disabled"] as const satisfies readonly BundleStatus[];

const bundlePackageUpdateSchema = z.object({
  serviceCode: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  volumeTb: z.number().positive().max(4).optional(),
  priceUgx: z.number().int().positive().optional(),
  validityDays: z.literal(30).optional(),
  status: z.enum(bundleStatuses).optional(),
  visible: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{
    bundleId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { bundleId } = await context.params;
  const bundle = bundles.find((item) => item.id === bundleId);

  if (!bundle) {
    return fail("Bundle package not found", 404);
  }

  return ok(bundle);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { bundleId } = await context.params;
  const parsed = bundlePackageUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const bundle = updateBundlePackage(bundleId, parsed.data);

  if (bundle === undefined) {
    return fail("Bundle package not found", 404);
  }

  if (bundle === null) {
    return fail("A bundle package with this service code already exists", 409);
  }

  return ok(bundle, "Bundle package updated successfully");
}
