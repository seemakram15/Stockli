"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/error/error-state";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <ErrorState
      title="This screen could not be loaded"
      description="Something interrupted this page while loading your market or portfolio data. Try again once, and if it repeats contact support with the error reference below."
      reset={reset}
      homeHref="/dashboard"
      digest={error.digest}
    />
  );
}
