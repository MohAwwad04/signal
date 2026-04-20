"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radio,
  Users,
  BarChart3,
  Sparkles,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/signals", label: "Signals", icon: Radio },
  { href: "/authors", label: "Authors", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/frameworks", label: "Frameworks", icon: Wrench },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card/40 md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Signal</span>
          <span className="text-[11px] text-muted-foreground">content automation</span>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3 text-[11px] text-muted-foreground">
        <div>Logged in as</div>
        <div className="font-medium text-foreground">waelsalameh255@gmail.com</div>
      </div>
    </aside>
  );
}
