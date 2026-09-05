import { promises as fs } from "fs";
import path from "path";

export type CalibrationJudgment = "too-low" | "fair" | "too-high";

export interface ScoringBenchmark {
  watchId: string;
  wearability?: CalibrationJudgment;
  value?: CalibrationJudgment;
  notes?: string;
  updatedAt: string;
}

const DATA_PATH = path.join(process.cwd(), "data", "scoring-benchmarks.json");
const JUDGMENTS = new Set<CalibrationJudgment>(["too-low", "fair", "too-high"]);
let writeQueue: Promise<void> = Promise.resolve();

export function validateBenchmarks(value: unknown): ScoringBenchmark[] {
  if (!Array.isArray(value)) throw new Error("Benchmarks must be an array");
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`benchmarks[${index}] must be an object`);
    const row = item as Record<string, unknown>;
    if (typeof row.watchId !== "string" || !row.watchId.trim()) throw new Error(`benchmarks[${index}].watchId is required`);
    if (row.wearability !== undefined && !JUDGMENTS.has(row.wearability as CalibrationJudgment)) throw new Error(`benchmarks[${index}].wearability is invalid`);
    if (row.value !== undefined && !JUDGMENTS.has(row.value as CalibrationJudgment)) throw new Error(`benchmarks[${index}].value is invalid`);
    if (row.notes !== undefined && typeof row.notes !== "string") throw new Error(`benchmarks[${index}].notes must be text`);
    if (typeof row.updatedAt !== "string" || Number.isNaN(new Date(row.updatedAt).getTime())) throw new Error(`benchmarks[${index}].updatedAt is invalid`);
    return {
      watchId: row.watchId.trim(),
      ...(row.wearability ? { wearability: row.wearability as CalibrationJudgment } : {}),
      ...(row.value ? { value: row.value as CalibrationJudgment } : {}),
      ...(row.notes?.toString().trim() ? { notes: row.notes.toString().trim() } : {}),
      updatedAt: row.updatedAt,
    };
  });
}

export async function getBenchmarks(): Promise<ScoringBenchmark[]> {
  try {
    return validateBenchmarks(JSON.parse(await fs.readFile(DATA_PATH, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function saveBenchmarks(value: unknown): Promise<ScoringBenchmark[]> {
  const benchmarks = validateBenchmarks(value);
  const operation = writeQueue.then(async () => {
    const temporary = `${DATA_PATH}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(benchmarks, null, 2)}\n`, "utf8");
    await fs.rename(temporary, DATA_PATH);
  });
  writeQueue = operation.catch(() => undefined);
  await operation;
  return benchmarks;
}
