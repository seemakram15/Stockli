"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteUserAccount, type AdminActionState } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";

export function AdminDeleteUserButton({
  userId,
  email,
  displayName,
  role,
  demo,
  iconOnly = false,
  redirectTo = "/admin",
}: {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: "user" | "superadmin";
  demo?: boolean;
  iconOnly?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState("");
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    deleteUserAccount,
    {}
  );

  const expectedConfirmation = (email ?? userId).trim().toLowerCase();
  const isConfirmed = confirmation.trim().toLowerCase() === expectedConfirmation;

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "User deleted");
      setOpen(false);
      setConfirmation("");
      if (state.redirectTo ?? redirectTo) {
        router.push(state.redirectTo ?? redirectTo);
      } else {
        router.refresh();
      }
      return;
    }

    if (state.error) {
      toast.error(state.error);
    }
  }, [redirectTo, router, state]);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setConfirmation("");
      }}
    >
      <AlertDialogTrigger asChild>
        {iconOnly ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-loss hover:text-loss"
            title="Delete account"
            disabled={demo}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : (
          <Button variant="destructive" disabled={demo}>
            <Trash2 className="size-4" />
            Delete user account
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />

          <AlertDialogHeader className="items-start text-left">
            <AlertDialogMedia className="bg-loss/10 text-loss">
              <AlertTriangle className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete this user permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">
                {displayName ?? email ?? "This user"}
              </span>{" "}
              will lose their account, portfolios, watchlists, alerts, notifications, and push
              subscriptions. This cannot be undone.
              {role === "superadmin" ? " This is also a superadmin account." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-xl border border-loss/20 bg-loss/5 p-3 text-sm text-muted-foreground">
            Type <span className="font-semibold text-foreground">{email ?? userId}</span> to
            confirm permanent deletion.
          </div>

          <div className="space-y-2">
            <label htmlFor={`delete-user-${userId}`} className="text-sm font-medium">
              Confirm with the user&apos;s email
            </label>
            <Input
              id={`delete-user-${userId}`}
              name="confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={email ?? userId}
              className={cn("h-11", state.error ? "border-loss/50" : "")}
            />
          </div>

          {state.error ? (
            <p className="rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">{state.error}</p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            {demo ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() =>
                  toast.error("Demo mode — connect Supabase to manage user accounts.")
                }
              >
                Delete user
              </Button>
            ) : (
              <Button type="submit" variant="destructive" disabled={pending || !isConfirmed}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete permanently
              </Button>
            )}
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
