import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthForm } from "@/components/auth/auth-form";
import { isDemoMode } from "@/lib/config";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your portfolio dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="login" redirectTo={redirectTo} demo={isDemoMode} />
      </CardContent>
    </Card>
  );
}
