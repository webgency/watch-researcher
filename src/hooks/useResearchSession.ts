"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  readCollectionFilters, readValueFilters, writeCollectionFilters, writeValueFilters,
  readSelection, safeResearchUrl, type CollectionFilters, type ValueSearchFilters,
} from "@/lib/research-state";

const CHANGE = "vitrine:session-change";
const memory = new Map<string, string>();
const unwritable = new Set<string>();
function subscribe(listener: () => void) {
  window.addEventListener(CHANGE, listener);
  window.addEventListener("popstate", listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE, listener);
    window.removeEventListener("popstate", listener);
    window.removeEventListener("storage", listener);
  };
}
function announce() { window.dispatchEvent(new Event(CHANGE)); }
function readStored(key: string, fallback: string, local = false) {
  if (unwritable.has(key)) return memory.get(key) ?? fallback;
  try { return (local ? localStorage : sessionStorage).getItem(key) ?? memory.get(key) ?? fallback; }
  catch { return memory.get(key) ?? fallback; }
}
function store(key: string, value: string, local = false) {
  memory.set(key, value);
  try { (local ? localStorage : sessionStorage).setItem(key, value); } catch { unwritable.add(key); /* Retain continuity even when reads work but writes are blocked. */ }
  announce();
}
const routeFor = (scope: "collection" | "value") => scope === "collection" ? "/" : "/value";
const routeKey = (scope: "collection" | "value") => `vitrine:${scope}-url:v1`;

function useUrl(scope: "collection" | "value") {
  const pathname = usePathname().replace(/\/+$/, "") || "/";
  // A server snapshot avoids hydration mismatches and keeps Pages exportable
  // without forcing the whole collection behind a client-only Suspense boundary.
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  useEffect(() => {
    if (pathname !== routeFor(scope) || search !== window.location.search) return;
    const route = `${routeFor(scope)}${search}`;
    if (readStored(routeKey(scope), "") !== route) store(routeKey(scope), route);
  }, [scope, pathname, search]);
  return pathname === routeFor(scope) ? search : "";
}
function updateUrl(params: URLSearchParams, replace: boolean) {
  const url = new URL(window.location.href);
  url.search = params.toString();
  if (url.href === window.location.href) return;
  // Next integrates native history updates without a server request per keypress.
  window.history[replace ? "replaceState" : "pushState"](null, "", url);
  announce();
}
export function useCollectionFilters() {
  const search = useUrl("collection");
  const filters = useMemo(() => readCollectionFilters(new URLSearchParams(search)), [search]);
  function update(patch: Partial<CollectionFilters>, replace = false) {
    const params = new URLSearchParams(window.location.search);
    updateUrl(writeCollectionFilters(params, { ...readCollectionFilters(params), ...patch }), replace);
  }
  return { filters, update };
}
export function useValueFilters() {
  const search = useUrl("value");
  const filters = useMemo(() => readValueFilters(new URLSearchParams(search)), [search]);
  function update(patch: Partial<ValueSearchFilters>, replace = false) {
    const params = new URLSearchParams(window.location.search);
    updateUrl(writeValueFilters(params, { ...readValueFilters(params), ...patch }), replace);
  }
  return { filters, update };
}
export function useResearchUrl(scope: "collection" | "value") {
  const route = routeFor(scope);
  const raw = useSyncExternalStore(subscribe, () => readStored(routeKey(scope), route), () => route);
  return safeResearchUrl(raw, route);
}
export function useCollectionView() {
  const key = "vitrine:collection-view:v1";
  const raw = useSyncExternalStore(subscribe, () => readStored(key, "grid", true), () => "grid");
  return [raw === "table" ? "table" : "grid", (view: "grid" | "table") => store(key, view, true)] as const;
}
export function useComparisonSelection(validIds: string[]) {
  const key = "vitrine:comparison:v1";
  const raw = useSyncExternalStore(subscribe, () => readStored(key, "[]"), () => "[]");
  const selected = new Set(readSelection(raw).filter(id => validIds.includes(id)));
  function setSelected(next: Set<string> | ((current: Set<string>) => Set<string>)) {
    const current = new Set(readSelection(readStored(key, "[]")).filter(id => validIds.includes(id)));
    const result = typeof next === "function" ? next(current) : next;
    store(key, JSON.stringify([...result].filter(id => validIds.includes(id)).slice(0, 4)));
  }
  return [selected, setSelected] as const;
}
