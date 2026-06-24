"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/error/error-state";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root-error]", error);
  }, [error]);

  return (
    <ErrorState
      title="Stockli hit a problem"
      description="The page could not be displayed correctly. Please try again, and if the issue continues contact support so we can look into it."
      reset={reset}
      homeHref="/"
      digest={error.digest}
      className="min-h-screen bg-background"
    />
  );
}
