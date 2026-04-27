"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

const NO_SIDEBAR_PATHS: string[] = ["/login", "/home"];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = NO_SIDEBAR_PATHS.some((p) =>
    pathname === p || pathname?.startsWith(p + "/") || pathname?.startsWith(p + "?")
  );

  if (hideSidebar) {
    return <main className="flex-1 overflow-x-hidden">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </>
  );
}
