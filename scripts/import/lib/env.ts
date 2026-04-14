import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(
      `\n✖ Missing env var: ${name}\n  Copy .env.example → .env and fill it in.\n`,
    );
    process.exit(1);
  }
  return v;
}

export const env = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  githubToken: process.env.GITHUB_TOKEN ?? null,
};
