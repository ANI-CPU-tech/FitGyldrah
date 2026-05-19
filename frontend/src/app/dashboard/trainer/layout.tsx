"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  UserCircle,
  Users,
  CalendarDays,
  Dumbbell,
  ScrollText,
} from "lucide-react";
import RoleGuard from "@/components/RoleGuard";

const NAV_LINKS = [
  { href: "/dashboard/trainer",          label: "Overview",          icon: LayoutDashboard },
  { href: "/dashboard/trainer/profile",  label: "Profile & Gyms",    icon: UserCircle },
  { href: "/dashboard/trainer/clients",  label: "My Clients",        icon: Users },
  { href: "/dashboard/trainer/schedule", label: "Calendar",          icon: CalendarDays },
  { href: "/dashboard/trainer/plans",    label: "Plan Builder",      icon: Dumbbell },
  { href: "/dashboard/trainer/ai-logs",  label: "AI Audit Logs",     icon: ScrollText },
];

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <RoleGuard allowed={["TRAINER"]}>
      <div className="min-h-screen bg-zinc-950 flex">

        {/* ── Sidebar ── */}
        <aside className="w-60 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">

          {/* Brand */}
          <div className="flex items-center gap-2.5 px-5 py-5 border-b border-zinc-800">
            <div className="p-1.5 rounded-lg bg-red-950/60 border border-red-900/50">
              <Shield className="w-5 h-5 text-red-500" strokeWidth={1.5} />
            </div>
            <span className="font-bold text-sm tracking-tight text-zinc-50">
              FitGyldrah
            </span>
          </div>

          {/* Nav */}
          <nav aria-label="Trainer dashboard navigation" className="flex-1 px-3 py-4">
            <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Trainer
            </p>
            <ul className="space-y-0.5">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const isActive =
                  href === "/dashboard/trainer"
                    ? pathname === href
                    : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={[
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-red-700/20 text-red-400 border border-red-800/40"
                          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 border border-transparent",
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

          {/* Footer */}
          <div className="px-5 py-4 border-t border-zinc-800">
            <p className="text-[11px] text-zinc-600">Trainer Portal</p>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 p-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
