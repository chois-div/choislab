import { ContractsWorkspace } from "@/components/contracts-workspace";
import { getDashboardUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getDashboardUser();
  if (!user) redirect("/login");
  return <ContractsWorkspace userEmail={user.email} />;
}
