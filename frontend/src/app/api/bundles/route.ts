import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { bundles, createBundlePackage } from "@/lib/fake-db";
import { includesSearch } from "@/lib/list-query";
import type { BundleStatus } from "@/types/domain";

export const dynamic = "force-dynamic";

const bundleStatuses = ["active", "paused", "disabled"] as const satisfies readonly BundleStatus[];

const bundlePackageSchema = z.object({
  serviceCode: z.string().min(2),
  name: z.string().min(2),
  volumeTb: z.number().positive().max(4),
  priceUgx: z.number().int().positive(),
  validityDays: z.literal(30),
  status: z.enum(bundleStatuses),
  visible: z.boolean(),
});

export function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "";
  const visible = url.searchParams.get("visible") ?? "";
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const rows = bundles
    .filter((bundle) => !status || bundleStatuses.includes(status as BundleStatus) && bundle.status === status)
    .filter((bundle) => visible === "" || bundle.visible === (visible === "true"))
    .filter((bundle) => includesSearch([bundle.name, bundle.serviceCode, bundle.status], search))
    .sort((left, right) => left.priceUgx - right.priceUgx);

  return ok(rows);
}

export async function POST(request: Request) {
  const parsed = bundlePackageSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const bundle = createBundlePackage(parsed.data);

  if (!bundle) {
    return fail("A bundle package with this service code already exists", 409);
  }

  return ok(bundle, "Bundle package created successfully");
}
