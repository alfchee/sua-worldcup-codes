import { listActiveCoupons, getCouponStorageMode } from "@/lib/coupons";
import type { PublicCouponsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const coupons = await listActiveCoupons(now);

  const response: PublicCouponsResponse = {
    now: now.toISOString(),
    coupons,
    storageMode: getCouponStorageMode(),
  };

  return Response.json(response);
}
