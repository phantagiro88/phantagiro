// Notifikasi percuma: emel (Resend, pelan percuma) dan/atau Telegram bot. Kedua-duanya pilihan.
import { log } from "./db.js";

export async function notify(env, subject, text) {
  const jobs = [];

  if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
    jobs.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        // onboarding@resend.dev hanya boleh hantar ke emel pemilik akaun Resend — mencukupi untuk kegunaan sendiri
        body: JSON.stringify({ from: "TikTok Auto <onboarding@resend.dev>", to: [env.NOTIFY_EMAIL], subject, text }),
      }).then(async (r) => { if (!r.ok) throw new Error(`Resend ${r.status} ${(await r.text()).slice(0, 120)}`); })
    );
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    jobs.push(
      fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `${subject}\n\n${text}`.slice(0, 4000) }),
      }).then(async (r) => { if (!r.ok) throw new Error(`Telegram ${r.status}`); })
    );
  }

  const results = await Promise.allSettled(jobs);
  for (const r of results) if (r.status === "rejected") await log(env, "warn", `Notifikasi gagal: ${r.reason?.message ?? r.reason}`);
  return jobs.length;
}
