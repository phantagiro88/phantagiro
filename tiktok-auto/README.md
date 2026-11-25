# TikTok Auto: @drsakinahazami

Sistem automasi content TikTok harian, semuanya percuma (Cloudflare Workers + D1, GitHub, TikTok Content Posting API rasmi).

```
05:07  Scheduled task Claude  -> tulis slide JPG + caption.txt ke queue/<tarikh>/ di GitHub
08:00  Worker Cloudflare (cron) -> baca queue/, semak creator_info, hantar ke TikTok (draf)
                                -> pindah ke posted/, log di D1, notifikasi emel/Telegram
```

## 1. Apa yang anda perlu sediakan

| Perkara | Dari mana | Untuk apa |
|---|---|---|
| Akaun TikTok for Developers | developers.tiktok.com (log masuk dengan akaun TikTok @drsakinahazami) | Client key dan client secret |
| GitHub token (fine-grained) | GitHub > Settings > Developer settings > Fine-grained tokens. Repo: `phantagiro` sahaja. Permission: **Contents = Read and write** | Worker baca queue/ dan pindah ke posted/ |
| Foto anda, 8 hingga 15 keping | Letak dalam `tiktok-auto/photos/` di repo | Slide pertama. Foto muka separuh badan, ruang kosong di bahagian bawah |
| Kata laluan admin | Anda reka sendiri (panjang, unik) | Masuk halaman admin |
| Emel anda | Untuk halaman Terma dan Privasi serta notifikasi | Pilihan: akaun percuma di resend.com atau bot Telegram |

Struktur repo (letak folder `tiktok-auto/` ini dalam repo `phantagiro`):

```
tiktok-auto/
  wrangler.jsonc  schema.sql  package.json
  src/            kod Worker
  public/         halaman admin (PWA) + ikon
  queue/<tarikh>/ slide-01.jpg ... + caption.txt   (diisi oleh Claude)
  posted/<tarikh>/                                  (Worker pindah ke sini selepas berjaya)
  photos/         foto anda
  titles.json     90 tajuk + link artikel
  progress.json   tajuk yang sudah digunakan
  scheduled-task/ render_slides.py + ARAHAN.md
```

## 2. Deploy Worker (langkah demi langkah)

Semua dari komputer dengan Node.js, atau minta saya jalankan bersama anda.

1. Salin folder `tiktok-auto/` ke repo `phantagiro`, commit dan push.
2. Dalam folder itu: `npm install` kemudian `npx wrangler login` (log masuk Cloudflare).
3. Cipta pangkalan data: `npx wrangler d1 create tiktok-auto`. Salin `database_id` yang keluar ke `wrangler.jsonc` (ganti `GANTI_DENGAN_DATABASE_ID_D1`).
4. Cipta jadual: `npm run db:init`.
5. Deploy kali pertama: `npx wrangler deploy`. Ia mencetak URL, contoh `https://tiktok-auto.NAMA-ANDA.workers.dev`.
6. Edit `wrangler.jsonc`: letak URL itu pada `PUBLIC_BASE_URL` dan emel anda pada `CONTACT_EMAIL`. Deploy semula (`npx wrangler deploy`).
7. Masukkan rahsia (satu per satu, tampal bila diminta):
   ```
   npx wrangler secret put GITHUB_TOKEN
   npx wrangler secret put TIKTOK_CLIENT_KEY
   npx wrangler secret put TIKTOK_CLIENT_SECRET
   npx wrangler secret put ADMIN_PASSWORD
   # pilihan, notifikasi:
   npx wrangler secret put RESEND_API_KEY      # + NOTIFY_EMAIL (emel akaun Resend anda)
   npx wrangler secret put NOTIFY_EMAIL
   npx wrangler secret put TELEGRAM_BOT_TOKEN  # + TELEGRAM_CHAT_ID
   npx wrangler secret put TELEGRAM_CHAT_ID
   ```
8. Buka `https://URL-ANDA/` di telefon, masuk dengan kata laluan admin, dan pilih **Add to Home Screen**.

Auto-deploy dari GitHub (pilihan): Cloudflare > Workers > tiktok-auto > Settings > Builds > sambung repo `phantagiro`, root directory `tiktok-auto`, dan di **Build watch paths** letak `tiktok-auto/src/**,tiktok-auto/public/**,tiktok-auto/wrangler.jsonc` supaya commit content harian tidak mencetuskan build.

## 3. Daftar TikTok for Developers

1. Pergi ke developers.tiktok.com, log masuk, dan **Manage apps > Connect an app** (jenis: Individual / organisasi jika diminta).
2. Isi maklumat app: nama (contoh "Dr Sakinah Content Scheduler"), ikon (guna `public/icon-512.png`), kategori, penerangan (alat peribadi untuk menjadualkan content sendiri), **Terms of Service URL** = `https://URL-ANDA/terms`, **Privacy Policy URL** = `https://URL-ANDA/privacy`.
3. **Add products:**
   - **Login Kit**: tambah Redirect URI `https://URL-ANDA/auth/callback`.
   - **Content Posting API**: aktifkan. Untuk direct post kemudian, hidupkan juga **Direct Post**.
