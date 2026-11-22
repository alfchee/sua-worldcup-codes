import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { isPassportTypeId } from "@/lib/config";
import {
  createPassport,
  getPassportStorageMode,
  isSaleWindowOpen,
  listPassports,
} from "@/lib/passports";
import type {
  AdminPassportsResponse,
  CreatePassportResponse,
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

  const response: AdminPassportsResponse = {
    passports: await listPassports(),
    storageMode: getPassportStorageMode(),
    sessionUser,
    now: new Date().toISOString(),
  };

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const sessionUser = await ensureSessionUser();

  if (sessionUser instanceof NextResponse) {
    return sessionUser;
  }

  let body: {
    type?: string;
    clientName?: string;
    clientPhone?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const clientName = body.clientName?.trim() ?? "";
  const clientPhone = body.clientPhone?.trim() ?? "";

  if (!isPassportTypeId(body.type)) {
    return NextResponse.json(
      { error: "Selecciona un tipo de pasaporte válido." },
      { status: 400 },
    );
  }

  if (clientName.length < 3) {
    return NextResponse.json(
      { error: "Ingresa el nombre de la clienta (mínimo 3 caracteres)." },
      { status: 400 },
    );
  }

  if (clientPhone.replace(/\D/g, "").length < 8) {
    return NextResponse.json(
      { error: "Ingresa un número de WhatsApp válido para la clienta." },
      { status: 400 },
    );
  }

  if (!isSaleWindowOpen()) {
    return NextResponse.json(
      {
        error:
          "Fuera de la ventana de venta (23–28 de noviembre). Un administrador puede habilitarla con PROMO_SALE_START/PROMO_SALE_END.",
      },
      { status: 409 },
    );
  }

  const passport = await createPassport({
    type: body.type,
    clientName,
    clientPhone,
    sessionUser,
  });
  const response: CreatePassportResponse = {
    passport,
    storageMode: getPassportStorageMode(),
  };

  return NextResponse.json(response, { status: 201 });
}
