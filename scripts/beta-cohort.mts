import { getOrganizationBetaMetadata, updateOrganizationBetaMetadata } from "@/lib/beta/service";
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
  const [command = "show", ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  const organizationId = typeof flags.org === "string" ? flags.org : "";

  if (!organizationId) {
    throw new Error("Pass --org <organizationId>.");
  }

  if (command === "set") {
    const result = await updateOrganizationBetaMetadata(organizationId, {
      enrollmentStatus:
        typeof flags.status === "string"
          ? (flags.status as "candidate" | "enrolled" | "paused" | "complete")
          : undefined,
      measurementMode:
        typeof flags.mode === "string" ? (flags.mode as "intent_only" | "live_billing") : undefined,
      cohortLabel: typeof flags.cohort === "string" ? flags.cohort : undefined,
      recruitmentSource: typeof flags.recruitment === "string" ? flags.recruitment : undefined,
      supportNotes: typeof flags.notes === "string" ? flags.notes : undefined,
      enrolledAt:
        typeof flags.enrolledAt === "string" ? new Date(flags.enrolledAt).toISOString() : undefined,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const result = await getOrganizationBetaMetadata(organizationId);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
