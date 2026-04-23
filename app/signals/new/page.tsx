import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import NewSignalsPage from "./new-form";

export default async function Page() {
  const session = await getCurrentUser();
  if (!session?.isAdmin && !session?.isSuperAdmin) redirect("/drafts");
  return <NewSignalsPage />;
}
