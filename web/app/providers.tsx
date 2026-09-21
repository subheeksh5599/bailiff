"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createContext, useContext, useMemo } from "react";

/**
 * The live connection, or an honest absence of one.
 *
 * When NEXT_PUBLIC_CONVEX_URL is not configured there is deliberately no client
 * and no fallback data: the app renders and says it is not connected. A board
 * showing invented cases would be worse than a board showing none.
 */
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

type BackendState = { configured: boolean };

const BackendContext = createContext<BackendState>({ configured: Boolean(convexUrl) });

export function useBackend(): BackendState {
  return useContext(BackendContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => (convexUrl ? new ConvexReactClient(convexUrl) : null), []);
  if (!client) {
    return <BackendContext.Provider value={{ configured: false }}>{children}</BackendContext.Provider>;
  }
  return (
    <BackendContext.Provider value={{ configured: true }}>
      <ConvexProvider client={client}>{children}</ConvexProvider>
    </BackendContext.Provider>
  );
}
