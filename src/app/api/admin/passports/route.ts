import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";
import { requireSessionUser } from "@/lib/auth-helpers";
import { isPassportTypeId } from "@/lib/config";
import {
  createPassport,
  getPassportStorageMode,
  getPromoWindows,
  isSaleWindowOpen,
  listPassports,
} from "@/lib/passports";
import { validateClientName, validateClientPhone } from "@/lib/phone";
import type {
  AdminPassportsResponse,
  CreatePassportResponse,
  SessionUser,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET() {
  const sessionUser = await requireSessionUser();

  if (sessionUser instanceof NextResponse) {
    return sessionUser;
  }

  try {
    const { passports, truncated } = await listPassports();

    const response: AdminPassportsResponse = {
      passports,
      storageMode: getPassportStorageMode(),
      sessionUser,
      now: new Date().toISOString(),
      windows: getPromoWindows(),
      truncated,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "No se pudo cargar el historial de pasaportes." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const sessionUser = await requireSessionUser();

  if (sessionUser instanceof NextResponse) {
    return sessionUser;
  }

  let body: unknown;

  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (!isPassportTypeId(body.type)) {
    return NextResponse.json(
      { error: "Selecciona un tipo de pasaporte válido." },
      { status: 400 },
    );
  }

  const nameError = validateClientName(body.clientName);

  if (nameError) {
    return NextResponse.json({ error: nameError }, { status: 400 });
  }

  const phoneError = validateClientPhone(body.clientPhone);

  if (phoneError) {
    return NextResponse.json({ error: phoneError }, { status: 400 });
  }

  if (!isSaleWindowOpen()) {
    return NextResponse.json(
      {
        error:
          "Fuera de la ventana de venta. Un administrador puede habilitarla con PROMO_SALE_START/PROMO_SALE_END.",
      },
      { status: 409 },
    );
  }

  try {
    const passport = await createPassport({
      type: body.type,
      clientName: (body.clientName as string).trim(),
      clientPhone: (body.clientPhone as string).trim(),
      sessionUser: sessionUser as SessionUser,
    });

    await logAudit("passport_created", sessionUser as SessionUser, passport.id, {
      code: passport.code,
      type: passport.type,
      clientName: passport.clientName,
    });

    const response: CreatePassportResponse = {
      passport,
      storageMode: getPassportStorageMode(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "No se pudo emitir el pasaporte. Intenta de nuevo." },
      { status: 500 },
    );
  }
}
