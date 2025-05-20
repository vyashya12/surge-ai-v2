"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar"; // Import your Sidebar component

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("user"); // Consistent with your code
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
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar />
      {/* Main Content */}
      <main
        style={{
          backgroundImage: "url('/bgimage.jpg')",
          width: "100%",
          height: "100%",
        }}
        className="flex-1 lg:ml-64 lg:mr-64 p-4 sm:p-8"
      >
        {children}
      </main>
    </div>
  );
}
