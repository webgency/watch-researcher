"use client";

import { createContext, useContext, useState } from "react";

interface CollectionSearchValue {
  query: string;
  setQuery: (query: string) => void;
}

const CollectionSearchContext = createContext<CollectionSearchValue | null>(null);

export function CollectionSearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  return (
    <CollectionSearchContext.Provider value={{ query, setQuery }}>
      {children}
    </CollectionSearchContext.Provider>
  );
}

export function useCollectionSearch() {
  const context = useContext(CollectionSearchContext);
  if (!context) throw new Error("useCollectionSearch must be used inside CollectionSearchProvider");
  return context;
}
