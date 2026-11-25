// Ujian hhujung-ke-hujung dengan D1 palsu (node:sqlite) dan GitHub/TikTok palsu.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { tick } from "../src/runner.js";
import { parseCaption, localNow } from "../src/util.js";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
const mk = (sql) => {
  let args = [];
  const st = sqlite.prepare(sql.replace(/\?(\d+)/g, "?$1"));
  const o = {
    bind: (...a) => { args = a; return o; },
    run: async () => { st.run(...args); return {}; },
    first: async () => st.get(...args) ?? null,
    all: async () => ({ results: st.all(...args) }),
  };
  return o;
};
const DB = { prepare: mk };

const today = localNow({ TZ_OFFSET_HOURS: "8" }).date;
const env = {
  DB, ASSETS: { fetch: async () => new Response("asset") },
  GITHUB_OWNER: "o", GITHUB_REPO: "r", GITHUB_BRANCH: "main", BASE_PATH: "tiktok-auto", GITHUB_TOKEN: "ghp",
  PUBLIC_BASE_URL: "https://t.example.workers.dev", TZ_OFFSET_HOURS: "8", DEFAULT_POST_MODE: "MEDIA_UPLOAD",
  TIKTOK_CLIENT_KEY: "ck", TIKTOK_CLIENT_SECRET: "cs", ADMIN_PASSWORD: "pw", CONTACT_EMAIL: "a@b.c", APP_NAME: "X",
};

// ---- fetch palsu ----
const calls = [];
let statusSeq = ["PROCESSING_DOWNLOAD", "SEND_TO_USER_INBOX"];
const files = { [`tiktok-auto/queue/${today}`]: ["slide-02.jpg", "slide-01.jpg", "slide-10.jpg", "caption.txt"] };
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  calls.push({ url, method: init.method ?? "GET", body: init.body });
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
  if (url.includes("api.github.com") && url.includes("/contents/")) {
    const p = decodeURIComponent(url.split("/contents/")[1].split("?")[0]);
    if (p.endsWith("caption.txt")) return new Response("Tajuk Ujian\n\nIsi caption\n#emas");
    if (p.endsWith(".jpg")) return new Response("JPEGDATA", { headers: { "content-length": "8" } });
    if (p === "tiktok-auto/queue") return J(Object.keys(files).map((k) => ({ name: k.split("/").pop(), type: "dir" })));
    if (files[p]) return J(files[p].map((n) => ({ name: n, type: "file", sha: "sha_" + n })));
    return J({}, 404);
  }
  if (url.includes("/git/ref/heads")) return J({ object: { sha: "head1" } });
  if (url.includes("/git/commits/head1")) return J({ tree: { sha: "tree1" } });
  if (url.endsWith("/git/trees")) { const b = JSON.parse(init.body); assert.equal(b.tree.length, 8); assert.ok(b.tree.some((t) => t.sha === null)); return J({ sha: "tree2" }); }
  if (url.endsWith("/git/commits")) return J({ sha: "commit2" });
  if (url.includes("/git/refs/heads")) return J({});
  if (url.includes("oauth/token")) return J({ access_token: "act.1", refresh_token: "rft.1", expires_in: 86400, refresh_expires_in: 31536000, open_id: "oid", scope: "video.upload,video.publish" });
  if (url.includes("creator_info")) return J({ data: { creator_username: "drsakinahazami", creator_nickname: "Dr Sakinah", privacy_level_options: ["SELF_ONLY"] }, error: { code: "ok" } });
  if (url.includes("content/init")) return J({ data: { publish_id: "p123" }, error: { code: "ok" } });
  if (url.includes("status/fetch")) return J({ data: { status: statusSeq.shift() ?? "SEND_TO_USER_INBOX" }, error: { code: "ok" } });
  throw new Error("fetch tak dijangka: " + url);
};
// percepatkan sleep
const realST = globalThis.setTimeout; globalThis.setTimeout = (f) => realST(f, 0);

const ctx = { waitUntil: (p) => p };
const req = (path, init) => worker.fetch(new Request("https://t.example.workers.dev" + path, init), env, ctx);

// 1. caption
const c = parseCaption("Tajuk\n\nBadan\n#a");
assert.equal(c.title, "Tajuk"); assert.equal(c.description, "Badan\n#a");

// 2. halaman awam + auth
assert.match(await (await req("/terms")).text(), /Terma Perkhidmatan/);
assert.match(await (await req("/privacy")).text(), /Dasar Privasi/);
assert.equal((await req("/api/status")).status, 401);
assert.equal((await req("/api/status", { headers: { "x-admin-password": "salah" } })).status, 401);
const adm = { "x-admin-password": "pw", "content-type": "application/json" };

// 3. pengesahan URL dinamik
assert.equal((await req("/api/settings", { method: "POST", headers: adm, body: JSON.stringify({ verify_filename: "tiktokAbc.txt", verify_content: "tiktok-developers-site-verification=abc" }) })).status, 200);
assert.equal(await (await req("/tiktokAbc.txt")).text(), "tiktok-developers-site-verification=abc");
assert.equal((await req("/api/settings", { method: "POST", headers: adm, body: JSON.stringify({ post_time: "25:99" }) })).status, 400);

// 4. media route (selamat + berfungsi)
assert.equal((await req(`/media/${today}/slide-01.jpg`)).headers.get("content-type"), "image/jpeg");
assert.equal((await req(`/media/..%2F..%2Fx/slide.jpg`)).status, 404);
assert.equal((await req(`/media/${today}/rahsia.txt`)).status, 404);

// 5. belum sambung -> gagal tak boleh ulang, tiada post
await tick(env, { force: true });
let st = await (await req("/api/status", { headers: adm })).json();
assert.equal(st.posts[0].status, "failed"); assert.match(st.posts[0].error, /belum disambungkan/);

// 6. OAuth: connect-url + callback
const cu = await (await req("/api/connect-url", { method: "POST", headers: adm, body: "{}" })).json();
const state = new URL(cu.url).searchParams.get("state");
assert.equal(new URL(cu.url).searchParams.get("scope"), "user.info.basic,video.upload,video.publish");
const cb = await req(`/auth/callback?code=abc&state=${state}`);
assert.equal(cb.status, 302);
assert.equal((await req(`/auth/callback?code=abc&state=${state}`)).status, 400); // state sekali guna

// 7. post penuh (draf)
await tick(env, { force: true, again: true });
st = await (await req("/api/status", { headers: adm })).json();
assert.equal(st.posts[0].status, "ok", JSON.stringify(st.posts[0]));
assert.equal(st.posts[0].tiktok_status, "SEND_TO_USER_INBOX");
const init = calls.find((x) => x.url.includes("content/init"));
const b = JSON.parse(init.body);
assert.equal(b.post_mode, "MEDIA_UPLOAD"); assert.equal(b.media_type, "PHOTO");
assert.deepEqual(b.source_info.photo_images.map((u) => u.split("/").pop()), ["slide-01.jpg", "slide-02.jpg", "slide-10.jpg"]); // susunan semula jadi
assert.equal(b.post_info.title, "Tajuk Ujian");
assert.ok(calls.some((x) => x.url.endsWith("/git/trees")), "fail dipindah ke posted/");

// 8. hari sama sudah ok -> cron biasa tak post lagi
const before = calls.filter((x) => x.url.includes("content/init")).length;
await tick(env);
assert.equal(calls.filter((x) => x.url.includes("content/init")).length, before);

console.log("SEMUA UJIAN LULUS");