4. **Scopes:** minta `user.info.basic`, `video.upload` (draf/inbox) dan `video.publish` (direct post; juga diperlukan untuk semakan `creator_info`).
5. **Sahkan URL (wajib untuk PULL_FROM_URL):** di **URL properties**, pilih **URL prefix**, masukkan `https://URL-ANDA/`, tekan Verify, dan TikTok beri nama fail (contoh `tiktokAbC123.txt`) serta isinya. Buka halaman admin > **Pengesahan URL TikTok**, tampal nama fail dan isi, Simpan, kemudian tekan Verify di TikTok.
   - Jika TikTok menolak subdomain `workers.dev` (domain kongsi), pilihan lain: domain sendiri (kos kira-kira RM30 setahun) atau subdomain percuma. Ini satu-satunya titik yang saya tak dapat sahkan tanpa akaun anda, jadi cuba dahulu.
6. **Sandbox:** sebelum app diluluskan, guna mod **Sandbox** (tambah akaun TikTok anda sebagai Target User) untuk menguji log masuk dan penghantaran draf.
7. **Audit (hanya untuk direct post awam):** tekan Submit for review. TikTok akan minta video demo aliran penuh dan penerangan penggunaan. Sehingga lulus, semua post oleh app yang belum diaudit dihadkan kepada **privasi "Hanya saya"**, dan akaun mesti persendirian ketika post. Mod **draf (inbox)** tidak bergantung pada audit untuk berfungsi: anda menyiapkan dan menekan Post sendiri dalam TikTok.

   Jujur: TikTok menjangka app direct post menunjukkan pilihan privasi/komen kepada pengguna dan persetujuan eksplisit sebelum post. Alat automatik peribadi mungkin tak lulus audit. Sebab itu lalai sistem ialah draf, dan direct post hanya suis tambahan.
8. Selepas Verify berjaya, di halaman admin tekan **Sambung TikTok**, log masuk, dan benarkan. Kemudian tekan **Uji creator_info**; ia sepatutnya memaparkan nama pengguna anda.

## 4. Cara sistem berfungsi dan had

- **Draf (lalai):** TikTok menghantar notifikasi ke inbox. Buka, tambah muzik jika mahu, tampal caption (disertakan dalam emel/Telegram jika dihidupkan) dan tekan Post. Dalam mod draf, TikTok menerima tajuk/penerangan tetapi pratetapan caption mungkin tak muncul pada semua versi app, sebab itu caption dihantar sekali dalam notifikasi.
- **Direct post:** halaman admin > Mod > Direct post. Worker sentiasa memanggil `creator_info` dahulu dan menghormati pilihan privasi akaun. Jika pilihan anda tak dibenarkan, ia jatuh kepada pilihan paling terhad.
- **Had harian:** satu post sehari oleh sistem; had TikTok biasanya kira-kira 15 post sehari bagi setiap akaun. Jika `creator_info` atau post memulangkan `spam_risk_too_many_posts` dan sebagainya, sistem berhenti, log dan beritahu anda (tidak mengulang).
- **Format gambar:** TikTok tidak menerima PNG untuk photo post. Skrip slide menyimpan **JPG** (kualiti 95, 1080x1440, 3:4). Jika JPG ditolak semasa ujian sandbox, tukar `quality`/format kepada WEBP dalam `render_slides.py`; Worker menerima `.jpg` dan `.webp`.
- **Ulang cuba:** jika gagal (kecuali ralat kekal seperti URL belum disahkan), Worker cuba semula setiap ~30 minit sehingga 4 kali, kemudian menghantar notifikasi gagal.
- **Content lewat:** jika scheduled task belum siap pada 8:00, Worker cuba lagi kemudian. Jika tiada set hari ini, ia guna set tertua yang tertunggak.
- **Token:** disimpan dalam D1 anda dan disegarkan automatik. Sambungan semula diperlukan kira-kira setahun sekali.
- **Jeda:** halaman admin > Jeda sistem. Anda juga boleh tukar masa post di situ (tiada deploy semula).
- **Keselamatan:** slide dihidang di `/media/...` secara awam (TikTok perlu menariknya); ia memang content yang akan dipost. Halaman admin dilindungi kata laluan; token GitHub dan TikTok dalam secret/D1, bukan dalam repo.

## 5. Scheduled task Claude

Lihat `scheduled-task/ARAHAN.md`: arahan lengkap untuk disalin ke scheduled task (harian, 5:07 pagi waktu Malaysia). Pilihan gaya (STYLE1 satu slide, STYLE2 beberapa slide bernombor) ditukar dengan satu perkataan di bahagian atas arahan.

## 6. Ujian tempatan

`npm test` menjalankan ujian hujung-ke-hujung dengan GitHub, TikTok dan D1 palsu (Node 22+).
