"use client";

import { createContext, useContext, useState } from "react";

interface SidebarCollapseContextProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

const SidebarCollapseContext = createContext<
  SidebarCollapseContextProps | undefined
>(undefined);

export const SidebarCollapseProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <SidebarCollapseContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      {children}
    </SidebarCollapseContext.Provider>
  );
};

export const useSidebarCollapse = () => {
  const context = useContext(SidebarCollapseContext);
  if (!context) {
    throw new Error(
      "useSidebarCollapse must be used within SidebarCollapseProvider"
    );
  }
  return context;
};
