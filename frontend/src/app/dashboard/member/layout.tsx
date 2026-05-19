"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dumbbell,
  LayoutDashboard,
  Compass,
  ClipboardList,
  CalendarDays,
  Activity,
  CreditCard,
  UserCircle,
} from "lucide-react";
import RoleGuard from "@/components/RoleGuard";

const NAV_LINKS = [
  { href: "/dashboard/member",            label: "Overview",            icon: LayoutDashboard },
  { href: "/dashboard/member/explore",    label: "Gym Explorer",        icon: Compass },
  { href: "/dashboard/member/plans",      label: "My Training Plans",   icon: ClipboardList },
  { href: "/dashboard/member/schedule",   label: "My Schedule",         icon: CalendarDays },
  { href: "/dashboard/member/biometrics", label: "Biometrics Lab",      icon: Activity },
  { href: "/dashboard/member/billing",    label: "Billing & Memberships", icon: CreditCard },
  { href: "/dashboard/member/profile",    label: "Profile",             icon: UserCircle },
];

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <RoleGuard allowed={["MEMBER"]}>
      <div className="min-h-screen bg-zinc-950 flex">

        {/* Sidebar */}
        <aside className="w-60 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">

          {/* Brand */}
          <div className="flex items-center gap-2.5 px-5 py-5 border-b border-zinc-800">
            <div className="p-1.5 rounded-lg bg-sky-950/60 border border-sky-900/50">
              <Dumbbell className="w-5 h-5 text-sky-400" strokeWidth={1.5} />
            </div>
            <span className="font-bold text-sm tracking-tight text-zinc-50">FitGyldrah</span>
          </div>

          {/* Nav */}
          <nav aria-label="Member dashboard navigation" className="flex-1 px-3 py-4">
            <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Member
            </p>
            <ul className="space-y-0.5">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const isActive =
                  href === "/dashboard/member"
                    ? pathname === href
                    : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={[
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 border",
                        isActive
                          ? "bg-sky-700/20 text-sky-400 border-sky-800/40"
                          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 border-transparent",
                      ].join(" ")}
                    >
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="px-5 py-4 border-t border-zinc-800">
            <p className="text-[11px] text-zinc-600">Member Portal</p>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 p-8 overflow-y-auto">{children}</main>
        </div>
      </div>
    </RoleGuard>
  );
}
