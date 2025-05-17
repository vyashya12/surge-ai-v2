"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type NavItem = { name: string; href: string };

const navItems: NavItem[] = [
  { name: "Home", href: "/home" },
  { name: "Validation", href: "/validation" },
  { name: "History", href: "/history" },
];

const renderNavItem = (
  item: NavItem,
  pathname: string,
  isCollapsed: boolean
) => (
  <Link
    key={item.href}
    href={item.href}
    className={`block py-2 px-4 ${
      pathname === item.href ? "bg-gray-700" : "hover:bg-gray-700"
    } ${isCollapsed ? "text-center" : ""}`}
  >
    {isCollapsed ? item.name[0] : item.name}
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
    } hidden md:block h-screen bg-gray-800 text-white transition-all duration-300`}
  >
    <div className="flex items-center justify-between p-4">
      {!isCollapsed && <h1 className="text-xl font-bold">My App</h1>}
      <Button variant="ghost" size="icon" onClick={toggleCollapse}>
        {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
      </Button>
    </div>
    <nav className="mt-4">
      {navItems.map((item) => renderNavItem(item, pathname, isCollapsed))}
    </nav>
    <div className="absolute bottom-4 w-full px-4">
      <Button variant="outline" className="w-full" onClick={logout}>
        {isCollapsed ? "L" : "Logout"}
      </Button>
    </div>
  </div>
);

const renderMobileSidebar = (pathname: string, logout: () => void) => (
  <div className="md:hidden">
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="m-4">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-gray-800 text-white">
        <h1 className="text-xl font-bold p-4">My App</h1>
        <nav className="mt-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block py-2 px-4 ${
                pathname === item.href ? "bg-gray-700" : "hover:bg-gray-700"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 w-full px-4">
          <Button variant="outline" className="w-full" onClick={logout}>
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
  const { logout } = useAuth();

  const toggleCollapse = () => setIsCollapsed((prev) => !prev);
  const handleLogout = () => logout();

  return (
    <div className="flex">
      {renderDesktopSidebar(
        isCollapsed,
        toggleCollapse,
        pathname,
        handleLogout
      )}
      {renderMobileSidebar(pathname, handleLogout)}
    </div>
  );
};

export default Sidebar;
