import { unstable_noStore as noStore } from "next/cache";
import { getWatches } from "@/lib/store";
import { IS_STATIC } from "@/lib/config";
import CompareClient from "@/components/CompareClient";

export default async function ComparePage() {
  // Stay dynamic locally so edits show immediately; allow static prerender for
  // the GitHub Pages export.
  if (!IS_STATIC) noStore();
  const watches = await getWatches();
  return <CompareClient allWatches={watches} />;
}
