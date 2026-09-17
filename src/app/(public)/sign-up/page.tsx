import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/form";
import { getSession } from "@/lib/session";
import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Create an account · The Handover" };

export default async function SignUpPage() {
  if (await getSession()) redirect("/home");

  return (
    <AuthShell
      title="Create an account"
      footer={
        <>
          Already have one? <Link href="/sign-in" className="underline">Sign in</Link>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
