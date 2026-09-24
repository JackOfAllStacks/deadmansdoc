import Link from "next/link";
import { isAdmin, requireSession } from "@/lib/session";
import { AccountMenu } from "./account-menu";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireSession();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-foreground/10">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-3">
          <Link href="/home" className="font-medium">The Handover</Link>
          <AccountMenu name={user.name} email={user.email} admin={isAdmin(user)} />
        </div>
      </header>
      {children}
    </div>
  );
}
