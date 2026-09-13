import { CONFIDENCE_LABEL, CONFIDENCE_STYLE } from "@/lib/market-copy";
import type { MarketConfidence } from "@/lib/valuation";

const TITLE: Record<MarketConfidence, string> = {
  insufficient: "Fewer than two independent dated sources, so no estimate is made",
  low: "Two sources, or evidence that is no longer recent",
  medium: "Three or more sources, most of them within 90 days",
  high: "Five or more sources, all within 30 days",
};

/** The one confidence chip. Same words and colours wherever confidence is shown. */
export default function ConfidenceChip({ confidence }: { confidence: MarketConfidence }) {
  return (
    <span
      title={TITLE[confidence]}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${CONFIDENCE_STYLE[confidence]}`}
    >
      {CONFIDENCE_LABEL[confidence]}
    </span>
  );
}
