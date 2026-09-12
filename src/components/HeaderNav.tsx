"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IS_STATIC } from "@/lib/config";
import { useCollectionSearch } from "./CollectionSearchContext";

export default function HeaderNav() {
  const pathname = usePathname();
  const { query, setQuery } = useCollectionSearch();
  const showSearch = pathname === "/";

  function navClass(active: boolean) {
    return `relative flex h-10 min-w-0 flex-1 items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors sm:flex-none sm:px-3 sm:text-sm ${
      active
        ? "text-cocoa-900 after:absolute after:inset-x-3 after:bottom-0 after:h-1 after:rounded-full after:bg-azalea"
        : "text-cocoa-600 hover:bg-cocoa-50 hover:text-cocoa-900"
    }`;
  }

  return (
    <nav aria-label="Main navigation" className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-1 lg:justify-end">
      {showSearch && (
        <label className="order-last w-full lg:order-none lg:min-w-0 lg:flex-1 lg:max-w-xs">
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
      <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={navClass(pathname === "/")}>
        Collection
      </Link>
      <Link
        href="/compare"
        aria-current={pathname === "/compare" ? "page" : undefined}
        className={navClass(pathname === "/compare")}
      >
        Compare
      </Link>
      <Link
        href="/value"
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
      {!IS_STATIC && (
        <Link href="/watch/new" className="btn-primary absolute right-4 top-5 whitespace-nowrap px-3 lg:static sm:px-4">
          + Add<span className="hidden sm:inline"> watch</span>
        </Link>
      )}
    </nav>
  );
}
