"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
} from "@/components/ui/sheet";
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  History,
  Home,
  CheckCircle,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type NavItem = { name: string; href: string; icon: React.ReactNode };

const navItems: NavItem[] = [
  { name: "Home", href: "/home", icon: <Home /> },
  { name: "Validation", href: "/validation", icon: <CheckCircle /> },
  { name: "History", href: "/history", icon: <History /> },
];

const NavLinks = ({
  pathname,
  isCollapsed = false,
}: {
  pathname: string;
  isCollapsed?: boolean;
}) => (
  <>
    {navItems.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center px-2 py-2 mx-2 rounded-md text-base font-medium transition-colors duration-200 ${
          pathname === item.href
            ? "bg-gray-600 text-white"
            : "text-gray-700 hover:bg-gray-600 hover:text-white"
        } ${isCollapsed ? "justify-center" : "gap-4"}`}
      >
        <span className="text-lg">{item.icon}</span>
        {!isCollapsed && <span>{item.name}</span>}
      </Link>
    ))}
  </>
);

const LogoutButton = ({
  isCollapsed,
  onClick,
}: {
  isCollapsed?: boolean;
  onClick: () => void;
}) => (
  <Button
    variant="outline"
    className="w-full text-white bg-[#f27252] hover:bg-[#ea5321] hover:text-white"
    onClick={onClick}
  >
    {isCollapsed ? <LogOut /> : "Logout"}
  </Button>
);

const renderDesktopSidebar = (
  isCollapsed: boolean,
  toggleCollapse: () => void,
  pathname: string,
  logout: () => void
) => (
  <div
    className={`${
      isCollapsed ? "w-16" : "min-w-[20%]"
    } hidden lg:flex flex-col h-screen bg-white text-gray-700 shadow-lg transition-all duration-300 border-r border-gray-200 fixed top-0 left-0 z-10`}
  >
    <div className="flex items-center justify-between p-4 border-b border-gray-200">
      {!isCollapsed && (
        <h1 className="text-xl font-bold text-gray-900">Surge AI</h1>
      )}
      <Button
        variant="outline"
        size="icon"
        onClick={toggleCollapse}
        className="text-gray-700 hover:bg-gray-600 hover:text-white rounded-full"
      >
        {isCollapsed ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
      </Button>
    </div>
    <nav className="flex-1 mt-6 space-y-2">
      <NavLinks pathname={pathname} isCollapsed={isCollapsed} />
    </nav>
    <div className="mt-auto p-2">
      <LogoutButton isCollapsed={isCollapsed} onClick={logout} />
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
          <h1 className="text-2xl font-bold p-4 border-b border-gray-200 text-gray-900">
            Surge AI
          </h1>
        </SheetHeader>
        <nav className="mt-6 space-y-2">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="absolute bottom-4 left-0 w-full px-4">
          <LogoutButton onClick={logout} />
        </div>
      </SheetContent>
    </Sheet>
  </div>
);

export const Sidebar = ({
  isCollapsed,
  setIsCollapsed,
}: {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const pathname = usePathname();
  const { logout } = useAuth();

  const toggleCollapse = () => setIsCollapsed((prev) => !prev);
  const handleLogout = () => logout();

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
