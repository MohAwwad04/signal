"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addUserAction, removeUserAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { UserPlus, Trash2, ArrowUpRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/db/schema";

type UserWithAuthor = User & { authorName?: string };
type RoleFilter = "all" | "admin" | "user" | "superadmin";

export function TeamManager({ users, isSuperAdmin }: { users: UserWithAuthor[]; isSuperAdmin: boolean }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  function handleAdd() {
    startTransition(async () => {
      try {
        await addUserAction(email.trim(), role);
        setEmail("");
        toast({ title: "Invite sent", kind: "success" });
      } catch (e: any) {
        toast({ title: "Failed to add user", description: e.message, kind: "error" });
      }
    });
  }

  function handleRemove(id: number) {
    startTransition(async () => {
      await removeUserAction(id);
    });
  }

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = (u.authorName ?? "").toLowerCase();
      const mail = u.email.toLowerCase();
      if (!name.includes(q) && !mail.includes(q)) return false;
    }
    return true;
  });

  const roleCounts: Record<string, number> = {};
  for (const u of users) roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1;

  const filterTabs: { value: RoleFilter; label: string }[] = [
    { value: "all", label: `All (${users.length})` },
    ...(roleCounts["superadmin"] ? [{ value: "superadmin" as RoleFilter, label: `Superadmin (${roleCounts["superadmin"]})` }] : []),
    ...(roleCounts["admin"] ? [{ value: "admin" as RoleFilter, label: `Admin (${roleCounts["admin"]})` }] : []),
    ...(roleCounts["user"] ? [{ value: "user" as RoleFilter, label: `User (${roleCounts["user"]})` }] : []),
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold">Team access</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Users who can log in to this workspace.</p>
      </div>

      {/* Add user form */}
      <div className="mb-5 flex gap-2">
        <Input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="h-9 text-sm"
        />
        <div className="flex h-9 items-center rounded-md border border-input bg-background p-0.5 gap-0.5">
          {(isSuperAdmin ? ["user", "admin"] as const : ["user"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`h-full px-3 rounded text-xs font-medium capitalize transition-colors ${
                role === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={handleAdd} disabled={isPending || !email.trim()}>
          <UserPlus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {/* Filter bar */}
      {users.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {/* Role tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setRoleFilter(tab.value)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  roleFilter === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {users.length === 0 ? "No users added yet." : "No users match your filter."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((u) => {
            const isAdmin = u.role === "admin" || u.role === "superadmin";
            const label = u.authorName || u.email;
            const row = (
              <div className="flex items-center justify-between gap-3 w-full">
                <div className="min-w-0">
                  <p className="text-sm truncate font-medium">{label}</p>
                  {u.authorName && <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!u.active && <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/40">Pending</Badge>}
                  <Badge variant={isAdmin ? "default" : "secondary"} className="text-[10px]">{u.role}</Badge>
                  {u.authorId && <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40" />}
                  <button
                    onClick={(e) => { e.preventDefault(); handleRemove(u.id); }}
                    disabled={isPending}
                    className="text-muted-foreground/50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );

            return u.authorId ? (
              <li key={u.id}>
                <Link
                  href={`/authors/${u.authorId}`}
                  className="flex rounded-lg border border-border px-3 py-2.5 hover:border-cyan-400/30 hover:bg-muted/40 transition-colors"
                >
                  {row}
                </Link>
              </li>
            ) : (
              <li key={u.id} className="flex rounded-lg border border-border px-3 py-2">
                {row}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
