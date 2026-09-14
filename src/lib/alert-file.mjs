// Reading and writing data/alerts.json. Separate from alerts.mjs so client
// components can import the alert rules without pulling in node:fs.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { alertStateErrors, emptyAlertState, normalizeAlertState } from "./alerts.mjs";

/** @typedef {import("./alerts.mjs").AlertState} AlertState */

function toPath(file) {
  return file instanceof URL ? fileURLToPath(file) : file;
}

/**
 * The alert log, or an empty one when the file doesn't exist yet. A malformed
 * file throws rather than being replaced: it holds settings and read state.
 * @param {string | URL} file
 * @returns {Promise<AlertState>}
 */
export async function readAlertState(file) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(toPath(file), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return emptyAlertState();
    throw new Error(`Could not read alerts at ${toPath(file)}: ${error.message}`);
  }
  const errors = alertStateErrors(parsed);
  if (errors.length) throw new Error(`Invalid alerts at ${toPath(file)}: ${errors.join("; ")}`);
  return normalizeAlertState(parsed);
}

/**
 * Validate, then write atomically.
 * @param {string | URL} file
 * @param {AlertState} state
 */
export async function writeAlertState(file, state) {
  const errors = alertStateErrors(state);
  if (errors.length) throw new Error(`Refusing to write invalid alerts: ${errors.join("; ")}`);
  const path = toPath(file);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
  await rename(temporary, path);
}
