// Logik utama: pilih set content hari ini -> semak creator_info -> hantar ke TikTok -> log -> pindah ke posted/
import { getSettings, getPost, upsertPost, log } from "./db.js";
import { listDir, getText, moveDir } from "./github.js";
import { ensureAccessToken, creatorInfo, postPhotos, fetchStatus, TikTokError, RETRYABLE_FAIL } from "./tiktok.js";
import { notify } from "./notify.js";
import { localNow, nowSec, sleep, naturalSort, parseCaption } from "./util.js";
import { setSetting } from "./db.js";

const IMG = /\.(jpe?g|webp)$/i;
const DATE_DIR = /^\d{4}-\d{2}-\d{2}(-[A-Za-z0-9_-]+)?$/;

/** Set hari ini jika ada; jika tiada, set tertua yang bertarikh hari ini atau sebelumnya. */
export async function pickSet(env, today) {
  const dirs = (await listDir(env, "queue"))
    .filter((e) => e.type === "dir" && DATE_DIR.test(e.name))
    .map((e) => e.name)
    .sort();
  const due = dirs.filter((n) => n.slice(0, 10) <= today);
  if (!due.length) return null;
  return due.find((n) => n.startsWith(today)) ?? due[0];
}

/** Dipanggil oleh cron setiap 15 minit. `force` = jalankan sekarang (butang admin). */
export async function tick(env, { force = false, again = false } = {}) {
  const s = await getSettings(env);
  const { date, hm } = localNow(env);
  const row = await getPost(env, date);
  const now = nowSec();

  // 1) Semak semula post yang masih diproses oleh TikTok
  if (row?.status === "processing" && row.publish_id) {
    await finalize(env, s, date, row);
    return;
  }

  if (!force) {
    if (s.paused === "1") return;
    if (hm < s.post_time) return;
    if (row) {
      if (row.status === "ok" || row.status === "skipped") return;
      if (row.status === "failed" && row.attempts >= Number(s.max_attempts)) return;
      if (row.status === "running" && now - row.updated_at < 600) return;
      if (row.status === "failed" && now - row.updated_at < 25 * 60) return; // ulang cuba selang ~30 min
    }
  } else if (row?.status === "ok" && !again) {
    await log(env, "info", "Hari ini sudah berjaya dipost. Gunakan 'Post lagi' jika mahu paksa.");
    return;
  }

  await runOnce(env, s, date, row);
}

async function runOnce(env, s, date, prev) {
  const attempts = (prev?.attempts ?? 0) + 1;
  const mode = s.post_mode;
  await upsertPost(env, date, { status: "running", mode, attempts, error: null });
  let setName = null;
  try {
    setName = await pickSet(env, date);
    if (!setName) {
      throw new TikTokError("queue_empty", "Tiada set content dalam queue/ untuk hari ini. Scheduled task Claude mungkin belum jalan.", true);
    }

    const files = (await listDir(env, `queue/${setName}`)).filter((f) => f.type === "file");
    const images = files.map((f) => f.name).filter((n) => IMG.test(n)).sort(naturalSort);
    if (!images.length) {
      const hasPng = files.some((f) => /\.png$/i.test(f.name));
      throw new TikTokError("no_images", hasPng
        ? "Hanya PNG ditemui. TikTok tidak terima PNG untuk photo post — tukar kepada JPG/WEBP."
        : "Tiada slide JPG/WEBP dalam set.", false);
    }
    if (images.length > 35) images.length = 35;
    const caption = parseCaption(await getText(env, `queue/${setName}/caption.txt`));
    if (!caption.title) throw new TikTokError("no_caption", "caption.txt kosong atau tiada.", false);

    const token = await ensureAccessToken(env);
    const creator = await creatorInfo(env, token); // wajib sebelum setiap post; juga mengesan had harian
    if (creator.creator_username) {
      await setSetting(env, "creator_username", creator.creator_username);
      await setSetting(env, "creator_nickname", creator.creator_nickname ?? "");
    }

    const urls = images.map((n) => `${env.PUBLIC_BASE_URL}/media/${encodeURIComponent(setName)}/${encodeURIComponent(n)}`);
    const init = await postPhotos(env, token, {
      mode, title: caption.title, description: caption.description, imageUrls: urls, settings: s, creator,
    });
    await upsertPost(env, date, { set_name: setName, status: "processing", publish_id: init.publish_id, tiktok_status: "INIT" });
    await log(env, "info", `Hantar ${images.length} slide (${setName}) mod ${mode}, publish_id ${init.publish_id}`);

    // Tunggu sebentar (maks ~16s); jika belum siap, tick seterusnya akan menyemak semula
    const fresh = await getPost(env, date);
    for (let i = 0; i < 4; i++) {
      await sleep(4000);
      if (await finalize(env, s, date, fresh, caption)) return;
    }
  } catch (e) {
    await fail(env, s, date, setName, attempts, e);
  }
}

