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
    <nav className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-1 sm:justify-end">
      {showSearch && (
        <label className="order-last w-full sm:order-none sm:min-w-0 sm:flex-1 sm:max-w-xs">
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
        className={`btn-secondary h-9 min-w-0 flex-1 px-2 sm:flex-none sm:px-3 ${pathname === "/compare" ? "border-slate-900 text-slate-900" : ""}`}
      >
        Compare
      </Link>
      <Link
        href="/value"
        className={`btn-secondary h-9 min-w-0 flex-1 px-2 sm:flex-none sm:px-3 ${pathname === "/value" ? "border-slate-900 text-slate-900" : ""}`}
      >
        Value
      </Link>
      {!IS_STATIC && (
        <Link
          href="/design"
          className={`btn-secondary h-9 min-w-0 flex-1 px-2 sm:flex-none sm:px-3 ${pathname === "/design" ? "border-slate-900 text-slate-900" : ""}`}
        >
          Design
        </Link>
      )}
      {!IS_STATIC && (
        <Link href="/watch/new" className="btn-primary min-w-0 flex-1 px-2 sm:flex-none sm:px-4">
          + Add<span className="hidden sm:inline"> watch</span>
        </Link>
      )}
    </nav>
  );
}
