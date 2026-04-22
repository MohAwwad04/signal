"use client";

import { useState, useTransition } from "react";
import { addUserAction, removeUserAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2 } from "lucide-react";
import type { User } from "@/lib/db/schema";

export function TeamManager({ users, isSuperAdmin }: { users: User[]; isSuperAdmin: boolean }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    setError("");
    startTransition(async () => {
      try {
        await addUserAction(email.trim(), role);
        setEmail("");
      } catch (e: any) {
        setError(e.message ?? "Failed to add user.");
      }
    });
  }

  function handleRemove(id: number) {
    startTransition(async () => {
      await removeUserAction(id);
    });
  }

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
                role === r
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
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

      {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

      {/* User list */}
      {users.length === 0 ? (
        <p className="text-xs text-muted-foreground">No users added yet.</p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span className="truncate text-sm">{u.email}</span>
              <div className="flex items-center gap-2 shrink-0">
                {!u.active && <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/40">Pending</Badge>}
                <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                  {u.role}
                </Badge>
                <button
                  onClick={() => handleRemove(u.id)}
                  disabled={isPending}
                  className="text-muted-foreground/50 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
