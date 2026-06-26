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
      {!IS_STATIC && (
        <Link href="/watch/new" className="btn-primary shrink-0">
          + Add watch
        </Link>
      )}
    </nav>
  );
}
