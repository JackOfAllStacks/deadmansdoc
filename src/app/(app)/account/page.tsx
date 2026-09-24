import Link from "next/link";
import { getRecordForUser, listSittings } from "@/lib/records";
import { requireSession } from "@/lib/session";
import { ChangeName, DeleteAccount } from "./account-forms";

export const metadata = { title: "Your account · The Handover" };

const RELATIONSHIP_LABEL = {
  self: "yourself",
  parent: "your parent",
  other: "someone close to you",
} as const;

export default async function AccountPage() {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  const sittings = record ? await listSittings(record.id) : [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>

      <section className="flex flex-col gap-4">
        <h2 className="font-medium">Your details</h2>
        <p className="text-sm text-foreground/70">
          Signed in as {user.email}. Your name is what the conversation calls you, and what
          &ldquo;who&rsquo;s here today&rdquo; starts from.
        </p>
        <ChangeName name={user.name} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Your record</h2>
        {record ? (
          <>
            <p className="text-sm text-foreground/70">
              A record about {record.subject_name}, for {RELATIONSHIP_LABEL[record.subject_relationship]}.
              {sittings.length
                ? ` ${sittings.filter((s) => s.status === "done").length} of ${sittings.length} sittings done.`
                : record.intake_completed_at
                  ? " The opening conversation is done; the plan comes next."
                  : " The opening conversation hasn't finished yet."}
            </p>
            <Link href="/home" className="self-start text-sm underline">
              Go to it
            </Link>
          </>
        ) : (
          <p className="text-sm text-foreground/70">
            You haven&apos;t started a record yet.{" "}
            <Link href="/start" className="underline">
              Start one
            </Link>
            .
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-red-500/30 p-5">
        <h2 className="font-medium">Delete your account</h2>
        <p className="text-sm text-foreground/70">
          This removes your account and everything in your record: the conversation, the plan, and
          everything recorded so far. It happens straight away and can&apos;t be undone. Anything
          you&apos;ve already printed stays printed.
        </p>
        <DeleteAccount />
      </section>
    </main>
  );
}
