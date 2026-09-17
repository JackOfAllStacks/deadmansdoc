"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <button onClick={signOut} disabled={pending} className="text-sm text-foreground/70 underline disabled:opacity-50">
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
