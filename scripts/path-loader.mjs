/**
 * Node.js ESM loader that:
 * 1. Resolves the `@/` path alias to the project root
 * 2. Handles TypeScript extensionless relative imports (./foo → ./foo.ts)
 *
 * Usage: node --import ./scripts/path-loader.mjs --test --experimental-strip-types ...
 */
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(fileURLToPath(import.meta.url), "../..");

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const projectRoot = ${JSON.stringify(projectRoot)};
const TS_EXTS = [".ts", "/index.ts"];

function tryAddTsExtension(absPath) {
  if (path.extname(absPath)) return null; // already has extension
  for (const ext of TS_EXTS) {
    const candidate = ext.startsWith("/")
      ? path.join(absPath, ext.slice(1))
      : absPath + ext;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function resolve(specifier, context, nextResolve) {
  // Resolve @/ path alias
  if (specifier.startsWith("@/")) {
    let resolved = path.join(projectRoot, specifier.slice(2));
    const withExt = tryAddTsExtension(resolved);
    if (withExt) resolved = withExt;
    return nextResolve(pathToFileURL(resolved).href, context);
  }

  // Resolve extensionless relative imports (./foo, ../bar)
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier)) {
    const parentDir = context.parentURL
      ? path.dirname(fileURLToPath(context.parentURL))
      : projectRoot;
    const abs = path.resolve(parentDir, specifier);
    const withExt = tryAddTsExtension(abs);
    if (withExt) {
      return nextResolve(pathToFileURL(withExt).href, context);
    }
  }

  return nextResolve(specifier, context);
}
`),
  import.meta.url,
);
