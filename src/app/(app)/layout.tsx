import { demoRunFor } from "@/lib/demo/run";
import { journeyFor } from "@/lib/journey";
import { Backdrop } from "@/components/backdrop";
import { isAdmin, requireSession } from "@/lib/session";
import { AccountMenu } from "./account-menu";
import { DemoPlayer } from "./demo-player";
import { Nav, type NavLink } from "./nav";
import { ThemeToggle } from "./theme-toggle";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireSession();
  const [journey, demoRun] = await Promise.all([journeyFor(user.id), demoRunFor(user.id)]);

  // No Home: the wordmark goes there, from every page, already.
  const links: NavLink[] = [];
  if (journey.sittings.length) {
    links.push({ href: "/plan", label: "Your plan" });
    // The point of the whole thing, so it sits in the header from the moment
    // there is a plan -- not hidden until it happens to have something in it.
    links.push({ href: "/guide", label: "The Guide" });
  }
  // Only once there is something to find out. An empty page headed "what's
  // still to find out" would read as a reproach.
  if (journey.gaps > 0) links.push({ href: "/loose-ends", label: "Still to find out" });
  // Readable from the moment it exists, not only while it's unfinished: it is
  // the only place that says why the plan came out the way it did.
  if (journey.record) links.push({ href: "/start/intake", label: "Opening conversation" });

  return (
    <div className="relative isolate flex min-h-0 flex-1 flex-col overflow-x-clip">
      <Backdrop variant="page" className="print:hidden" />
      <Nav links={links}>
        <div className="flex items-center gap-1">
          <AccountMenu name={user.name} email={user.email} admin={isAdmin(user)} />
          <ThemeToggle />
        </div>
      </Nav>
      {children}
      {demoRun && <DemoPlayer run={demoRun} />}
    </div>
  );
}
