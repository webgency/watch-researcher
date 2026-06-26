import { promises as fs } from "fs";
import path from "path";
import { Watch, WatchInput } from "./types";
import { validateWatchCollection } from "./validation";

// The collection lives in a single JSON file at the repo root so it can be
// version-controlled and backed up alongside the app. When you later want to
// use this on multiple devices, swap this module for a database-backed one and
// keep the same function signatures.
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_PATH = path.join(DATA_DIR, "watches.json");
let writeQueue: Promise<void> = Promise.resolve();

export async function getWatches(): Promise<Watch[]> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const data = JSON.parse(raw);
    return validateWatchCollection(data);
  } catch (error) {
    if (isMissingFileError(error)) return [];
    throw error;
  }
}

export async function getWatch(id: string): Promise<Watch | undefined> {
  const watches = await getWatches();
  return watches.find((w) => w.id === id);
}

export async function getWatchesByIds(ids: string[]): Promise<Watch[]> {
  const watches = await getWatches();
  const byId = new Map(watches.map((w) => [w.id, w]));
  // Preserve the order the ids were requested in.
  return ids.map((id) => byId.get(id)).filter((w): w is Watch => Boolean(w));
}

async function saveAll(watches: Watch[]): Promise<void> {
  validateWatchCollection(watches);
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmpPath = `${DATA_PATH}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(watches, null, 2) + "\n", "utf-8");
  await fs.rename(tmpPath, DATA_PATH);
}

export async function addWatch(input: WatchInput): Promise<Watch> {
  return withWriteLock(async () => {
    const watches = await getWatches();
    const watch: Watch = {
      ...input,
      id: generateId(),
      dateAdded: new Date().toISOString(),
    };
    watches.push(watch);
    await saveAll(watches);
    return watch;
  });
}

export async function updateWatch(
  id: string,
  patch: Partial<WatchInput>
): Promise<Watch | undefined> {
  return withWriteLock(async () => {
    const watches = await getWatches();
    const idx = watches.findIndex((w) => w.id === id);
    if (idx === -1) return undefined;
    // id and dateAdded are immutable.
    const existing = watches[idx];
    watches[idx] = { ...existing, ...patch, id: existing.id, dateAdded: existing.dateAdded };
    await saveAll(watches);
    return watches[idx];
  });
}

export async function deleteWatch(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const watches = await getWatches();
    const next = watches.filter((w) => w.id !== id);
    if (next.length === watches.length) return false;
    await saveAll(next);
    return true;
  });
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

async function withWriteLock<T>(work: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(work, work);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
