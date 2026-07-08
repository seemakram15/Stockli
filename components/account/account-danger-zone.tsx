"use client";

import * as React from "react";
import { useActionState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteAccount, type DeleteAccountState } from "@/lib/actions/auth";

export function AccountDangerZone({
  email,
  demo = false,
}: {
  email: string | null;
  demo?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState("");
  const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(
    deleteAccount,
    {}
  );

  const normalizedEmail = (email ?? "").trim().toLowerCase();
  const canDelete =
    normalizedEmail.length > 0 && confirmation.trim().toLowerCase() === normalizedEmail;

  React.useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
  }, [state.error]);

  return (
    <Card variant="plain" className="border-loss/30">
      <CardHeader>
        <CardTitle className="text-loss">Danger zone</CardTitle>
        <CardDescription>
          Permanently delete your Stockli account and all connected personal data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-loss/20 bg-loss/5 p-4 text-sm text-muted-foreground">
          This deletes your portfolios, holdings, transactions, alerts, watchlists, notifications,
          and private device cache for this account. This action cannot be undone.
        </div>

        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={demo}>
              <Trash2 className="size-4" />
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-md">
            <form action={formAction} className="space-y-4">
              <AlertDialogHeader className="items-start text-left">
                <AlertDialogMedia className="bg-loss/10 text-loss">
                  <AlertTriangle className="size-5" />
                </AlertDialogMedia>
                <AlertDialogTitle>Delete your account permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove your Stockli account and all personal records tied to it. To
                  confirm, type <span className="font-semibold text-foreground">{email}</span>.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-2">
                <label htmlFor="delete-account-confirmation" className="text-sm font-medium">
                  Confirm with your account email
                </label>
                <Input
                  id="delete-account-confirmation"
                  name="confirmation"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={email ?? "you@example.com"}
                  className="h-11"
                />
              </div>

              {state.error ? (
                <p className="rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">{state.error}</p>
              ) : null}

              <AlertDialogFooter>
                <AlertDialogCancel type="button">Keep my account</AlertDialogCancel>
                <Button type="submit" variant="destructive" disabled={pending || !canDelete}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Delete permanently
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>

        {demo ? (
          <p className="text-sm text-muted-foreground">
            Demo mode is active, so account deletion is disabled until real auth is configured.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
