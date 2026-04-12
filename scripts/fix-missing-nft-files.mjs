import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walk(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".nft.json")) {
      results.push(fullPath);
    }
  }

  return results;
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fixTraceFile(tracePath) {
  const raw = await readFile(tracePath, "utf8");
  const trace = JSON.parse(raw);
  const traceDir = path.dirname(tracePath);

  const keptFiles = [];
  const removedFiles = [];

  for (const file of trace.files ?? []) {
    const absolutePath = path.resolve(traceDir, file);
    if (await exists(absolutePath)) {
      keptFiles.push(file);
    } else {
      removedFiles.push(file);
    }
  }

  if (removedFiles.length === 0) {
    return null;
  }

  trace.files = keptFiles;
  await writeFile(tracePath, `${JSON.stringify(trace)}\n`, "utf8");

  return {
    tracePath: path.relative(root, tracePath),
    removedFiles,
  };
}

async function main() {
  const serverAppDir = path.join(root, ".next", "server", "app");
  const traceFiles = await walk(serverAppDir);
  const changes = [];

  for (const tracePath of traceFiles) {
    const change = await fixTraceFile(tracePath);
    if (change) {
      changes.push(change);
    }
  }

  if (changes.length === 0) {
    console.log("No stale nft trace entries found.");
    return;
  }

  console.log("Removed stale nft trace entries:");
  for (const change of changes) {
    console.log(`- ${change.tracePath}`);
    for (const removedFile of change.removedFiles) {
      console.log(`  - ${removedFile}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
