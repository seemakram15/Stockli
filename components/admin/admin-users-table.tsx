"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Eye, Shield, ShieldOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminDeleteUserButton } from "@/components/admin/admin-delete-user-button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { setUserRole, type AdminActionState } from "@/lib/actions/admin";
import type { AdminUserRow } from "@/lib/services/admin";

export function AdminUsersTable({
  users,
  currentUserId,
  demo,
}: {
  users: AdminUserRow[];
  currentUserId: string;
  demo?: boolean;
}) {
  return (
    <>
      <div className="space-y-3 p-3 sm:hidden">
        {users.map((u) => (
          <div key={u.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{u.displayName ?? "—"}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email ?? u.id}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button asChild variant="ghost" size="icon" className="size-8" title="View account">
                  <Link href={`/admin/users/${u.id}`} aria-label={`View ${u.displayName ?? u.email}`}>
                    <Eye className="size-4" />
                  </Link>
                </Button>
                <RoleToggle user={u} isSelf={u.id === currentUserId} demo={demo} />
                {u.id !== currentUserId ? (
                  <AdminDeleteUserButton
                    userId={u.id}
                    email={u.email}
                    displayName={u.displayName}
                    role={u.role}
                    demo={demo}
                    iconOnly
                  />
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RoleBadge role={u.role} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <MobileMetric label="Portfolios" value={u.portfolioCount} />
              <MobileMetric label="Holdings" value={u.holdingCount} align="right" />
              <MobileMetric label="Joined" value={formatDate(u.createdAt)} />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto scrollbar-thin sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Portfolios</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Holdings</TableHead>
              <TableHead className="hidden text-right md:table-cell">Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{u.displayName ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">{u.email ?? u.id}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <RoleBadge role={u.role} />
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {u.portfolioCount}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {u.holdingCount}
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground md:table-cell">
                  {formatDate(u.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild variant="ghost" size="icon" className="size-8" title="View account">
                      <Link href={`/admin/users/${u.id}`} aria-label={`View ${u.displayName ?? u.email}`}>
                        <Eye className="size-4" />
                      </Link>
                    </Button>
                    <RoleToggle user={u} isSelf={u.id === currentUserId} demo={demo} />
                    {u.id !== currentUserId ? (
                      <AdminDeleteUserButton
                        userId={u.id}
                        email={u.email}
                        displayName={u.displayName}
                        role={u.role}
                        demo={demo}
                        iconOnly
                      />
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function RoleBadge({ role }: { role: AdminUserRow["role"] }) {
  if (role === "superadmin") {
    return (
      <Badge variant="violet">
        <Shield className="size-3" />
        Superadmin
      </Badge>
    );
  }
  return <Badge variant="secondary">User</Badge>;
}

function MobileMetric({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

function RoleToggle({
  user,
  isSelf,
  demo,
}: {
  user: AdminUserRow;
  isSelf: boolean;
  demo?: boolean;
}) {
  const makeAdmin = user.role !== "superadmin";
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    setUserRole,
    {}
  );

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Updated");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-8", makeAdmin ? "text-primary" : "text-muted-foreground")}
          title={makeAdmin ? "Grant superadmin" : "Revoke superadmin"}
        >
          {makeAdmin ? <Shield className="size-4" /> : <ShieldOff className="size-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {makeAdmin ? "Grant superadmin?" : "Revoke superadmin?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {makeAdmin ? (
              <>
                <span className="font-medium text-foreground">
                  {user.displayName ?? user.email}
                </span>{" "}
                will gain full access to every user&apos;s account and data.
              </>
            ) : (
              <>
                {isSelf
                  ? "You are about to revoke your OWN superadmin access. "
                  : ""}
                <span className="font-medium text-foreground">
                  {user.displayName ?? user.email}
                </span>{" "}
                will lose admin access.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {demo ? (
            <Button onClick={() => toast.error("Demo mode — connect Supabase to manage roles.")}>
              Confirm
            </Button>
          ) : (
            <form action={action}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="makeAdmin" value={String(makeAdmin)} />
              <Button type="submit" disabled={pending} variant={makeAdmin ? "default" : "destructive"}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                {makeAdmin ? "Grant" : "Revoke"}
              </Button>
            </form>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
