import { createMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = createMetadata({
  title: "Case board",
  description:
    "Requirements frozen at intake, evidence read back after the case opened, and a charge released only by a grade that passes.",
  path: "/dashboard",
});

export default function DashboardLayout({ children }: { children: ReactNode }): ReactNode {
  return children;
}
