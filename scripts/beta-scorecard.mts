import {
  buildBetaHouseholdScorecard,
  listBetaHouseholdScorecards,
} from "@/lib/beta/service";
import { ensureDatabaseReady } from "@/lib/db/server";

type Flags = Record<string, string | boolean>;

function parseFlags(argv: string[]) {
  const flags: Flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return flags;
}

async function main() {
  await ensureDatabaseReady();
  const flags = parseFlags(process.argv.slice(2));
  const organizationId = typeof flags.org === "string" ? flags.org : null;
  const cohortLabel = typeof flags.cohort === "string" ? flags.cohort : undefined;

  if (organizationId) {
    const result = await buildBetaHouseholdScorecard(organizationId);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const results = await listBetaHouseholdScorecards({
    cohortLabel,
    statuses: ["enrolled", "paused", "complete"],
  });
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
