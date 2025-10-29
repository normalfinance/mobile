#!/usr/bin/env node

/**
 * Synchronises the root env file (.env) into an
 * Xcode-friendly shell script (`ios/.xcode.env`).
 *
 * The React Native bundling phase sources `.xcode.env` during both
 * `Run` and `Archive` builds, ensuring `process.env` values are
 * available when Metro bundles the app from Xcode.
 */

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_ENV_SOURCE = path.resolve(PROJECT_ROOT, ".env");
const DEST_PATH = path.resolve(PROJECT_ROOT, "ios", ".xcode.env");

const SOURCE_PATH = process.argv[2]
  ? path.resolve(PROJECT_ROOT, process.argv[2])
  : DEFAULT_ENV_SOURCE;

console.log(SOURCE_PATH);

if (!fs.existsSync(SOURCE_PATH)) {
  console.error(
    `Unable to locate env source file. Expected at ${SOURCE_PATH}.\n` +
      "Pass a relative path as an argument if your env file lives elsewhere."
  );
  process.exit(1);
}

const fileContents = fs.readFileSync(SOURCE_PATH, "utf8");

function parseEnv(contents) {
  const result = [];

  contents.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      return;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      return;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (!key) {
      return;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    const escapedValue = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/`/g, "\\`");

    result.push({ key, value: escapedValue });
  });

  return result;
}

const parsed = parseEnv(fileContents);

if (!parsed.length) {
  console.warn(
    "No assignable variables were found in the env file – `.xcode.env` will be empty."
  );
}

const exportLines = parsed.map(({ key, value }) => `export ${key}="${value}"`);
const header = "# Auto-generated from scripts/sync-xcode-env.js\n";
const body = exportLines.join("\n");

fs.mkdirSync(path.dirname(DEST_PATH), { recursive: true });
fs.writeFileSync(DEST_PATH, `${header}${body}\n`, "utf8");

console.log(`Synced ${parsed.length} environment variables to ${DEST_PATH}`);
