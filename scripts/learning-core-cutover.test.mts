import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function walkSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSourceFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!/\.(ts|tsx|mts)$/.test(entry.name)) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

test("legacy app-owned AI modules are deleted", () => {
  const deletedPaths = [
    "app/api/ai/generate/route.ts",
    "app/api/ai/jobs/[jobId]/route.ts",
    "components/copilot/GenerateButton.tsx",
    "lib/ai/learning-core-adapter.ts",
    "lib/ai/provider-adapter.ts",
    "lib/ai/task-service.ts",
    "lib/db/repositories/ai-platform.ts",
    "lib/db/schema/aiPlatform.ts",
    "lib/prompts/store.ts",
    "lib/prompts/curriculum-draft.ts",
    "lib/prompts/lesson-draft.ts",
  ];

  for (const relativePath of deletedPaths) {
    assert.equal(
      existsSync(path.join(repoRoot, relativePath)),
      false,
      `${relativePath} should be deleted after the learning-core cutover.`,
    );
  }
});

test("active app code does not reference deleted prompt or gateway paths", () => {
  const sourceRoots = ["app", "components", "lib"].map((segment) => path.join(repoRoot, segment));
  const files = sourceRoots.flatMap((root) => (existsSync(root) ? walkSourceFiles(root) : []));

  const forbiddenPatterns = [
    { label: "legacy prompt resolver", regex: /resolvePrompt\(/ },
    { label: "legacy gateway path", regex: /\/v1\/gateway\// },
    { label: "deleted prompt module", regex: /lib\/prompts\// },
    { label: "deleted task service", regex: /task-service/ },
    { label: "deleted learning-core adapter", regex: /learning-core-adapter/ },
    { label: "deleted provider adapter", regex: /provider-adapter/ },
    { label: "deleted generate endpoint", regex: /\/api\/ai\/generate\b/ },
  ];

  const violations: string[] = [];

  for (const filePath of files) {
    const source = readFileSync(filePath, "utf8");
    const relativePath = path.relative(repoRoot, filePath);
    for (const pattern of forbiddenPatterns) {
      if (pattern.regex.test(source)) {
        violations.push(`${relativePath}: ${pattern.label}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Active source still references deleted AI paths:\n${violations.join("\n")}`,
  );
});

test("learning-core client surface is operation-based", () => {
  const operationsSource = readFileSync(
    path.join(repoRoot, "lib/learning-core/operations.ts"),
    "utf8",
  );
  const clientSource = readFileSync(
    path.join(repoRoot, "lib/learning-core/client.ts"),
    "utf8",
  );

  assert.match(operationsSource, /\/v1\/operations\/\$\{operationName\}\/prompt-preview/);
  assert.match(operationsSource, /\/v1\/operations\/\$\{operationName\}\/execute/);
  assert.doesNotMatch(clientSource, /\/v1\/gateway\//);
});
