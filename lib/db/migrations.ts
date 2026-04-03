import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";

const MIGRATION_TABLE = "_hsv2_schema_migrations";

export async function applySqlMigrations(
  client: ReturnType<typeof postgres>,
  options: { cwd?: string } = {},
) {
  const cwd = options.cwd ?? process.cwd();
  const drizzleDir = path.join(cwd, "drizzle");
  const files = (await readdir(drizzleDir))
    .filter((entry) => entry.endsWith(".sql"))
    .sort();

  await client.unsafe(`
    create table if not exists ${MIGRATION_TABLE} (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const [{ exists }] = await client<{ exists: string | null }[]>`
    select to_regclass('public.organizations') as exists
  `;
  const organizationsExist = Boolean(exists);

  const appliedRows = await client<{ name: string }[]>`
    select name from ${client(MIGRATION_TABLE)}
  `;
  const applied = new Set(appliedRows.map((row) => row.name));

  if (organizationsExist && !applied.has("0000_initial.sql")) {
    await client`
      insert into ${client(MIGRATION_TABLE)} (name)
      values ('0000_initial.sql')
      on conflict (name) do nothing
    `;
    applied.add("0000_initial.sql");
  }

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = await readFile(path.join(drizzleDir, file), "utf8");
    await client.begin(async (tx) => {
      await tx.unsafe(sql);
      await tx.unsafe(
        `insert into ${MIGRATION_TABLE} (name) values ($1)`,
        [file],
      );
    });
  }
}
