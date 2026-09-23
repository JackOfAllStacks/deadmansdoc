import { redirect } from "next/navigation";
import { getRecordForUser, listSittings } from "@/lib/records";
import { requireSession } from "@/lib/session";

// Sends people to wherever their record is up to.
export default async function HomePage() {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record) redirect("/start");
  if (!record.intake_completed_at) redirect("/start/intake");
  const sittings = await listSittings(record.id);
  redirect(sittings.length ? "/plan" : "/plan/new");
}