/** Semak status TikTok. Pulang true jika sudah terminal. */
async function finalize(env, s, date, row, captionHint) {
  let st;
  try {
    const token = await ensureAccessToken(env);
    st = await fetchStatus(env, token, row.publish_id);
  } catch (e) {
    // Ralat sementara semasa semak status: JANGAN tandakan gagal (elak post berganda). Cuba lagi pada tick seterusnya.
    await log(env, "warn", `Semak status gagal sementara: ${e.message ?? e}`);
    return false;
  }
  try {
    const status = st.status;
    await upsertPost(env, date, { tiktok_status: status });
    if (status === "SEND_TO_USER_INBOX" || status === "PUBLISH_COMPLETE") {
      let moved = 0;
      try {
        moved = await moveDir(env, `queue/${row.set_name}`, `posted/${row.set_name}`, `posted: ${row.set_name}`);
      } catch (e) {
        await log(env, "warn", `Pindah ke posted/ gagal: ${e.message}`);
      }
      await upsertPost(env, date, { status: "ok", error: null });
      await log(env, "info", `Berjaya (${status}); ${moved} fail dipindah ke posted/${row.set_name}`);
      const caption = captionHint ?? parseCaption((await getText(env, `posted/${row.set_name}/caption.txt`)) ?? "");
      const draf = status === "SEND_TO_USER_INBOX";
      await notify(
        env,
        draf ? "Draf TikTok sedia — buka TikTok untuk siapkan" : "Content TikTok berjaya dipost",
        `${draf ? "Draf sudah dihantar ke inbox TikTok anda. Buka notifikasi TikTok, pilih muzik jika mahu, tampal caption di bawah dan tekan Post.\n" : "Content sudah dipost.\n"}\nSet: ${row.set_name}\n\nCaption:\n${caption.full ?? ""}`
      );
      return true;
    }
    if (status === "FAILED") {
      const reason = st.fail_reason ?? "unknown";
      throw new TikTokError(reason, `TikTok gagal proses: ${reason}`, RETRYABLE_FAIL.has(reason));
    }
    return false; // masih PROCESSING_DOWNLOAD
  } catch (e) {
    const cur = await getPost(env, date);
    await fail(env, s, date, row.set_name, cur?.attempts ?? 1, e);
    return true;
  }
}

async function fail(env, s, date, setName, attempts, e) {
  const retryable = e instanceof TikTokError ? e.retryable : true;
  const max = Number(s.max_attempts);
  const finalFail = !retryable || attempts >= max;
  await upsertPost(env, date, {
    set_name: setName, status: "failed", error: String(e.message ?? e).slice(0, 500),
    attempts: finalFail ? Math.max(attempts, max) : attempts, publish_id: null,
  });
  await log(env, "error", `Percubaan ${attempts}/${max} gagal: ${e.message ?? e}`);
  if (finalFail) {
    await notify(env, "Post TikTok hari ini GAGAL", `${e.message ?? e}\n\nSet: ${setName ?? "-"}\nSemak halaman admin untuk log penuh.`);
  }
}
