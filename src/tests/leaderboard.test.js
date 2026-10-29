import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../../database/SUPABASE_MIGRATION.sql", import.meta.url), "utf8");

test("Supabase migration uses RPCs instead of exposing management tokens", () => {
  assert.match(migration, /publish_bot_creation/);
  assert.match(migration, /withdraw_bot_creation/);
  assert.match(migration, /sha256/);
  assert.doesNotMatch(migration.toLowerCase(), /service_role/);
});

test("Leaderboard migration creates a public view and storage upload restriction", () => {
  assert.match(migration, /create or replace view public\.bot_gallery/);
  assert.match(migration, /security_barrier=true/);
  assert.match(migration, /bucket_id = 'bot-thumbnails'/);
  assert.match(migration, /anonymous thumbnail delete/);
  assert.match(migration, /allowed_mime_types = array\['image\/jpeg','image\/png','image\/webp'\]/);
  assert.match(migration, /file_size_limit = 5242880/);
});
