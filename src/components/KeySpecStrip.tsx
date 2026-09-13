"use client";

import { useId, useState } from "react";
import { keySpecs, SPEC_FIELDS } from "@/lib/specs";
import type { Watch } from "@/lib/types";
import SpecChapters from "./SpecChapters";

/** Keep the first-read measurements visible; reveal their source chapter on
 * request. Fields and chapter membership still come from the shared schema. */
export default function KeySpecStrip({ watch }: { watch: Pick<Watch, "specs" | "qualityFlags"> }) {
  const items = keySpecs(watch.specs);
  const panelId = useId();
  const [selected, setSelected] = useState<string>();
  const chapter = SPEC_FIELDS.find((field) => field.key === selected)?.chapter;

  function toggle(key: string) {
    setSelected((current) => current === key ? undefined : key);
  }

  return (
    <div className="border-t border-cocoa-200 pt-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-cocoa-500">At a glance</p>
      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-expanded={selected === item.key}
              aria-controls={panelId}
              onClick={() => toggle(item.key)}
              className={`min-h-16 min-w-0 rounded-2xl border px-3 py-3 text-left transition-colors ${item.key === "caliber" ? "col-span-2 sm:col-span-4" : ""} ${selected === item.key ? "border-azalea bg-azalea-50" : "border-cocoa-200 bg-white/70 hover:border-cocoa-400 hover:bg-white"}`}
            >
              <span className="flex items-center justify-between gap-2 text-xs font-medium text-cocoa-500">
                {item.label}
                <span aria-hidden="true">{selected === item.key ? "−" : "+"}</span>
              </span>
              <span className="mt-1 block break-words text-base font-semibold tabular-nums text-cocoa-900">{item.value}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-cocoa-500">Key specifications haven&apos;t been recorded yet.</p>
      )}
      <button
        type="button"
        aria-expanded={selected === "all"}
        aria-controls={panelId}
        onClick={() => toggle("all")}
        className="mt-3 inline-flex min-h-11 items-center gap-3 rounded-full px-3 text-sm font-semibold text-azalea-700 hover:bg-white"
      >
        {selected === "all" ? "Hide specifications" : "Full specifications"}
        <span aria-hidden="true">{selected === "all" ? "−" : "+"}</span>
      </button>
      <div id={panelId} hidden={!selected} className="mt-3">
        {selected && <SpecChapters watch={watch} chapterId={chapter} />}
      </div>
    </div>
  );
}
