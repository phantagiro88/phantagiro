// Halaman Terma Perkhidmatan dan Dasar Privasi (diperlukan untuk audit TikTok). Dwibahasa.
import { escapeHtml } from "./util.js";

const shell = (title, body) => `<!doctype html><html lang="ms"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#222}
h1{font-size:1.5rem}h2{font-size:1.15rem;margin-top:1.6em}a{color:#8a6a00}small{color:#666}</style></head>
<body>${body}</body></html>`;

export function termsPage(env) {
  const app = escapeHtml(env.APP_NAME);
  const mail = escapeHtml(env.CONTACT_EMAIL);
  return shell(`Terma Perkhidmatan — ${env.APP_NAME}`, `
<h1>Terma Perkhidmatan / Terms of Service</h1>
<small>Dikemas kini / Last updated: 2026-11-25</small>

<h2>Bahasa Melayu</h2>
<p>${app} ialah alat peribadi yang dimiliki dan dikendalikan oleh Dr. Sakinah Azami (@drsakinahazami) untuk menjadualkan dan menghantar content buatan sendiri ke akaun TikTok milik sendiri.</p>
<ul>
<li>Perkhidmatan ini tidak dibuka kepada orang awam dan tidak menyediakan akaun untuk pengguna lain.</li>
<li>Semua content yang dihantar ialah content asal pemilik akaun. Pemilik bertanggungjawab ke atas content tersebut dan mematuhi Terma Perkhidmatan serta Garis Panduan Komuniti TikTok.</li>
<li>Pemilik boleh menjeda atau memutuskan sambungan pada bila-bila masa melalui halaman admin atau menarik balik kebenaran di tetapan TikTok.</li>
<li>Perkhidmatan disediakan "seadanya" tanpa jaminan.</li>
</ul>
<p>Hubungi: ${mail}</p>

<h2>English</h2>
<p>${app} is a personal tool owned and operated by Dr. Sakinah Azami (@drsakinahazami) to schedule and send her own original content to her own TikTok account.</p>
<ul>
<li>The service is not offered to the public and does not provide accounts to other users.</li>
<li>All content sent is original content created by the account owner, who is responsible for it and for complying with TikTok's Terms of Service and Community Guidelines.</li>
<li>The owner can pause the service or disconnect at any time from the admin page, or revoke access in TikTok settings.</li>
<li>The service is provided "as is" without warranty.</li>
</ul>
<p>Contact: ${mail}</p>
`);
}

export function privacyPage(env) {
  const app = escapeHtml(env.APP_NAME);
  const mail = escapeHtml(env.CONTACT_EMAIL);
  return shell(`Dasar Privasi — ${env.APP_NAME}`, `
<h1>Dasar Privasi / Privacy Policy</h1>
<small>Dikemas kini / Last updated: 2026-11-25</small>

<h2>Bahasa Melayu</h2>
<p>${app} hanya digunakan oleh pemiliknya, Dr. Sakinah Azami, untuk akaun TikTok sendiri.</p>
<ul>
<li><b>Data yang disimpan:</b> pengecam akaun TikTok (open_id), token akses dan token segar TikTok, nama pengguna dan nama paparan akaun, serta log penghantaran (tarikh, status, ID penerbitan).</li>
<li><b>Tujuan:</b> semata-mata untuk menghantar content ke akaun TikTok pemilik. Data tidak dijual, dikongsi atau digunakan untuk iklan.</li>
<li><b>Penyimpanan:</b> dalam pangkalan data peribadi Cloudflare D1 milik pemilik. Content disimpan dalam repo GitHub peribadi pemilik.</li>
<li><b>Pemadaman:</b> tekan "Putuskan sambungan" di halaman admin untuk memadam token, atau tarik balik kebenaran dalam tetapan TikTok (Keselamatan dan kebenaran &gt; Apl dan perkhidmatan). Untuk pemadaman penuh, hubungi ${mail}.</li>
</ul>

<h2>English</h2>
<p>${app} is used only by its owner, Dr. Sakinah Azami, for her own TikTok account.</p>
<ul>
<li><b>Data stored:</b> TikTok account identifier (open_id), TikTok access and refresh tokens, account username and display name, and posting logs (date, status, publish ID).</li>
<li><b>Purpose:</b> solely to send content to the owner's TikTok account. Data is not sold, shared or used for advertising.</li>
<li><b>Storage:</b> in the owner's private Cloudflare D1 database. Content is kept in the owner's private GitHub repository.</li>
<li><b>Deletion:</b> press "Disconnect" on the admin page to delete tokens, or revoke access in TikTok settings (Security and permissions &gt; Apps and services). For full deletion contact ${mail}.</li>
</ul>
<p>Contact: ${mail}</p>
`);
}
