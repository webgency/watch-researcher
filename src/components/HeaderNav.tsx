"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IS_STATIC } from "@/lib/config";
import { useCollectionSearch } from "./CollectionSearchContext";

export default function HeaderNav() {
  const pathname = usePathname();
  const { query, setQuery } = useCollectionSearch();
  const showSearch = pathname === "/";

  return (
    <nav className="flex flex-1 items-center justify-end gap-2">
      {showSearch && (
        <label className="min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Search collection</span>
          <input
            type="search"
            placeholder="Search collection..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input h-9"
          />
        </label>
      )}
      <Link
        href="/compare"
        className={`btn-secondary h-9 shrink-0 px-3 ${pathname === "/compare" ? "border-slate-900 text-slate-900" : ""}`}
      >
        Compare
      </Link>
      <Link
        href="/value"
        className={`btn-secondary h-9 shrink-0 px-3 ${pathname === "/value" ? "border-slate-900 text-slate-900" : ""}`}
      >
        Value
      </Link>
      {!IS_STATIC && (
        <Link href="/watch/new" className="btn-primary shrink-0">
          + Add watch
        </Link>
      )}
    </nav>
  );
}
