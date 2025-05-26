"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
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
    <div className="flex">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

      <div
        className={`flex-1 transition-all duration-300 ${
          isCollapsed ? "ml-16" : "ml-[20%]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
