import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import {
  createCoupon,
  getCouponStorageMode,
  listRecentCoupons,
} from "@/lib/coupons";
import type {
  AdminCouponsResponse,
  PublishCouponResponse,
  SessionUser,
} from "@/lib/types";

export const dynamic = "force-dynamic";

async function ensureSessionUser(): Promise<SessionUser | NextResponse> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return sessionUser;
}

export async function GET() {
  const sessionUser = await ensureSessionUser();

  if (sessionUser instanceof NextResponse) {
    return sessionUser;
  }

  const response: AdminCouponsResponse = {
    coupons: await listRecentCoupons(),
    storageMode: getCouponStorageMode(),
    sessionUser,
  };

  return NextResponse.json(response);
}

export async function POST() {
  const sessionUser = await ensureSessionUser();

  if (sessionUser instanceof NextResponse) {
    return sessionUser;
  }

  if (sessionUser.role !== "admin") {
    return NextResponse.json(
      { error: "Solo los administradores pueden publicar cupones." },
      { status: 403 },
    );
  }

  const response: PublishCouponResponse = {
    coupon: await createCoupon(sessionUser),
    storageMode: getCouponStorageMode(),
  };

  return NextResponse.json(response, { status: 201 });
}
