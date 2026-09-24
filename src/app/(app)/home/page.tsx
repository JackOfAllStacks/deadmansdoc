import { redirect } from "next/navigation";
import { getRecordForUser, listSittings } from "@/lib/records";
import { requireSession } from "@/lib/session";
import { openSitting } from "@/lib/sitting/store";

// Sends people to wherever their record is up to.
export default async function HomePage() {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record) redirect("/start");
  if (!record.intake_completed_at) redirect("/start/intake");
  const sittings = await listSittings(record.id);
  if (!sittings.length) redirect("/plan/new");
  // Straight back into a sitting that was left part-way through.
  redirect((await openSitting(record.id)) ? "/sitting" : "/plan");
}
