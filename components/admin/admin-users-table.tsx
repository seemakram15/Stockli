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
    <div className="overflow-x-auto scrollbar-thin">
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
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    u.role === "superadmin"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {u.role === "superadmin" && <Shield className="size-3" />}
                  {u.role === "superadmin" ? "Superadmin" : "User"}
                </span>
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
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
