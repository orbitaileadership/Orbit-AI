import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "supabase");
const target = join(root, ".local-supabase", "supabase");
const migrations = join(target, "migrations");
const names = (await readdir(join(source, "migrations")))
  .filter(name => /^\d+_.+\.sql$/.test(name))
  .sort();

if (names.length === 0 || names.length > 9999) throw new Error("invalid_migration_count");
await mkdir(migrations, { recursive: true });

const config = await readFile(join(source, "config.toml"), "utf8");
const localConfig = config.replace(/^project_id = "[^"]+"$/m, 'project_id = "orbit-ai-large-file-local"');
if (localConfig === config) throw new Error("missing_project_id");
await writeFile(join(target, "config.toml"), localConfig);

for (const name of await readdir(migrations)) {
  if (/^20261026\d{6}_.+\.sql$/.test(name)) await unlink(join(migrations, name));
}
for (const [index, name] of names.entries()) {
  const version = `20261026${String(index + 1).padStart(6, "0")}`;
  await writeFile(
    join(migrations, `${version}_${name}`),
    await readFile(join(source, "migrations", name)),
  );
}
console.log(`Prepared ${names.length} local-only migrations in .local-supabase.`);
