// Akses repo GitHub (peribadi) menggunakan token dalam Cloudflare secret.
// Semua laluan di bawah BASE_PATH (contoh: tiktok-auto/queue/2026-11-26/slide-01.jpg)

const API = "https://api.github.com";

function headers(env, extra = {}) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    "User-Agent": "tiktok-auto-worker",
    "X-GitHub-Api-Version": "2022-11-28",
    Accept: "application/vnd.github+json",
    ...extra,
  };
}

const repoPath = (env) => `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
const full = (env, p) => [env.BASE_PATH, p].filter(Boolean).join("/").replace(/\/+/g, "/");
const enc = (p) => p.split("/").map(encodeURIComponent).join("/");

async function gh(env, path, init = {}) {
  const res = await fetch(API + path, { ...init, headers: headers(env, init.headers) });
  return res;
}

async function mustJson(res, what) {
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`GitHub ${what} gagal (${res.status}): ${t.slice(0, 200)}`);
  }
  return res.json();
}

/** Senarai kandungan folder. Pulang [] jika folder tak wujud. */
export async function listDir(env, rel) {
  const p = full(env, rel);
  const res = await gh(env, `${repoPath(env)}/contents/${enc(p)}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`);
  if (res.status === 404) return [];
  const data = await mustJson(res, `senarai ${p}`);
  return Array.isArray(data) ? data : [];
}

/** Fail mentah (streaming) — digunakan untuk hidangkan gambar kepada TikTok. */
export async function getRaw(env, rel) {
  const p = full(env, rel);
  return gh(env, `${repoPath(env)}/contents/${enc(p)}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`, {
    headers: { Accept: "application/vnd.github.raw+json" },
  });
}

export async function getText(env, rel) {
  const res = await getRaw(env, rel);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub baca ${rel} gagal (${res.status})`);
  return res.text();
}

/**
 * Pindahkan semua fail dalam folder `fromRel` ke `toRel` dalam SATU commit
 * (guna Git Trees API, tiada muat turun kandungan fail).
 */
export async function moveDir(env, fromRel, toRel, message) {
  const files = (await listDir(env, fromRel)).filter((f) => f.type === "file");
  if (!files.length) return 0;

  const rp = repoPath(env);
  const ref = await mustJson(await gh(env, `${rp}/git/ref/heads/${encodeURIComponent(env.GITHUB_BRANCH)}`), "ref");
  const headSha = ref.object.sha;
  const commit = await mustJson(await gh(env, `${rp}/git/commits/${headSha}`), "commit");

  const tree = [];
  for (const f of files) {
    tree.push({ path: `${full(env, toRel)}/${f.name}`, mode: "100644", type: "blob", sha: f.sha });
    tree.push({ path: `${full(env, fromRel)}/${f.name}`, mode: "100644", type: "blob", sha: null });
  }
  const newTree = await mustJson(
    await gh(env, `${rp}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: commit.tree.sha, tree }) }),
    "tree"
  );
  const newCommit = await mustJson(
    await gh(env, `${rp}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }),
    }),
    "commit baharu"
  );
  await mustJson(
    await gh(env, `${rp}/git/refs/heads/${encodeURIComponent(env.GITHUB_BRANCH)}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha }),
    }),
    "kemas kini ref"
  );
  return files.length;
}
