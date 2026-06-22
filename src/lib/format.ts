import { Money } from "./types";

export function formatMoney(money?: Money | null): string {
  if (!money || typeof money.amount !== "number" || Number.isNaN(money.amount)) {
    return "—";
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: money.currency || "USD",
      maximumFractionDigits: 0,
    }).format(money.amount);
  } catch {
    return `${money.amount} ${money.currency ?? ""}`.trim();
  }
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Hostname only, for displaying a link compactly (e.g. "chrono24.com"). */
export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function titleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
