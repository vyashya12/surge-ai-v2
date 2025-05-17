"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("user"); // Note: Using "user" as per your code
    console.log("Dashboard layout: authToken:", token, "pathname:", pathname);
    const authStatus = !!token;
    setIsAuthenticated(authStatus);

    if (!authStatus && pathname !== "/login") {
      console.log("Redirecting to /login from dashboard");
      setTimeout(() => router.push("/login"), 100);
    }
  }, [pathname, router]);

  if (!isAuthenticated && pathname !== "/login") {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Left Sidebar */}
      <div className="w-64 bg-white shadow-md fixed left-0 top-0 h-full z-10">
        <div className="p-4">
          <h2 className="text-xl font-bold text-gray-800">Surge AI</h2>
        </div>
        <nav className="mt-4">
          <ul>
            <li>
              <a
                href="/dashboard/home"
                className="block px-4 py-2 text-gray-700 hover:bg-gray-200"
              >
                Home
              </a>
            </li>
            <li>
              <a
                href="/dashboard/validation"
                className="block px-4 py-2 text-gray-700 hover:bg-gray-200"
              >
                Validation
              </a>
            </li>
            <li>
              <a
                href="/dashboard/history"
                className="block px-4 py-2 text-gray-700 hover:bg-gray-200"
              >
                History
              </a>
            </li>
            <li>
              <a
                href="/login"
                onClick={() => localStorage.removeItem("user")}
                className="block px-4 py-2 text-gray-700 hover:bg-gray-200"
              >
                Logout
              </a>
            </li>
          </ul>
        </nav>
      </div>
      {/* Main Content */}
      <main className="flex-1 ml-64 mr-64">{children}</main>
    </div>
  );
}
