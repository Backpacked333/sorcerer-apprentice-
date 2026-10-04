import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

// No host ports, credentials, or external database URLs: every run gets disposable PostgreSQL.
const container = `tacit-compile-test-${process.pid}`;
function command(args, input = "") {
  const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
  let out = "", err = "";
  child.stdout.on("data", (chunk) => { out += chunk; });
  child.stderr.on("data", (chunk) => { err += chunk; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(out.trim()) : reject(new Error(err || `docker exited ${code}`)));
  });
  if (input !== null) child.stdin.end(input);
  return { child, done, output: () => out };
}
const psql = ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"];
const sql = (query) => command(psql, query).done;
const literal = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
async function until(check) {
  const deadline = Date.now() + 10000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("PostgreSQL test timed out");
    await delay(20);
  }
}
async function lockedTransaction(query) {
  const connection = command(psql, null);
  connection.child.stdin.write(`begin; ${query}; select 'LOCK_READY';\n`);
  await until(() => connection.output().includes("LOCK_READY"));
  return async () => { connection.child.stdin.end("commit;\n"); await connection.done; };
}
const blocked = (name) => until(async () => (await sql(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event_type='Lock';`)) === "1");
const source = { id: "s", task: "original", frames: [{ id: "f" }], windows: [{ id: "w", answerAudioId: "clip" }], transcript: [{ id: "t", text: "Ask the lead", final: true }], offRecord: [] };
const map = { sessionId: "s", revision: 0, task: "compiled" };
const publish = (owner, snapshot = source) => `select public.tacit_publish_compiled_map('${owner}','s',${literal(snapshot)},${literal(map)});`;
const countMaps = (owner) => sql(`select count(*) from work_maps where owner_id='${owner}' and session_id='s';`);

try {
  await command(["run", "--detach", "--network", "none", "--name", container, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-alpine"]).done;
  await until(async () => { try { await command(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]).done; return true; } catch { return false; } });
  await sql("create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
  for (const migration of ["202610030001_durable_workspaces.sql", "202610040001_store_contracts.sql", "202610040002_compile_publication.sql"]) {
    await sql(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
  }
  await sql(`insert into sessions(owner_id,id,data) values ('a','s',${literal(source)}),('b','s',${literal(source)});`);
  assert.equal(JSON.parse(await sql(`set role service_role; ${publish("a")}`)).revision, 1);
  assert.equal(await sql(publish("missing")), "");
  assert.equal(await sql(publish("a", { ...source, task: "stale" })), "");
  assert.equal(await countMaps("a"), "1");
  assert.equal(await sql("select data->>'revision' from work_maps where owner_id='a';"), "1");
  console.log("PASS: exact-source publication, stale/missing source rejection, previous map preserved");

  const changed = { ...source, task: "updated" };
  const releaseUpdate = await lockedTransaction(`update sessions set data=${literal(changed)} where owner_id='a' and id='s'`);
  const pendingPublish = sql(`set application_name='waiting_publish'; ${publish("a")}`);
  await blocked("waiting_publish");
  assert.equal(JSON.parse(await sql(publish("b"))).revision, 1);
  await releaseUpdate();
  assert.equal(await pendingPublish, "");
  assert.equal(await sql("select data->>'revision' from work_maps where owner_id='a';"), "1");
  console.log("PASS: publication waits for session update; other workspace is not blocked");

  const releasePublish = await lockedTransaction(publish("a", changed));
  const withdrawn = { ...changed, offRecord: [{ from: 0, to: 10 }], frames: [], windows: [], transcript: [] };
  const pendingWithdrawal = sql(`set application_name='waiting_withdrawal'; insert into sessions(owner_id,id,data) values ('a','s',${literal(withdrawn)}) on conflict(owner_id,id) do update set data=excluded.data;`);
  await blocked("waiting_withdrawal");
  await releasePublish();
  await pendingWithdrawal;
  assert.equal(await countMaps("a"), "0");
  assert.equal(await countMaps("b"), "1");
  assert.equal(await sql(publish("a", changed)), "");
  console.log("PASS: withdrawal waits for publication, then atomically invalidates only its workspace's map");

  for (const next of [
    { ...source, frames: [] }, { ...source, windows: [] }, { ...source, transcript: [] },
    { ...source, transcript: [{ ...source.transcript[0], redacted: true }] },
    { ...source, transcript: [{ ...source.transcript[0], text: "A correction" }] },
    { ...source, transcript: [{ ...source.transcript[0], final: false }] },
    { ...source, transcript: [{ ...source.transcript[0], speaker: "agent" }] },
    { ...source, offRecord: [{ from: 0, to: 10 }] },
  ]) {
    await sql(`update sessions set data=${literal(source)} where owner_id='a'; ${publish("a")}`);
    await sql(`update sessions set data=${literal(next)} where owner_id='a';`);
    assert.equal(await countMaps("a"), "0");
  }
  await assert.rejects(sql(publish("a", { ...source, id: "other" })), /session mismatch/);
  for (const role of ["anon", "authenticated"]) {
    assert.equal(await sql(`select has_function_privilege('${role}','public.tacit_publish_compiled_map(text,text,jsonb,jsonb)','EXECUTE');`), "f");
  }
  assert.equal(await sql("select has_function_privilege('service_role','public.tacit_publish_compiled_map(text,text,jsonb,jsonb)','EXECUTE');"), "t");
  console.log("PASS: independent evidence withdrawals, mismatched IDs and service-role-only execution");
} finally {
  await command(["rm", "--force", container]).done.catch(() => {});
}
