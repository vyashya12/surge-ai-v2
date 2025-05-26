"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Menu, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type NavItem = { name: string; href: string };

const navItems: NavItem[] = [
  { name: "Home", href: "/dashboard/home" },
  { name: "Validation", href: "/dashboard/validation" },
  { name: "History", href: "/dashboard/history" },
];

const renderNavItem = (
  item: NavItem,
  pathname: string,
  isCollapsed: boolean
) => (
  <Link
    key={item.href}
    href={item.href}
    className={`flex items-center px-2 py-2 mx-2 rounded-md text-base font-medium transition-colors duration-200 ${
      pathname === item.href
        ? "bg-gray-600 text-white"
        : "text-gray-700 hover:bg-gray-600 hover:text-white"
    } ${isCollapsed ? "justify-center" : ""}`}
  >
    {isCollapsed ? (
      <span className="text-lg font-medium">{item.name[0]}</span>
    ) : (
      <span className="text-base font-medium">{item.name}</span>
    )}
  </Link>
);

const renderDesktopSidebar = (
  isCollapsed: boolean,
  toggleCollapse: () => void,
  pathname: string,
  logout: () => void
) => (
  <div
    className={`${
      isCollapsed ? "w-16" : "w-64"
    } hidden lg:flex flex-col h-screen bg-white text-gray-700 shadow-lg transition-all duration-300 border-r border-gray-200 fixed top-0 left-0 z-10`}
  >
    <div className="flex items-center justify-between p-4 border-b border-gray-200">
      {!isCollapsed && (
        <h1 className="text-2xl font-bold text-gray-900">Surge AI</h1>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleCollapse}
        className="text-gray-700 hover:bg-gray-600 hover:text-white"
      >
        {isCollapsed ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
      </Button>
    </div>
    <nav className="flex-1 mt-6 space-y-2">
      {navItems.map((item) => renderNavItem(item, pathname, isCollapsed))}
    </nav>
    <div className="mt-auto p-2">
      <Button
        variant="outline"
        className={`w-full text-gray-700 border-gray-300 hover:bg-gray-600 hover:text-white ${
          isCollapsed ? "text-sm" : ""
        }`}
        onClick={logout}
      >
        {isCollapsed ? "L" : "Logout"}
      </Button>
    </div>
  </div>
);

const renderMobileSidebar = (pathname: string, logout: () => void) => (
  <div className="lg:hidden">
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 left-4 z-50 border-gray-300 text-gray-700 hover:bg-gray-600 hover:text-white bg-white rounded-md shadow-md"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-64 bg-white text-gray-700 border-r border-gray-200 p-0"
      >
        <SheetHeader>
          <VisuallyHidden>
            <SheetTitle>Navigation Menu</SheetTitle>
          </VisuallyHidden>
          <h1 className="text-2xl font-bold p-4 border-b border-gray-200 text-gray-900">
            Surge AI
          </h1>
        </SheetHeader>
        <nav className="mt-6 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-2 mx-2 rounded-md text-base font-medium transition-colors duration-200 ${
                pathname === item.href
                  ? "bg-gray-600 text-white"
                  : "text-gray-700 hover:bg-gray-600 hover:text-white"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-0 w-full px-4">
          <Button
            variant="outline"
            className="w-full text-gray-700 border-gray-300 hover:bg-gray-600 hover:text-white"
            onClick={logout}
          >
            Logout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  </div>
);

export const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const toggleCollapse = () => setIsCollapsed((prev) => !prev);
  const handleLogout = () => {
    logout(); // Call the logout function from useAuth
    router.push("/"); // Navigate to the root path
  };

  return (
    <>
      {renderDesktopSidebar(
        isCollapsed,
        toggleCollapse,
        pathname,
        handleLogout
      )}
      {renderMobileSidebar(pathname, handleLogout)}
    </>
  );
};

export default Sidebar;
