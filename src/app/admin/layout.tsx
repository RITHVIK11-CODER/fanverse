
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { connection } from "next/server";

// Admin pages require runtime authentication.
export const instant = false;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin-login");
  }

  if (user.app_metadata?.role !== "admin") {
    redirect("/");
  }

  return <>{children}</>;
}
