"use client";

import Link from "next/link";
import { useResearchUrl, useComparisonIds } from "@/hooks/useResearchSession";
import { usePathname } from "next/navigation";
import { IS_STATIC } from "@/lib/config";
import { useCollectionSearch } from "./CollectionSearchContext";

export default function HeaderNav() {
  const pathname = usePathname().replace(/\/+$/, "") || "/";
  const comparisonIds = useComparisonIds();
  const comparisonUrl = comparisonIds.length ? `/compare?${new URLSearchParams({ ids: comparisonIds.join(",") })}` : "/compare";
  const collectionUrl = useResearchUrl("collection");
  const valueUrl = useResearchUrl("value");
  const { query, setQuery } = useCollectionSearch();
  const showSearch = pathname === "/";

  // Pills inside one tray read as a single control, so the destinations group
  // together and apart from the Add action. Azalea marks the selected page,
  // which is the one job branding gives pink.
  function navClass(active: boolean) {
    return `flex h-8 min-w-0 flex-1 items-center justify-center rounded-full px-2 text-xs font-semibold transition-colors sm:flex-none sm:px-4 sm:text-sm ${
      active ? "bg-azalea text-cocoa-950" : "text-cocoa-600 hover:bg-white/70 hover:text-cocoa-900"
    }`;
  }

  return (
    <nav aria-label="Main navigation" className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:flex-1 lg:justify-end">
      {showSearch && (
        <label className="order-last w-full lg:order-none lg:min-w-0 lg:flex-1 lg:max-w-xs">
          <span className="sr-only">Search collection</span>
          <input
            type="search"
            placeholder="Search collection..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input h-9 rounded-full px-4"
          />
        </label>
      )}
      <div className="flex w-full min-w-0 gap-1 rounded-full bg-cocoa-100 p-1 sm:w-auto">
        <Link href={collectionUrl} aria-current={pathname === "/" ? "page" : undefined} className={navClass(pathname === "/")}>
          Collection
        </Link>
        <Link
          href={comparisonUrl}
          aria-current={pathname === "/compare" ? "page" : undefined}
          className={navClass(pathname === "/compare")}
        >
          Compare
        </Link>
        <Link
          href={valueUrl}
          aria-current={pathname === "/value" ? "page" : undefined}
          className={navClass(pathname === "/value")}
        >
          Value
        </Link>
        {!IS_STATIC && (
          <Link
            href="/design"
            aria-current={pathname === "/design" ? "page" : undefined}
            className={navClass(pathname === "/design")}
          >
            Design
          </Link>
        )}
      </div>
      {!IS_STATIC && (
        <Link href="/watch/new" className="btn-primary absolute right-4 top-5 h-9 whitespace-nowrap rounded-full px-3 lg:static sm:px-4">
          + Add<span className="hidden sm:inline"> watch</span>
        </Link>
      )}
    </nav>
  );
}
