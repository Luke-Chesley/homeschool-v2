const defaultDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const config = {
  schema: "./lib/db/schema/**/*.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? defaultDatabaseUrl,
  },
  verbose: true,
  strict: true,
};

export default config;
