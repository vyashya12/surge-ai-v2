"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("user");
    console.log("Root page: authToken:", token);
    if (token) {
      console.log("Redirecting to /dashboard/home");
      router.push("/dashboard/home");
    } else {
      console.log("Redirecting to /login");
      router.push("/login");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <p>Redirecting...</p>
    </div>
  );
}
