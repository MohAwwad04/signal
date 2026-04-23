"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Radio, Users, BarChart3, Wrench, Sun, Moon, LogOut, FileEdit, Settings, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

type Identity = { display: string; isAdmin: boolean };

function useUserIdentity(): Identity {
  const [identity, setIdentity] = useState<Identity>({ display: "", isAdmin: false });
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.name) setIdentity({ display: d.name, isAdmin: !!d.isAdmin || !!d.isSuperAdmin }); })
      .catch(() => {});
  }, []);
  return identity;
}

const ADMIN_ITEMS = [
  { href: "/home",       label: "Home",       icon: Home },
  { href: "/",           label: "Dashboard",  icon: LayoutDashboard },
  { href: "/signals",    label: "Signals",    icon: Radio },
  { href: "/drafts",     label: "Drafts",     icon: FileEdit },
  { href: "/authors",    label: "Authors",    icon: Users },
  { href: "/analytics",  label: "Analytics",  icon: BarChart3 },
  { href: "/frameworks", label: "Frameworks", icon: Wrench },
  { href: "/settings",   label: "Settings",   icon: Settings },
];

const USER_ITEMS = [
  { href: "/home",     label: "Home",      icon: Home },
  { href: "/",         label: "Dashboard", icon: LayoutDashboard },
  { href: "/drafts",   label: "My posts",  icon: FileEdit },
  { href: "/settings", label: "Settings",  icon: Settings },
];

function SignalLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <circle cx="14" cy="15" r="10" fill="url(#sb)" />
      <path d="M8 22 L6 27 L13 24" fill="url(#sb)" />
      <rect x="10"  y="13"   width="1.8" height="4"   rx="0.9" fill="white" opacity="0.7" />
      <rect x="13"  y="11"   width="1.8" height="8"   rx="0.9" fill="white" />
      <rect x="16"  y="12"   width="1.8" height="6"   rx="0.9" fill="white" opacity="0.85" />
      <rect x="18.8" y="14" width="1.8" height="2.5" rx="0.9" fill="white" opacity="0.55" />
      <path d="M25 6.5 L26 9.5 L29 10.5 L26 11.5 L25 14.5 L24 11.5 L21 10.5 L24 9.5 Z" fill="url(#cg)" opacity="0.95" />
      <path d="M27 21.5 L27.7 24 L30 24.5 L27.7 25 L27 27.5 L26.3 25 L24 24.5 L26.3 24 Z" fill="url(#cg)" opacity="0.7" />
      <defs>
        <linearGradient id="sb" x1="4" y1="5" x2="24" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" /><stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
        <linearGradient id="cg" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop stopColor="#22D3EE" /><stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { display, isAdmin } = useUserIdentity();
  const items = isAdmin ? ADMIN_ITEMS : USER_ITEMS;

  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 min-h-screen
      bg-gray-100 border-r border-gray-200
      dark:bg-[hsl(215,52%,9%)] dark:border-[hsl(215,40%,16%)]">

      {/* Logo header */}
      <Link href="/" className="flex items-center gap-3 px-5 h-16 border-b border-gray-200 dark:border-[hsl(215,40%,16%)] shrink-0 hover:opacity-80 transition-opacity">
        <div className="relative flex-shrink-0">
          <Image src="/logo.png" alt="Signal logo" width={38} height={38} className="rounded-xl" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-bold tracking-tight text-gray-800 dark:text-white">Signal</span>
          <span className="text-[10px] font-medium tracking-widest uppercase text-blue-500/60 dark:text-blue-300/50">
            content automation
          </span>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 p-3 pt-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = (item.href === "/" || item.href === "/home")
            ? pathname === item.href
            : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-gradient-to-r from-blue-600/20 to-cyan-600/10 text-blue-700 dark:from-blue-600/25 dark:to-cyan-600/15 dark:text-white"
                  : "text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-blue-200/45 dark:hover:bg-white/[0.05] dark:hover:text-blue-100"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-gradient-to-b from-blue-400 to-cyan-400" />
              )}
              <Icon className={cn(
                "h-4 w-4 flex-shrink-0 transition-colors duration-200",
                active
                  ? "text-blue-500 dark:text-blue-400"
                  : "text-gray-400 group-hover:text-gray-600 dark:text-blue-400/35 dark:group-hover:text-blue-300/65"
              )} />
              {item.label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400"
                  style={{ animation: "glow-pulse 2.5s ease-in-out infinite" }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom controls */}
      <div className="border-t border-gray-200 dark:border-[hsl(215,40%,16%)] p-3 space-y-0.5">
        <button
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-blue-200/45 dark:hover:bg-white/[0.05] dark:hover:text-blue-100 transition-all duration-200"
        >
          {theme === "dark"
            ? <Sun  className="h-4 w-4 text-gray-400 dark:text-blue-400/35" />
            : <Moon className="h-4 w-4 text-gray-400 dark:text-blue-400/35" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <a
          href="/api/auth/logout"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-blue-200/45 dark:hover:bg-white/[0.05] dark:hover:text-blue-100 transition-all duration-200"
        >
          <LogOut className="h-4 w-4 text-gray-400 dark:text-blue-400/35" />
          Sign out
        </a>
        <div className="px-3 pt-3 pb-1">
          <div className="text-[10px] uppercase tracking-widest mb-0.5 text-gray-400 dark:text-blue-300/25">Logged in as</div>
          <div className="text-[11px] truncate text-gray-500 dark:text-blue-200/40">{display || "—"}</div>
        </div>
      </div>
    </aside>
  );
}
