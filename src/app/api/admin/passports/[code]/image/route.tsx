import { ImageResponse } from "next/og";

import { getSessionUser } from "@/lib/auth";
import { lookupPassport } from "@/lib/passports";
import type { PassportRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACCENTS: Record<string, { strong: string; soft: string; badge: string }> = {
  blackend: {
    strong: "#f5c56b",
    soft: "#f7dfae",
    badge: "#1c1408",
  },
  vip: {
    strong: "#b9e0c5",
    soft: "#e2f2e8",
    badge: "#0b1d12",
  },
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-NI", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Managua",
  }).format(new Date(iso));
}

function Ticket({ passport }: { passport: PassportRecord }) {
  const accent = ACCENTS[passport.type] ?? ACCENTS.vip;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "64px 72px 56px",
        backgroundColor: "#0b0a08",
        backgroundImage: "linear-gradient(160deg, #171310 0%, #0b0a08 55%, #131007 100%)",
        color: "#f7f3ea",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 26,
            letterSpacing: 12,
            color: "#c9b98a",
            textTransform: "uppercase",
          }}
        >
          Súa Hair Salon
        </div>
        <div
          style={{
            marginTop: 18,
            padding: "14px 38px",
            borderRadius: 999,
            border: `2px solid ${accent.strong}`,
            color: accent.badge,
            backgroundColor: accent.strong,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 8,
            textTransform: "uppercase",
          }}
        >
          {passport.typeLabel}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            fontSize: 200,
            lineHeight: 1,
            fontWeight: 900,
            color: accent.strong,
            textTransform: "uppercase",
          }}
        >
          {`${passport.discountPercent}%`}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 42,
            letterSpacing: 14,
            color: "#efe7d6",
            textTransform: "uppercase",
          }}
        >
          de descuento
        </div>
        <div
          style={{
            marginTop: 26,
            fontSize: 28,
            color: "#b7ab8f",
            letterSpacing: 4,
          }}
        >
          Blackend Week VIP
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            padding: "30px 0",
            borderTop: "2px dashed rgba(201,185,138,0.45)",
            borderBottom: "2px dashed rgba(201,185,138,0.45)",
          }}
        >
          <div style={{ fontSize: 22, letterSpacing: 10, color: "#c9b98a", textTransform: "uppercase" }}>
            Código de canje
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 86,
              fontWeight: 800,
              letterSpacing: 22,
              color: "#fdfaf2",
            }}
          >
            {passport.code}
          </div>
        </div>

        <div
          style={{
            marginTop: 30,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 30, color: "#f1e9d8" }}>
            {passport.clientName}
          </div>
          <div style={{ fontSize: 22, color: "#a99f8a" }}>
            {`Canjeable del ${formatDate(passport.validFrom)} al ${formatDate(passport.validUntil)}`}
          </div>
          <div style={{ fontSize: 20, color: "#8f8672", letterSpacing: 2 }}>
            Presenta este código en Súa Hair Salon · Canje único
          </div>
        </div>
      </div>
    </div>
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return new Response("No autorizado.", { status: 401 });
  }

  const lookup = await lookupPassport(code);

  if (!lookup.passport) {
    return new Response("Pasaporte no encontrado.", { status: 404 });
  }

  try {
    return new ImageResponse(<Ticket passport={lookup.passport} />, {
      width: 1080,
      height: 1350,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("No se pudo generar la imagen del pasaporte.", { status: 500 });
  }
}
