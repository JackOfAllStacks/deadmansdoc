import { journeyFor } from "@/lib/journey";
import { isAdmin, requireSession } from "@/lib/session";
import { AccountMenu } from "./account-menu";
import { Nav, type NavLink } from "./nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireSession();
  const journey = await journeyFor(user.id);

  const links: NavLink[] = [{ href: "/home", label: "Home" }];
  if (journey.sittings.length) links.push({ href: "/plan", label: "Your plan" });
  // Readable from the moment it exists, not only while it's unfinished: it is
  // the only place that says why the plan came out the way it did.
  if (journey.record) links.push({ href: "/start/intake", label: "Opening conversation" });

  return (
    <div className="flex flex-1 flex-col">
      <Nav links={links}>
        <AccountMenu name={user.name} email={user.email} admin={isAdmin(user)} />
      </Nav>
      {children}
    </div>
  );
}
