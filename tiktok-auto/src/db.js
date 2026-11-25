import { nowSec } from "./util.js";

export const EDITABLE = [
  "paused", "post_time", "post_mode", "privacy_level", "disable_comment",
  "auto_add_music", "is_aigc", "max_attempts", "verify_filename", "verify_content",
];

export function defaults(env) {
  return {
    paused: "0",
    post_time: "08:00",
    post_mode: env.DEFAULT_POST_MODE === "DIRECT_POST" ? "DIRECT_POST" : "MEDIA_UPLOAD",
    privacy_level: "SELF_ONLY",
    disable_comment: "0",
    auto_add_music: "1",
    is_aigc: "0",
    max_attempts: "4",
    verify_filename: "",
    verify_content: "",
    creator_username: "",
    creator_nickname: "",
  };
}

export async function getSettings(env) {
  const out = defaults(env);
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  for (const r of results ?? []) out[r.key] = r.value;
  return out;
}

export async function setSetting(env, key, value) {
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2"
  ).bind(key, String(value)).run();
}

export async function log(env, level, msg) {
  try {
    await env.DB.prepare("INSERT INTO logs (ts, level, msg) VALUES (?1, ?2, ?3)")
      .bind(nowSec(), level, String(msg).slice(0, 1500)).run();
    // Simpan 500 log terkini sahaja
    await env.DB.prepare("DELETE FROM logs WHERE id <= (SELECT MAX(id) FROM logs) - 500").run();
  } catch (e) {
    console.error("log gagal", e);
  }
}

export async function getToken(env) {
  return (await env.DB.prepare("SELECT * FROM tokens WHERE id = 1").first()) ?? null;
}

export async function saveToken(env, t) {
  const now = nowSec();
  await env.DB.prepare(
    `INSERT INTO tokens (id, open_id, access_token, refresh_token, access_expires_at, refresh_expires_at, scope, updated_at)
     VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT(id) DO UPDATE SET open_id=?1, access_token=?2, refresh_token=?3,
       access_expires_at=?4, refresh_expires_at=?5, scope=?6, updated_at=?7`
  ).bind(
    t.open_id ?? null, t.access_token, t.refresh_token,
    now + Number(t.expires_in ?? 86400), now + Number(t.refresh_expires_in ?? 31536000),
    t.scope ?? "", now
  ).run();
}

export async function deleteToken(env) {
  await env.DB.prepare("DELETE FROM tokens WHERE id = 1").run();
}

export async function getPost(env, day) {
  return (await env.DB.prepare("SELECT * FROM posts WHERE day = ?1").bind(day).first()) ?? null;
}

export async function upsertPost(env, day, fields) {
  const now = nowSec();
  const cur = await getPost(env, day);
  if (!cur) {
    await env.DB.prepare(
      `INSERT INTO posts (day, set_name, mode, status, publish_id, tiktok_status, error, attempts, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)`
    ).bind(
      day, fields.set_name ?? null, fields.mode ?? null, fields.status ?? "running",
      fields.publish_id ?? null, fields.tiktok_status ?? null, fields.error ?? null,
      fields.attempts ?? 0, now
    ).run();
    return;
  }
  const m = { ...cur, ...fields };
  await env.DB.prepare(
    `UPDATE posts SET set_name=?2, mode=?3, status=?4, publish_id=?5, tiktok_status=?6,
       error=?7, attempts=?8, updated_at=?9 WHERE day=?1`
  ).bind(day, m.set_name, m.mode, m.status, m.publish_id, m.tiktok_status, m.error, m.attempts, now).run();
}

export async function recentPosts(env, n = 14) {
  const { results } = await env.DB.prepare("SELECT * FROM posts ORDER BY day DESC LIMIT ?1").bind(n).all();
  return results ?? [];
}

export async function recentLogs(env, n = 40) {
  const { results } = await env.DB.prepare("SELECT ts, level, msg FROM logs ORDER BY id DESC LIMIT ?1").bind(n).all();
  return results ?? [];
}
