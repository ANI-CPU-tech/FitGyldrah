"use client";

/**
 * RoleGuard
 *
 * Wraps any page or layout that requires:
 *   1. An authenticated user (valid access_token in localStorage)
 *   2. A specific role (or one of several allowed roles)
 *
 * Behaviour:
 *   - No token          → redirect to /login
 *   - Wrong role        → redirect to the user's own dashboard
 *   - Correct role      → render children
 *
 * Usage:
 *   <RoleGuard allowed={["OWNER"]}>
 *     <OwnerDashboard />
 *   </RoleGuard>
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RoleValue, UserProfile } from "@/utils/api";

interface RoleGuardProps {
  allowed: RoleValue[];
  children: React.ReactNode;
}

function dashboardForRole(role: RoleValue): string {
  switch (role) {
    case "OWNER":
      return "/dashboard/owner";
    case "TRAINER":
      return "/dashboard/trainer";
    case "MEMBER":
      return "/dashboard/member";
    default:
      return "/dashboard";
  }
}

export default function RoleGuard({ allowed, children }: RoleGuardProps) {
  const router = useRouter();
  // null = still checking, true = authorised, false = redirecting
  const [authorised, setAuthorised] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const raw = localStorage.getItem("user");

    if (!token || !raw) {
      router.replace("/login");
      return;
    }

    let user: UserProfile | null = null;
    try {
      user = JSON.parse(raw) as UserProfile;
    } catch {
      router.replace("/login");
      return;
    }

    if (!user?.role || !allowed.includes(user.role as RoleValue)) {
      // User is authenticated but has the wrong role — send them to their own dashboard
      router.replace(dashboardForRole(user.role as RoleValue));
      return;
    }

    setAuthorised(true);
  }, [router, allowed]);

  // Render nothing while the auth check is in progress to avoid flash
  if (authorised !== true) return null;

  return <>{children}</>;
}
