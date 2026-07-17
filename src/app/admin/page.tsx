import { AdminDashboard } from "@/components/admin-dashboard";
import { getSessionUser } from "@/lib/auth";
import {
  isFirebaseAdminConfigured,
  isFirebaseClientConfigured,
} from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const sessionUser = await getSessionUser();

  return (
    <AdminDashboard
      firebaseAdminConfigured={isFirebaseAdminConfigured()}
      firebaseClientConfigured={isFirebaseClientConfigured()}
      initialSessionUser={sessionUser}
    />
  );
}
