"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import {
  SidebarCollapseProvider,
  useSidebarCollapse,
} from "@/contexts/sidebarContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("user");
    const authStatus = !!token;
    setIsAuthenticated(authStatus);

    if (!authStatus && pathname !== "/login") {
      setTimeout(() => router.push("/login"), 100);
    }
  }, [pathname, router]);

  if (!isAuthenticated && pathname !== "/login") {
    return null;
  }

  return (
    <SidebarCollapseProvider>
      <div className="flex">
        <Sidebar />
        <DashboardContent>{children}</DashboardContent>
      </div>
    </SidebarCollapseProvider>
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebarCollapse();

  return (
    <div
      className={`flex-1 transition-all duration-300 ${
        isCollapsed ? "ml-18 sm:ml-16" : "ml-18 sm:ml-[20%]"
      }`}
    >
      {children}
    </div>
  );
}
