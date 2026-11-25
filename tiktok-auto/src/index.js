import { json, html, safeEqual, randomId, nowSec, escapeHtml } from "./util.js";
import { EDITABLE, getSettings, setSetting, getToken, deleteToken, recentPosts, recentLogs, log } from "./db.js";
import { listDir, getRaw, getText } from "./github.js";
import { authorizeUrl, exchangeCode, ensureAccessToken, creatorInfo } from "./tiktok.js";
import { tick } from "./runner.js";
import { termsPage, privacyPage } from "./pages.js";

const SAFE_SEG = /^[A-Za-z0-9._-]+$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/terms") return html(termsPage(env));
      if (path === "/privacy") return html(privacyPage(env));

      // Fail pengesahan domain/URL prefix TikTok (nama + isi disimpan dari halaman admin)
      if (path.length > 1 && (request.method === "GET" || request.method === "HEAD")) {
        const s = await getSettings(env).catch(() => null);
        if (s?.verify_filename && path === `/${s.verify_filename}`) {
          return new Response(request.method === "HEAD" ? null : s.verify_content, {
            headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
          });
        }
      }

      // Hidangkan slide kepada TikTok (PULL_FROM_URL). Cari dalam queue/ kemudian posted/.
      if (path.startsWith("/media/")) return serveMedia(request, env, path);

      if (path === "/auth/callback") return oauthCallback(url, env);
      if (path.startsWith("/api/")) return api(request, env, ctx, url);

      return env.ASSETS.fetch(request);
    } catch (e) {
      console.error(e);
      return json({ ok: false, error: String(e.message ?? e) }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      tick(env).catch(async (e) => {
        await log(env, "error", `Cron ralat: ${e.message ?? e}`);
      })
    );
  },
};

async function serveMedia(request, env, path) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const parts = path.split("/").slice(2).map(decodeURIComponent);
  if (parts.length !== 2 || !parts.every((p) => SAFE_SEG.test(p) && !p.includes(".."))) {
    return new Response("Not found", { status: 404 });
  }
  const [set, file] = parts;
  if (!/\.(jpe?g|webp|png)$/i.test(file)) return new Response("Not found", { status: 404 });

  for (const folder of ["queue", "posted"]) {
    const res = await getRaw(env, `${folder}/${set}/${file}`);
    if (res.ok) {
      const type = /\.webp$/i.test(file) ? "image/webp" : /\.png$/i.test(file) ? "image/png" : "image/jpeg";
      const headers = { "content-type": type, "cache-control": "public, max-age=3600" };
      const len = res.headers.get("content-length");
      if (len) headers["content-length"] = len;
      return new Response(request.method === "HEAD" ? null : res.body, { status: 200, headers });
    }
    if (res.status !== 404) return new Response("Upstream error", { status: 502 });
  }
  return new Response("Not found", { status: 404 });
}

