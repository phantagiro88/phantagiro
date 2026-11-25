# Arahan Scheduled Task Claude (tampal sebagai satu blok)

**Nama:** Content TikTok harian @drsakinahazami
**Jadual:** setiap hari, 5:07 pagi waktu Malaysia (`CRON_TZ=Asia/Kuala_Lumpur 7 5 * * *`)
**Perlu:** repo GitHub `phantagiro88/phantagiro` disambungkan dengan akses push (lihat README bahagian 2).

Salin semua di bawah garisan ke kotak arahan scheduled task.

---

Anda menyediakan content TikTok harian untuk Dr. Sakinah Azami (@drsakinahazami). Guna Bahasa Melayu dan perkataan "content" (bukan "kandungan"). Tiada sesiapa menunggu jawapan, jadi jangan tanya soalan: ambil tafsiran paling munasabah, nyatakan di awal log apa yang anda pilih, dan teruskan.

## Tetapan (ubah satu perkataan jika perlu)
GAYA = STYLE1
(STYLE1 = satu slide: foto + tajuk + mata ringkas dengan penerangan pendek. STYLE2 = beberapa slide bernombor "01 / NN" dengan "SWIPE →", tanpa caption pada slide.)

## Persediaan
1. Sambung repo `phantagiro88/phantagiro` dengan akses push (add_repo, access push), clone, dan masuk folder `tiktok-auto/` di dalamnya. Semua laluan di bawah relatif kepada folder itu.
2. Tarikh hari ini ialah tarikh waktu Malaysia (UTC+8), format YYYY-MM-DD. Panggil `TARIKH`.
3. Jika `queue/TARIKH/` atau `posted/TARIKH/` sudah wujud, berhenti: content hari ini sudah ada. Tulis satu baris log dan tamat.

## Langkah 1: pilih tajuk
- Baca `titles.json` (90 tajuk: n, title, url) dan `progress.json` (`used` = nombor yang sudah digunakan).
- Pilih nombor `n` terkecil yang belum ada dalam `used`. Jika semua 90 sudah digunakan, mula semula dari 1 dan kosongkan `used`.

## Langkah 2: baca artikel
- WebFetch `url` tajuk itu. Gunakan hanya fakta dalam artikel. Jangan reka angka, nama atau testimoni.
- Artikel lama (sebelum 2017) mungkin ada harga emas zaman itu. Jangan letak angka harga emas pada slide atau caption kecuali ia contoh matematik yang masih sah, dan nyatakan ia contoh.
- Jika artikel tidak boleh dibaca, pilih nombor seterusnya dan cuba lagi (maksimum 3 kali). Jika masih gagal, tulis `queue/TARIKH/GAGAL.txt` dengan sebab, commit, dan tamat (jangan tinggalkan set separuh siap).

## Langkah 3: pilih foto
- Senarai fail dalam `photos/` (jpg/jpeg/png/webp). Jika kosong, tulis `queue/TARIKH/GAGAL.txt` ("folder photos/ kosong") dan tamat.
- Pilih foto yang paling lama tidak digunakan berdasarkan `progress.json` > `history[].photo`. Foto yang belum pernah digunakan didahulukan. Hanya guna foto Dr. Sakinah sendiri dari folder ini.

## Langkah 4: sediakan slide
Tulis `spec.json` sementara (di luar repo, contoh `/tmp/spec.json`):
```
{"style":"style1","photo":"photos/NAMA.jpg","title":"<tajuk photomode>",
 "points":[{"head":"<mata 1, maks 6 patah perkataan>","body":"<penerangan 1 ayat pendek>"}, ...]}
```
- STYLE1: 3 hingga 4 mata. Setiap penerangan satu ayat pendek (maks kira-kira 70 aksara) supaya muat pada slide.
- STYLE2: tukar `"style":"style2"`, sehingga 7 mata, dan tambah `"closing":"Ikut @drsakinahazami dan daftar Public Gold percuma. Link di bio."`.
- Mata mesti datang daripada isi artikel, bukan pendapat anda.

Jalankan: `python3 -I scheduled-task/render_slides.py /tmp/spec.json /tmp/out`
Skrip menghasilkan 1080x1440 (3:4), foto pudar ke hitam, aksen emas, tajuk serif besar, handle @drsakinahazami di kanan bawah TANPA ikon TikTok, dan `SWIPE →` serta nombor `01 / NN` untuk STYLE2. Ia menyimpan JPG (untuk TikTok) dan PNG pratonton dalam `/tmp/out/_png/`.

**Semak sendiri sebelum commit:** buka setiap PNG pratonton dengan Read. Pastikan tiada teks terpotong atau bertindih, tajuk kelihatan penuh, muka pada foto tidak ditutup teks, dan handle ada di kanan bawah. Jika ada masalah, pendekkan teks atau pilih foto lain, dan render semula.

## Langkah 5: tulis caption.txt (loghat utara)
Format fail: baris pertama = tajuk TikTok (maks 90 aksara); baris kosong; kemudian caption penuh (maks 4000 aksara) termasuk hashtag.

Gaya wajib (ikut contoh Dr. Sakinah):
1. **Hook** pada kesilapan atau perkara biasa yang ramai orang buat.
2. **Ayat pendek**, satu idea satu baris.
3. **Jambatan "Kenapa?"** yang menerangkan sebab.
4. **Contoh sebenar** daripada artikel (orang, situasi atau kiraan yang ada dalam artikel).
5. **CTA:** ikut @drsakinahazami dan daftar Public Gold percuma melalui link di bio.
- Loghat utara yang natural dan tidak melampau: contoh "dak" (tak ada), "ghama" (ramai), "habih" (habis), "pi" (pergi), "betui" (betul). Beberapa perkataan sudah cukup; jangan paksa setiap ayat.
- Panggil pembaca **"anda"**. Jangan sekali-kali guna "hang".
- Tiada janji untung, tiada angka harga emas semasa, tiada tuntutan perubatan atau kewangan yang pasti. Tambah satu baris pendek di hujung: "Ini perkongsian pengalaman, bukan nasihat kewangan."
- Hashtag di hujung (3 hingga 5): contoh #simpanemas #publicgold #tabunganemas #kewangan.

## Langkah 6: commit dan push
1. Salin `/tmp/out/slide-*.jpg` ke `queue/TARIKH/` dan tulis `queue/TARIKH/caption.txt`. **Jangan commit PNG** (TikTok tidak menerima PNG untuk photo post).
2. Kemas kini `progress.json`: tambah `n` ke `used`, set `last_run` kepada TARIKH, dan tambah ke `history`: `{"date":"TARIKH","n":n,"title":"...","photo":"NAMA.jpg","style":"STYLE1"}`.
3. `git add queue progress.json`, commit dengan mesej `content TARIKH: #n tajuk`, dan push ke `main`.
4. Sahkan push berjaya (`git log origin/main -1`).

## Akhir
Tulis ringkasan satu perenggan pendek: tajuk yang dipilih, foto, gaya, dan sebarang masalah. Worker Cloudflare akan mengambil set ini dan menghantarnya ke TikTok pada masa post yang ditetapkan (lalai 8:00 pagi).
