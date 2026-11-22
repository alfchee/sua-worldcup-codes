import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import type { SessionUser } from "@/lib/types";

export type AuditAction =
  | "passport_created"
  | "passport_redeemed"
  | "passport_redeem_denied"
  | "passport_lookup_denied";

/** Auditoría operativa best-effort: nunca rompe el flujo principal. */
export async function logAudit(
  action: AuditAction,
  actor: SessionUser | null,
  targetId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await getFirebaseAdminFirestore()
      .collection("auditLogs")
      .add({
        action,
        actorUid: actor?.uid ?? null,
        actorEmail: actor?.email ?? null,
        createdAt: new Date(),
        targetId,
        details,
      });
  } catch (error) {
    console.error("[audit] No se pudo registrar la auditoría:", error);
  }
}