async function oauthCallback(url, env) {
  const page = (msg, ok) =>
    html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font:16px system-ui;padding:24px;max-width:560px;margin:auto"><h2>${ok ? "Berjaya" : "Gagal"}</h2>
<p>${escapeHtml(msg)}</p><p><a href="/">Kembali ke halaman admin</a></p></body>`, ok ? 200 : 400);

  const err = url.searchParams.get("error");
  if (err) return page(`TikTok memulangkan ralat: ${err} ${url.searchParams.get("error_description") ?? ""}`, false);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return page("Parameter tidak lengkap.", false);

  const row = await env.DB.prepare("SELECT created_at FROM oauth_states WHERE state = ?1").bind(state).first();
  await env.DB.prepare("DELETE FROM oauth_states WHERE state = ?1").bind(state).run();
  if (!row || nowSec() - row.created_at > 600) return page("Sesi sambungan tamat atau tidak sah. Cuba tekan Sambung TikTok semula.", false);

  try {
    await exchangeCode(env, code);
    const token = await ensureAccessToken(env);
    try {
      const c = await creatorInfo(env, token);
      await setSetting(env, "creator_username", c.creator_username ?? "");
      await setSetting(env, "creator_nickname", c.creator_nickname ?? "");
    } catch (e) {
      await log(env, "warn", `creator_info selepas login: ${e.message}`);
    }
    await log(env, "info", "TikTok berjaya disambungkan");
    return Response.redirect(`${env.PUBLIC_BASE_URL}/?connected=1`, 302);
  } catch (e) {
    await log(env, "error", `Sambungan TikTok gagal: ${e.message}`);
    return page(e.message, false);
  }
}

async function api(request, env, ctx, url) {
  if (!safeEqual(request.headers.get("x-admin-password"), env.ADMIN_PASSWORD) || !env.ADMIN_PASSWORD) {
    return json({ ok: false, error: "Kata laluan salah" }, 401);
  }
  const route = url.pathname.slice(5);
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};

  if (route === "status") {
    const [settings, token, posts, logs] = await Promise.all([getSettings(env), getToken(env), recentPosts(env), recentLogs(env)]);
    let queue = [];
    try {
      queue = (await listDir(env, "queue")).filter((e) => e.type === "dir").map((e) => e.name).sort();
    } catch (e) {
      queue = [`(ralat GitHub: ${e.message})`];
    }
    let progress = null;
    try { progress = JSON.parse((await getText(env, "progress.json")) ?? "null"); } catch { /* abaikan */ }
    return json({
      ok: true,
      settings,
      connected: !!token,
      token: token ? { expires_at: token.access_expires_at, refresh_expires_at: token.refresh_expires_at, scope: token.scope } : null,
      posts, logs, queue, progress,
      redirect_uri: `${env.PUBLIC_BASE_URL}/auth/callback`,
      public_base_url: env.PUBLIC_BASE_URL,
      has_notify: !!((env.RESEND_API_KEY && env.NOTIFY_EMAIL) || (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID)),
    });
  }

  if (route === "settings" && request.method === "POST") {
    const clean = {};
    for (const [k, v] of Object.entries(body)) {
      if (!EDITABLE.includes(k)) continue;
      let val = String(v ?? "").trim();
      if (k === "post_time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) return json({ ok: false, error: "Format masa mesti HH:MM" }, 400);
      if (k === "post_mode" && !["MEDIA_UPLOAD", "DIRECT_POST"].includes(val)) return json({ ok: false, error: "Mod tidak sah" }, 400);
      if (k === "privacy_level" && !["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"].includes(val)) return json({ ok: false, error: "Privasi tidak sah" }, 400);
      if (k === "verify_filename") {
        val = val.replace(/^\/+/, "");
        if (val && !/^[A-Za-z0-9._-]{3,120}$/.test(val)) return json({ ok: false, error: "Nama fail pengesahan tidak sah" }, 400);
      }
      if (["paused", "disable_comment", "auto_add_music", "is_aigc"].includes(k)) val = val === "1" || val === "true" ? "1" : "0";
      if (k === "max_attempts") val = String(Math.min(5, Math.max(1, parseInt(val, 10) || 4)));
      clean[k] = val;
    }
    for (const [k, v] of Object.entries(clean)) await setSetting(env, k, v);
    await log(env, "info", `Tetapan diubah: ${Object.keys(clean).join(", ")}`);
    return json({ ok: true });
  }

  if (route === "connect-url") {
    const state = randomId(16);
    await env.DB.prepare("INSERT INTO oauth_states (state, created_at) VALUES (?1, ?2)").bind(state, nowSec()).run();
    await env.DB.prepare("DELETE FROM oauth_states WHERE created_at < ?1").bind(nowSec() - 3600).run();
    return json({ ok: true, url: authorizeUrl(env, state) });
  }

  if (route === "disconnect" && request.method === "POST") {
    await deleteToken(env);
    await log(env, "info", "Sambungan TikTok diputuskan");
    return json({ ok: true });
  }

  if (route === "test-creator" && request.method === "POST") {
    try {
      const token = await ensureAccessToken(env);
      const c = await creatorInfo(env, token);
      await setSetting(env, "creator_username", c.creator_username ?? "");
      await setSetting(env, "creator_nickname", c.creator_nickname ?? "");
      return json({ ok: true, creator: { username: c.creator_username, nickname: c.creator_nickname, privacy_level_options: c.privacy_level_options, comment_disabled: c.comment_disabled } });
    } catch (e) {
      return json({ ok: false, error: e.message }, 200);
    }
  }

  if (route === "run-now" && request.method === "POST") {
    ctx.waitUntil(tick(env, { force: true, again: !!body.again }).catch((e) => log(env, "error", `Run-now ralat: ${e.message ?? e}`)));
    return json({ ok: true, message: "Dimulakan. Muat semula log dalam beberapa saat." });
  }

  return json({ ok: false, error: "Laluan tidak dikenali" }, 404);
}
