"use client";

import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";

const NAV_LINKS = [
  { href: "/dashboard/owner", label: "Overview" },
  { href: "/dashboard/owner/facilities", label: "My Facilities" },
  { href: "/dashboard/owner/trainers", label: "Trainer Roster" },
  { href: "/dashboard/owner/members", label: "Member Directory" },
  { href: "/dashboard/owner/financials", label: "Financials" },
];

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowed={["OWNER"]}>
      <div>
        <nav aria-label="Owner dashboard navigation">
          <ul>
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link href={href}>{label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <main>{children}</main>
      </div>
    </RoleGuard>
  );
}
