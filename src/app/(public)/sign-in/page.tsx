import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/form";
import { getSession, safeNextPath } from "@/lib/session";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in · The Handover" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const next = safeNextPath((await searchParams).next);
  if (await getSession()) redirect(next);

  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New here? <Link href="/sign-up" className="underline">Create an account</Link>
        </>
      }
    >
      <SignInForm next={next} />
    </AuthShell>
  );
}
