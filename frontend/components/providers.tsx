"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useMemo, type ReactNode } from "react";

/**
 * One client, created once, pointed at the deployment the site was built
 * against.
 *
 * When the variable is missing there is deliberately no client and no quiet
 * fallback to sample data: the screens say the backend is not configured and
 * show nothing, because a board full of invented cases is worse than an empty
 * one.
 */
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export const backendConfigured = Boolean(convexUrl);

export function Providers({ children }: { children: ReactNode }): ReactNode {
  const client = useMemo(() => (convexUrl ? new ConvexReactClient(convexUrl) : null), []);
  if (!client) return <>{children}</>;
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}

export function useBackend(): { configured: boolean; url: string | null } {
  return { configured: backendConfigured, url: convexUrl ?? null };
}
