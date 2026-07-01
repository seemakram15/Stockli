"use client";

import * as React from "react";
import { syncPrivateResourceCacheUser } from "@/lib/hooks/use-persistent-resource";

/**
 * Keeps browser-side private cache scoped to the currently signed-in user and
 * cleans up any older device-persisted private entries left by previous builds.
 */
export function PrivateCacheLifecycle({ userId }: { userId: string }) {
  React.useEffect(() => {
    void syncPrivateResourceCacheUser(userId).catch(() => undefined);
  }, [userId]);

  return null;
}
