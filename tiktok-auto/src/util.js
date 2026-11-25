// Fungsi bantuan kecil

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const nowSec = () => Math.floor(Date.now() / 1000);

/** Tarikh (YYYY-MM-DD) dan masa (HH:MM) mengikut zon waktu Malaysia (atau TZ_OFFSET_HOURS). */
export function localNow(env, at = Date.now()) {
  const off = Number(env.TZ_OFFSET_HOURS ?? 8);
  const iso = new Date(at + off * 3600 * 1000).toISOString();
  return { date: iso.slice(0, 10), hm: iso.slice(11, 16) };
}

/** Banding rentetan masa-tetap supaya kata laluan tak bocor melalui masa respons. */
export function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a ?? ""));
  const y = new TextEncoder().encode(String(b ?? ""));
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Potong ikut bilangan aksara UTF-16 (had TikTok dikira dalam UTF-16). */
export function clip(s, max) {
  s = String(s ?? "");
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

export function randomId(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Susun nama fail secara semula jadi: slide-2 sebelum slide-10 */
export function naturalSort(a, b) {
  return a.localeCompare(b, "en", { numeric: true });
}

/** caption.txt: baris pertama = tajuk (maks 90), selebihnya = penerangan (maks 4000). */
export function parseCaption(text) {
  const clean = String(text ?? "").replace(/\r\n/g, "\n").trim();
  if (!clean) return { title: "", description: "", full: "" };
  const lines = clean.split("\n");
  const title = clip(lines[0].trim(), 90);
  const rest = lines.slice(1).join("\n").trim();
  // Jika tiada penerangan berasingan, guna keseluruhan teks sebagai penerangan juga
  const description = clip(rest || clean, 4000);
  return { title, description, full: clean };
}
