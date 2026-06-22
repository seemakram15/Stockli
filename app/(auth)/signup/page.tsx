import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthForm } from "@/components/auth/auth-form";
import { isDemoMode } from "@/lib/config";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>Start tracking your PSX portfolio in minutes.</CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="signup" demo={isDemoMode} />
      </CardContent>
    </Card>
  );
}
