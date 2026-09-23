import { redirect } from "next/navigation";
import { getRecordForUser } from "@/lib/records";
import { requireSession } from "@/lib/session";
import { StartForm } from "./start-form";

export const metadata = { title: "Getting started · The Handover" };

export default async function StartPage() {
  const { user } = await requireSession();
  if (await getRecordForUser(user.id)) redirect("/home");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Getting started</h1>
        <p className="leading-relaxed text-foreground/80">
          The Handover builds a record of what the people you leave behind will need to know: who to
          call, what exists, and where to find it. It works best when two people do it together, and
          it&apos;s done over a few short sittings rather than all at once.
        </p>
      </header>
      <StartForm accountName={user.name} />
    </main>
  );
}
