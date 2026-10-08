import { Note } from "@/components/ui";

/**
 * Said wherever someone might start putting things in, while this is being
 * tested. The red line from the first walkthrough was secrets; the rest is
 * so nobody is surprised that the people building it can see what's typed.
 */
export function TestNotice() {
  return (
    <Note>
      <strong className="font-semibold text-ink">This is a test version.</strong> Please don&apos;t put in
      passwords, PINs or account numbers — it never needs them. Made-up details are fine. What you type is
      stored, and the small team building The Handover can read it.
    </Note>
  );
}
