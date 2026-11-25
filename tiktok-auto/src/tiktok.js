// TikTok Content Posting API + Login Kit (OAuth) — semua percuma
import { getToken, saveToken } from "./db.js";
import { nowSec } from "./util.js";

const OPEN = "https://open.tiktokapis.com";
export const SCOPES = "user.info.basic,video.upload,video.publish";

export function redirectUri(env) {
  return `${env.PUBLIC_BASE_URL}/auth/callback`;
}

export function authorizeUrl(env, state) {
  const p = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY,
    scope: SCOPES,
    response_type: "code",
    redirect_uri: redirectUri(env),
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${p}`;
}

async function tokenRequest(env, params) {
  const body = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY,
    client_secret: env.TIKTOK_CLIENT_SECRET,
    ...params,
  });
  const res = await fetch(`${OPEN}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(`TikTok token gagal: ${data.error ?? res.status} ${data.error_description ?? ""}`.trim());
  }
  return data;
}

export async function exchangeCode(env, code) {
  const data = await tokenRequest(env, {
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(env),
  });
  await saveToken(env, data);
  return data;
}

/** Pulangkan access token yang sah; segarkan automatik jika hampir tamat (<10 minit). */
export async function ensureAccessToken(env) {
  const t = await getToken(env);
  if (!t) throw new TikTokError("not_connected", "TikTok belum disambungkan. Buka halaman admin dan tekan Sambung TikTok.", false);
  const now = nowSec();
  if (t.access_expires_at - now > 600) return t.access_token;
  if (t.refresh_expires_at <= now) {
    throw new TikTokError("refresh_expired", "Sambungan TikTok sudah tamat. Sambung semula di halaman admin.", false);
  }
  const data = await tokenRequest(env, { grant_type: "refresh_token", refresh_token: t.refresh_token });
  await saveToken(env, { ...data, open_id: data.open_id ?? t.open_id });
  return data.access_token;
}

export class TikTokError extends Error {
  constructor(code, message, retryable = true) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

// Ralat yang tak perlu diulang
const FATAL = new Set([
  "spam_risk_too_many_posts", "spam_risk_user_banned_from_posting", "spam_risk_too_many_pending_share",
  "reached_active_user_cap", "unaudited_client_can_only_post_to_private_accounts",
  "url_ownership_unverified", "privacy_level_option_mismatch", "scope_not_authorized",
  "invalid_param", "app_version_check_failed", "access_token_invalid",
]);

async function api(env, token, path, body) {
  const res = await fetch(`${OPEN}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  const code = data?.error?.code ?? (res.ok ? "ok" : `http_${res.status}`);
  if (code !== "ok") {
    const msg = `${code}: ${data?.error?.message ?? ""} (log_id ${data?.error?.log_id ?? data?.error?.logid ?? "-"})`;
    throw new TikTokError(code, msg, !FATAL.has(code));
  }
  return data.data ?? {};
}

/** Wajib disemak sebelum setiap post. Juga mengesan had harian. */
export async function creatorInfo(env, token) {
  return api(env, token, "/v2/post/publish/creator_info/query/");
}

export async function postPhotos(env, token, { mode, title, description, imageUrls, settings, creator }) {
  const postInfo = { title, description };
  if (mode === "DIRECT_POST") {
    const options = creator?.privacy_level_options ?? [];
    let privacy = settings.privacy_level;
    if (!options.includes(privacy)) {
      // Hormati pilihan akaun: jika pilihan tidak dibenarkan, guna yang paling terhad
      privacy = options.includes("SELF_ONLY") ? "SELF_ONLY" : options[0];
    }
    postInfo.privacy_level = privacy;
    postInfo.disable_comment = settings.disable_comment === "1" || creator?.comment_disabled === true;
    postInfo.auto_add_music = settings.auto_add_music === "1";
  }
  const body = {
    post_info: postInfo,
    source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: imageUrls },
    post_mode: mode,
    media_type: "PHOTO",
  };
  if (settings.is_aigc === "1") body.is_aigc = true;
  return api(env, token, "/v2/post/publish/content/init/", body);
}

export async function fetchStatus(env, token, publishId) {
  return api(env, token, "/v2/post/publish/status/fetch/", { publish_id: publishId });
}

export const RETRYABLE_FAIL = new Set(["internal", "photo_pull_failed"]);
