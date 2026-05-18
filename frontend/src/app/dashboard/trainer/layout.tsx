"use client";

import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";

const NAV_LINKS = [
  { href: "/dashboard/trainer", label: "Overview" },
  { href: "/dashboard/trainer/profile", label: "My Profile & Gyms" },
  { href: "/dashboard/trainer/clients", label: "My Clients" },
  { href: "/dashboard/trainer/schedule", label: "Calendar & Sessions" },
  { href: "/dashboard/trainer/plans", label: "Plan Builder" },
  { href: "/dashboard/trainer/ai-logs", label: "AI Audit Logs" },
];

export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowed={["TRAINER"]}>
      <div>
        <nav aria-label="Trainer dashboard navigation">
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
