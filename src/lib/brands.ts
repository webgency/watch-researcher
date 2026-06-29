import { promises as fs } from "fs";
import path from "path";
import { BrandCatalog, BrandInfo } from "./types";
import { validateBrandCatalog } from "./validation";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_PATH = path.join(DATA_DIR, "brands.json");

export async function getBrands(): Promise<BrandCatalog> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const data = JSON.parse(raw);
    return validateBrandCatalog(data);
  } catch (error) {
    if (isMissingFileError(error)) return {};
    throw error;
  }
}

export function resolveBrandInfo(brand: string, brands: BrandCatalog): BrandInfo | undefined {
  const normalized = normalizeBrandName(brand);
  if (!normalized) return undefined;
  const match = Object.entries(brands).find(([name]) => normalizeBrandName(name) === normalized);
  return match?.[1];
}

export function resolveBrandReputation(brand: string, brands: BrandCatalog): number | undefined {
  return resolveBrandInfo(brand, brands)?.reputationTier;
}

export function brandReputationMap(brands: BrandCatalog): Record<string, number> {
  return Object.fromEntries(Object.entries(brands).map(([brand, info]) => [brand, info.reputationTier]));
}

function normalizeBrandName(value: string): string {
  return value.trim().toLowerCase();
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
