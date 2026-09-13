"use client";

import Link from "next/link";
import { useResearchUrl } from "@/hooks/useResearchSession";

export default function CollectionLink({ children, className, ...props }: { children: React.ReactNode; className?: string; "aria-label"?: string }) {
  const href = useResearchUrl("collection");
  return <Link href={href} className={className} {...props}>{children}</Link>;
}
