"use client";

import { createContext, useContext } from "react";
import { useCollectionFilters } from "@/hooks/useResearchSession";

const CollectionSearchContext = createContext<ReturnType<typeof useCollectionFilters> | null>(null);

export function CollectionSearchProvider({ children }: { children: React.ReactNode }) {
  const value = useCollectionFilters();
  return <CollectionSearchContext.Provider value={value}>{children}</CollectionSearchContext.Provider>;
}

export function useCollectionSearch() {
  const context = useContext(CollectionSearchContext);
  if (!context) throw new Error("useCollectionSearch must be used inside CollectionSearchProvider");
  return {
    ...context, query: context.filters.query,
    setQuery: (query: string) => context.update({ query }, true),
  };
}
